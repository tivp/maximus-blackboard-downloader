// Lectura de la lista del curso (/outline), apertura de carpetas cerradas y armado del árbol de recursos por unidad.

import { CFG, RE, TARJETAS, estado, verificarCancelacion } from './config.js';
import {
    dormir,
    texto,
    canon,
    seguro,
    limpiarPrefijoXid,
    visible,
    posicion,
    urlReal,
    esperarHasta,
    compatible,
    obtenerIdCursoActual,
    tituloEl
} from './utils.js';
import { enVistaDocumentoPantallaCompleta } from './interceptor.js';
import { inspeccionarEvaluacionesEnContenedorApi, sincronizarEvaluacionesCursoApi } from './api.js';

// Saca los bloques de archivo (videos, PDFs, enlaces de Ally) que vienen dentro de un document-panel de Blackboard Ultra.
export function extraerBloquesDeDocumentPanel(raizDoc = document) {
    const contenedor =
        raizDoc.matches?.('document-panel, .document-content-root, .bbml-editor')
            ? raizDoc
            : raizDoc.querySelector?.('document-panel, .document-content-root, .bbml-editor');

    if (!contenedor) return [];

    const bloques = [];
    const urlsVistas = new Set();
    let contadorVideo = 1;

    for (const region of contenedor.querySelectorAll('[role="region"][aria-label="Archivo"]')) {
        const allyEl = region.querySelector('a[data-ally-file-preview-url]');
        const videoEl = region.querySelector('video[src], audio[src], source[src]');
        const previewDiv = region.querySelector('[id^="file-preview-"]');
        const controlBtn = region.querySelector('[aria-controls^="file-preview-"]');
        const iframeEl = region.querySelector('iframe[src]');
        const spanTitulo = region.querySelector(
            '.js-file-viewer-attachment-meta span, [class*="fileText"]'
        );

        const rawUrl =
            allyEl?.getAttribute('data-ally-file-preview-url') ||
            videoEl?.getAttribute('src') ||
            previewDiv?.getAttribute('id')?.replace(/^file-preview-/i, '') ||
            controlBtn?.getAttribute('aria-controls')?.replace(/^file-preview-/i, '') ||
            iframeEl?.getAttribute('src');

        const url = urlReal(rawUrl);
        if (!url || urlsVistas.has(url)) continue;
        urlsVistas.add(url);

        const eid = limpiarPrefijoXid(
            allyEl?.getAttribute('data-ally-file-eid') ||
            decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
        );

        let tituloBloque = texto(spanTitulo?.textContent || '');

        if (!tituloBloque) {
            if (videoEl || /\.mp4(?:$|[?#])/i.test(url)) {
                tituloBloque = contadorVideo === 1 ? 'Video de presentación' : `Video ${contadorVideo}`;
                contadorVideo++;
            } else {
                tituloBloque = eid.replace(/\.[^.]+$/, '') || 'Archivo adjunto';
            }
        }

        bloques.push({
            el: spanTitulo || videoEl || region,
            tarjeta: region,
            nombre: tituloBloque,
            nombreArchivoSugerido: eid || tituloBloque,
            carpetas: [seguro(tituloBloque)],
            ruta: [seguro(tituloBloque)],
            url,
            clic: false,
            omitido: false
        });
    }

    for (const el of contenedor.querySelectorAll(
        'a[data-ally-file-preview-url], video[src], audio[src], [id^="file-preview-"], [aria-controls^="file-preview-"], a[href*="bbcswebdav"], a[href$=".html"], a[href$=".htm"], a[target="_blank"][href^="http"]'
    )) {
        const rawUrl =
            el.getAttribute('data-ally-file-preview-url') ||
            el.getAttribute('src') ||
            el.getAttribute('id')?.replace(/^file-preview-/i, '') ||
            el.getAttribute('aria-controls')?.replace(/^file-preview-/i, '') ||
            el.getAttribute('href');

        const url = urlReal(rawUrl);
        if (!url || urlsVistas.has(url)) continue;
        urlsVistas.add(url);

        const eid = limpiarPrefijoXid(
            el.getAttribute('data-ally-file-eid') ||
            decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
        );

        const esVideo = el.tagName.toLowerCase() === 'video' || /\.mp4(?:$|[?#])/i.test(url);
        const regionPadre = el.closest('[role="region"]');
        const spanTexto = regionPadre?.querySelector('.js-file-viewer-attachment-meta span, [class*="fileText"]');

        const tituloBloque =
            texto(spanTexto?.textContent || el.textContent || '') ||
            (esVideo
                ? contadorVideo === 1
                    ? 'Video de presentación'
                    : `Video ${contadorVideo++}`
                : eid.replace(/\.[^.]+$/, '') || 'Documento adjunto');

        bloques.push({
            el,
            tarjeta: regionPadre || el,
            nombre: tituloBloque,
            nombreArchivoSugerido: eid || tituloBloque,
            carpetas: [seguro(tituloBloque)],
            ruta: [seguro(tituloBloque)],
            url,
            clic: false,
            omitido: false
        });
    }

    return bloques;
}

// El botón para bajar el curso entero solo se muestra cuando el examen final ya no tiene candado de condición.
export function examenFinalHabilitado() {
    const enlacesEval = document.querySelectorAll(
        'a[data-analytics-id*="gradebook.item.assessment"], a[href*="/assessment/"], a[aria-label^="Examen,"]'
    );
    for (const el of enlacesEval) {
        const nombre = tituloEl(el);
        const card = el.closest(TARJETAS);
        const bloqueado =
            el.matches('[class*="readOnly"],[class*="isRestricted"]') ||
            card?.querySelector('[data-analytics-id="components.common.conditional-release-info.buttonBase"]');

        if (!bloqueado && RE.itemExamen.test(nombre)) {
            return true;
        }
    }

    for (const u of estado.unidades.values()) {
        const card = u.raiz;
        const bloqueado =
            u.titulo.matches('[class*="readOnly"]') ||
            card?.querySelector('[data-analytics-id="components.common.conditional-release-info.buttonBase"]');

        if (!bloqueado && RE.moduloFinal.test(u.nombre)) {
            return true;
        }
    }

    return false;
}

export function esModuloPrincipal(el, nombre) {
    if (!nombre || nombre.length > 180) {
        return false;
    }

    if (
        el.closest(
            'content-page-header, nav, .MuiBreadcrumbs-root, .MuiDrawer-root, document-panel, section.page-scorm-launch-frame, learning-module-panel-view, [data-analytics-id="content.navigation.drawer"]'
        )
    ) {
        return false;
    }

    const card = el.closest(TARJETAS);
    if (!card) {
        return false;
    }

    // Si la unidad tiene candado por fecha o nota previa, no se puede abrir todavía.
    if (
        el.matches('[class*="readOnly"]') ||
        card.querySelector('[data-analytics-id="components.common.conditional-release-info.buttonBase"]')
    ) {
        return false;
    }

    if (
        el.matches(
            'button[id^="learning-module-title-"], [data-analytics-id="course.learning.module.base.item.toggleLm.button"]'
        )
    ) {
        return true;
    }

    if (
        el.matches(
            'button[id^="folder-title-"], [data-analytics-id="content.item.folder.toggleFolder.button"]'
        )
    ) {
        return false;
    }

    if (!card.classList.contains('root') && card.parentElement?.closest(TARJETAS)) {
        return false;
    }

    if (RE.excluir.test(nombre)) {
        return false;
    }

    return RE.unidad.test(nombre);
}

export function cabeceras() {
    if (enVistaDocumentoPantallaCompleta()) {
        return [];
    }

    const lista = [];
    const selector =
        'button[id^="learning-module-title-"],' +
        '[data-analytics-id="course.learning.module.base.item.toggleLm.button"],' +
        'h2,h3,h4,[role="heading"],' +
        '.content-title,.element-details .name,' +
        'a,button,span';

    for (const el of document.querySelectorAll(selector)) {
        if (
            !visible(el) ||
            el.closest('[data-maximus], document-panel, section.page-scorm-launch-frame, learning-module-panel-view, content-page-header, nav, .MuiBreadcrumbs-root')
        ) {
            continue;
        }

        const nombre = tituloEl(el);
        if (!esModuloPrincipal(el, nombre)) {
            continue;
        }

        const rect = el.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 8) {
            continue;
        }

        const igual = lista.find(
            x =>
                canon(x.nombre) === canon(nombre) &&
                Math.abs(x.y - (rect.top + scrollY)) < 14
        );

        if (!igual) {
            lista.push({
                el,
                nombre,
                y: rect.top + scrollY
            });
        } else if (igual.el.contains(el)) {
            Object.assign(igual, {
                el,
                nombre,
                y: rect.top + scrollY
            });
        }
    }

    return lista.sort((a, b) => posicion(a.el, b.el));
}

export function buscarRaiz(titulo, otros) {
    const tarjeta = titulo.closest(TARJETAS);
    if (tarjeta) return tarjeta;

    let mejor = null;

    for (let p = titulo.parentElement; p && p !== document.body; p = p.parentElement) {
        if (otros.some(x => x !== titulo && p.contains(x))) {
            break;
        }

        if (p.getBoundingClientRect().width < 280) {
            continue;
        }

        const contenido = p.querySelector(
            '[aria-expanded],.content-list-item,.outline-item,[class*="folder"],a[href]'
        );

        const imagen = [...p.querySelectorAll('img')].some(img => {
            const r = img.getBoundingClientRect();
            return (
                r.width >= 35 &&
                r.height >= 35 &&
                r.left < titulo.getBoundingClientRect().left - 8
            );
        });

        if (contenido || imagen) {
            mejor = p;
        }

        if (
            p.matches(
                'article,li,section,[class*="card"],[class*="content-item"],[class*="contentListItem"]'
            ) &&
            (contenido || imagen)
        ) {
            return p;
        }
    }

    return mejor || titulo.parentElement;
}

export function anclaAncha(u) {
    const headerMod = u.raiz.querySelector('[class*="learningModuleItem"], [class*="itemContainer"]');
    if (headerMod && u.raiz.contains(headerMod) && headerMod.getBoundingClientRect().width >= 420) {
        return headerMod;
    }

    let mejor = u.raiz;

    const otros = [...estado.unidades.values()]
        .filter(x => x !== u)
        .map(x => x.titulo);

    for (let p = u.raiz; p && p !== document.body; p = p.parentElement) {
        if (otros.some(x => p.contains(x))) {
            break;
        }

        const r = p.getBoundingClientRect();
        if (r.width >= 420 && r.width >= u.titulo.getBoundingClientRect().width + 100) {
            mejor = p;
            break;
        }
    }

    return mejor;
}

export function dentroDeUnidad(el, u) {
    if (!u.raiz.contains(el) || el.closest('[data-maximus]')) {
        return false;
    }

    for (const otra of estado.unidades.values()) {
        if (otra !== u && otra.raiz !== u.raiz && otra.raiz.contains(el)) {
            return false;
        }
    }

    return true;
}

export async function abrirUnidad(u) {
    verificarCancelacion();

    if (u.contentId && !u.raiz?.isConnected) {
        const nuevaRaiz = document.querySelector(`.content-list-item[data-content-id="${u.contentId}"]`);
        if (nuevaRaiz) u.raiz = nuevaRaiz;
    }

    let control = u.titulo.matches('[aria-expanded]')
        ? u.titulo
        : u.titulo.closest('button[aria-expanded]');

    if (!control) {
        control = [
            ...u.raiz.querySelectorAll('button[aria-expanded],[role="button"][aria-expanded]')
        ].find(b => b.closest(TARJETAS) === u.raiz);
    }

    if (!control && u.titulo.matches('button')) {
        control = u.titulo;
    }

    // Blackboard Ultra tiene un typo en su propio código ("coures.outline.document.link"); buscamos las dos variantes por si lo arreglan.
    const hayContenidoDescargable = () =>
        [
            ...u.raiz.querySelectorAll(
                'button[id^="folder-title-"],' +
                '[data-analytics-id="content.item.course.outline.courseContent.link"],' +
                '[data-analytics-id="content.item.coures.outline.document.link"],' +
                '[data-analytics-id="content.item.courses.outline.document.link"],' +
                'a[href*="/document/"]'
            )
        ].some(x => x !== u.titulo && dentroDeUnidad(x, u));

    if (control?.getAttribute('aria-expanded') !== 'false' && hayContenidoDescargable()) {
        return;
    }

    if (
        control?.getAttribute('aria-expanded') === 'false' ||
        (!hayContenidoDescargable() && control)
    ) {
        if (control.getAttribute('aria-expanded') === 'false') {
            control.click();
            u.log.push('[UNIDAD] Abierta automáticamente');
        }

        await esperarHasta(() => hayContenidoDescargable(), CFG.ESPERA_CARGA, 50);
    }

    if (!hayContenidoDescargable()) {
        await esperarHasta(hayContenidoDescargable, 4000, 50);
    }
    await dormir(80);
}

export async function expandirCarpetas(u) {
    await abrirUnidad(u);

    const vistos = new WeakSet();

    for (let ronda = 0; ronda < 12; ronda++) {
        verificarCancelacion();

        const botones = [
            ...u.raiz.querySelectorAll(
                'button[id^="folder-title-"][aria-expanded="false"],' +
                'button[data-analytics-id="content.item.folder.toggleFolder.button"][aria-expanded="false"],' +
                'button[aria-expanded="false"],[role="button"][aria-expanded="false"]'
            )
        ]
            .filter(b => b !== u.titulo && dentroDeUnidad(b, u) && !vistos.has(b))
            .filter(
                b =>
                    !b.matches(
                        '.js-review-state-icon-button,[id^="content-item-overflow-menu-button-"]'
                    )
            )
            .filter(b => !RE.interactivo.test(tituloEl(b)));

        if (!botones.length) break;

        const pendientesEspera = [];

        for (const boton of botones) {
            verificarCancelacion();
            vistos.add(boton);

            if (!boton.isConnected || boton.getAttribute('aria-expanded') !== 'false') {
                continue;
            }

            const cardCarpeta = boton.closest(TARJETAS);
            const hijosAntes = cardCarpeta ? cardCarpeta.querySelectorAll(TARJETAS).length : 0;

            try {
                boton.click();
                pendientesEspera.push({ boton, cardCarpeta, hijosAntes });
            } catch (e) {
                u.log.push(`[CARPETA] ${e.message}`);
            }
        }

        if (!pendientesEspera.length) break;

        await Promise.all(
            pendientesEspera.map(({ boton, cardCarpeta, hijosAntes }) =>
                esperarHasta(
                    () =>
                        !boton.isConnected ||
                        (boton.getAttribute('aria-expanded') === 'true' &&
                            (!cardCarpeta ||
                                (!cardCarpeta.querySelector('.ms-Spinner, [data-testid="skeleton-loader"]') &&
                                    cardCarpeta.querySelectorAll(TARJETAS).length > hijosAntes))),
                    2500,
                    50
                ).catch(e => {
                    u.log.push(`[CARPETA] ${e.message}`);
                })
            )
        );
        await dormir(80);
    }
}

export function nombreCard(card) {
    const directos = [
        ...card.querySelectorAll(
            'button[id^="folder-title-"],' +
            '[data-analytics-id="content.item.course.outline.courseContent.link"],' +
            '[data-analytics-id="content.item.coures.outline.document.link"],' +
            '[data-analytics-id="content.item.courses.outline.document.link"],' +
            '.ax-focusable-title,' +
            '.element-details .content-title,' +
            '.element-details .name,' +
            '.content-title,[role="heading"],' +
            'button[aria-expanded],a[href],button'
        )
    ].filter(el => el.closest(TARJETAS) === card);

    const primero = directos.find(
        el =>
            !el.matches(
                'button[aria-label*="opciones" i],' +
                'button[aria-label*="more" i],' +
                'button.js-review-state-icon-button,' +
                'button[id^="content-item-overflow-menu-button-"],' +
                '[data-analytics-id*="loadMoreButton"]'
            )
    );

    return tituloEl(primero) || '';
}

export function esCarpeta(card, nombre) {
    const botonCarpeta = [
        ...card.querySelectorAll(
            'button[id^="folder-title-"],' +
            '[data-analytics-id="content.item.folder.toggleFolder.button"]'
        )
    ].find(el => el.closest(TARJETAS) === card);

    if (botonCarpeta) return true;

    const esLinkContenido = [
        ...card.querySelectorAll(
            '[data-analytics-id="content.item.course.outline.courseContent.link"],' +
            '[data-analytics-id="content.item.coures.outline.document.link"],' +
            '[data-analytics-id="content.item.courses.outline.document.link"]'
        )
    ].some(el => el.closest(TARJETAS) === card);

    if (esLinkContenido) return false;

    const botonExpandible = [
        ...card.querySelectorAll('button[aria-expanded],[role="button"][aria-expanded]')
    ].find(
        el =>
            el.closest(TARJETAS) === card &&
            !el.matches('.js-review-state-icon-button,[id^="content-item-overflow-menu-button-"]')
    );

    return !!botonExpandible && RE.carpeta.test(nombre);
}

export function esEvaluacionOnline(el) {
    if (!el) return false;
    const analytics = el.getAttribute('data-analytics-id') || '';
    const href = el.getAttribute('href') || '';
    const label = el.getAttribute('aria-label') || '';

    return (
        analytics.includes('gradebook.item.assessment') ||
        analytics.includes('forumLink') ||
        /\/ultra\/courses\/[^/]+\/(?:assessment|discussion)\//i.test(href) ||
        /^(?:examen|cuestionario|foro)\b/i.test(label)
    );
}

export function esTarjetaScormOInteractiva(card, el, nombre, padres = []) {
    if (RE.interactivo.test(nombre) || padres.some(x => RE.interactivo.test(x))) {
        return true;
    }
    const href = el?.getAttribute('href') || '';
    const label = el?.getAttribute('aria-label') || '';
    const analytics = el?.getAttribute('data-analytics-id') || '';
    if (
        /\/scorm\//i.test(href) ||
        /\bscorm\b/i.test(label) ||
        /\bscorm\b/i.test(analytics) ||
        card?.querySelector('svg[aria-label*="SCORM" i], [aria-label^="Paquete SCORM" i], a[href*="/scorm/"]')
    ) {
        return true;
    }
    return false;
}

export function elegirAccion(card) {
    const candidatos = [
        ...card.querySelectorAll(
            '[data-analytics-id="content.item.course.outline.courseContent.link"],' +
            '[data-analytics-id="content.item.coures.outline.document.link"],' +
            '[data-analytics-id="content.item.courses.outline.document.link"],' +
            'a[aria-label^="Enlace,"],' +
            'button[aria-label^="Enlace,"],' +
            'a[aria-label^="Documento de texto,"],' +
            'a.ax-focusable-title,button.ax-focusable-title,' +
            'a[href],button[href],' +
            '[role="link"],button'
        )
    ].filter(
        el =>
            el.closest(TARJETAS) === card &&
            !el.closest(
                '[data-maximus],[role="menu"],.dropdown-menu,.content-item__review-state-icon'
            ) &&
            !el.matches(
                '.js-review-state-icon-button,' +
                '[id^="content-item-overflow-menu-button-"],' +
                '[data-analytics-id*="loadMoreButton"]'
            ) &&
            !esEvaluacionOnline(el)
    );

    return (
        candidatos.find(el => {
            if (
                el.matches(
                    'button[id^="folder-title-"],button[id^="learning-module-title-"],[data-analytics-id="content.item.folder.toggleFolder.button"]'
                )
            ) {
                return false;
            }

            const nombre = tituloEl(el);

            if (
                !nombre ||
                nombre.length > 190 ||
                RE.unidad.test(nombre) ||
                RE.excluir.test(nombre)
            ) {
                return false;
            }

            return (
                el.matches('a[href],button[href],[role="link"]') ||
                !!el.getAttribute('data-analytics-id') ||
                /^(?:(?:[usm]\d+\s*[|:]\s*)?(?:pdf|audio|actividad|material|instructivo|instrucciones|respuesta|documento|archivo|gu[ií]a|lectura|presentaci[oó]n|infograf[ií]a|video|resumen|informaci[oó]n))\b/i.test(
                    nombre
                ) ||
                /^(?:enlace|documento de texto),/i.test(el.getAttribute('aria-label') || '')
            );
        }) || null
    );
}

// Recorre las tarjetas de la unidad y reconstruye en qué carpeta va cada ítem usando el árbol del DOM o la sangría X en pantalla.
export function recursos(u) {
    const salida = [];
    const vistos = new Set();
    const stack = [];

    const cards = [...u.raiz.querySelectorAll(TARJETAS)].filter(
        c => c !== u.raiz && dentroDeUnidad(c, u)
    );

    const filas = [];

    for (const card of cards) {
        const nombre = nombreCard(card);
        if (!nombre || RE.unidad.test(nombre)) continue;

        const folder = esCarpeta(card, nombre);
        const el = folder ? null : elegirAccion(card);

        if (!folder && !el) continue;

        filas.push({
            card,
            nombre,
            folder,
            el,
            x: (el || card).getBoundingClientRect().left
        });
    }

    for (const f of filas) {
        while (stack.length && f.x <= stack.at(-1).x + 3) {
            stack.pop();
        }

        const ancestros = [];

        for (
            let p = f.card.parentElement?.closest(TARJETAS);
            p && p !== u.raiz && u.raiz.contains(p);
            p = p.parentElement?.closest(TARJETAS)
        ) {
            const n = nombreCard(p);
            if (n && esCarpeta(p, n)) {
                ancestros.unshift(seguro(n));
            }
        }

        if (f.folder) {
            stack.push({ x: f.x, nombre: f.nombre });
            continue;
        }

        const padres = ancestros.length
            ? ancestros
            : stack.map(x => seguro(x.nombre));

        const linkDirecto = f.card.querySelector(
            'a[download], a[href*="bbcswebdav"], a[href*="isForcedDownload"], [data-download-url]'
        );

        const raw =
            linkDirecto?.getAttribute('href') ||
            linkDirecto?.getAttribute('data-download-url') ||
            f.el.getAttribute('href') ||
            f.el.getAttribute('data-href') ||
            f.el.getAttribute('data-download-url');

        const url = urlReal(raw);
        const contentId = f.card.getAttribute('data-content-id') || '';

        const id =
            contentId ||
            `${f.nombre}|${Math.round(f.el.getBoundingClientRect().top)}`;

        if (vistos.has(id)) continue;
        vistos.add(id);

        const hrefAttr = f.el.getAttribute('href') || '';
        const analyticsAttr = f.el.getAttribute('data-analytics-id') || '';
        const labelAttr = f.el.getAttribute('aria-label') || '';

        salida.push({
            contentId,
            tarjeta: f.card,
            el: f.el,
            nombre: f.nombre,
            carpetas: padres,
            ruta: [...padres, seguro(f.nombre)],
            url,
            esDocUltra:
                /\/ultra\/courses\/[^/]+\/document\//i.test(hrefAttr) ||
                analyticsAttr.includes('.outline.document.link') ||
                /^documento de texto,/i.test(labelAttr),
            hrefOriginal: hrefAttr,
            clic: f.el.matches('button') || !url,
            omitido: esTarjetaScormOInteractiva(f.card, f.el, f.nombre, padres)
        });
    }

    const selector =
        'a[href],button[href],' +
        'button[aria-label^="Enlace,"],' +
        'button[data-analytics-id="content.item.course.outline.courseContent.link"],' +
        'a[data-analytics-id="content.item.coures.outline.document.link"],' +
        'a[data-analytics-id="content.item.courses.outline.document.link"],' +
        '[role="link"][data-href],' +
        '[data-download-url]';

    for (const el of u.raiz.querySelectorAll(selector)) {
        if (
            !dentroDeUnidad(el, u) ||
            el === u.titulo ||
            !visible(el) ||
            el.matches('.js-review-state-icon-button,[id^="content-item-overflow-menu-button-"]') ||
            el.closest('.content-item__review-state-icon') ||
            esEvaluacionOnline(el)
        ) {
            continue;
        }

        const card =
            el.closest(TARJETAS) ||
            el.closest('li,[role="listitem"],[class*="itemContainer"]') ||
            el.parentElement;

        if (!card) continue;

        const nombre = tituloEl(el).replace(/^(?:Enlace|Documento de texto),\s*/i, '');

        if (
            !nombre ||
            nombre.length > 180 ||
            RE.excluir.test(nombre) ||
            RE.unidad.test(nombre) ||
            esCarpeta(card, nombre)
        ) {
            continue;
        }

        if (el.closest('[role="menu"],.dropdown-menu')) continue;

        if (
            salida.some(
                r =>
                    r.el === el ||
                    (r.tarjeta === card && canon(r.nombre) === canon(nombre))
            )
        ) {
            continue;
        }

        const url = urlReal(
            el.getAttribute('href') ||
            el.getAttribute('data-href') ||
            el.getAttribute('data-download-url')
        );

        const contentId = card.getAttribute('data-content-id') || '';
        const id =
            contentId ||
            `${nombre}:${Math.round(el.getBoundingClientRect().top)}`;

        if (vistos.has(id)) continue;
        vistos.add(id);

        const padres = [];

        for (
            let p = card.parentElement?.closest(TARJETAS);
            p && p !== u.raiz && u.raiz.contains(p);
            p = p.parentElement?.closest(TARJETAS)
        ) {
            const n = nombreCard(p);
            if (n && esCarpeta(p, n)) {
                padres.unshift(seguro(n));
            }
        }

        const hrefAttr = el.getAttribute('href') || '';
        const analyticsAttr = el.getAttribute('data-analytics-id') || '';
        const labelAttr = el.getAttribute('aria-label') || '';

        salida.push({
            contentId,
            tarjeta: card,
            el,
            nombre,
            carpetas: padres,
            ruta: [...padres, seguro(nombre)],
            url,
            esDocUltra:
                /\/ultra\/courses\/[^/]+\/document\//i.test(hrefAttr) ||
                analyticsAttr.includes('.outline.document.link') ||
                /^documento de texto,/i.test(labelAttr),
            hrefOriginal: hrefAttr,
            clic: el.matches('button') || !url,
            omitido: esTarjetaScormOInteractiva(card, el, nombre, padres)
        });
    }

    return salida.sort((a, b) => posicion(a.el, b.el));
}

// Cuando se cierra una vista de documento a pantalla completa, Blackboard vuelve a crear los nodos del DOM y hay que reencontrar la referencia.
export function reconectarElementoRecurso(r, u) {
    if (r.el?.isConnected && !enVistaDocumentoPantallaCompleta()) return r.el;

    if (r.contentId) {
        const card = document.querySelector(`.content-list-item[data-content-id="${r.contentId}"]`);
        if (card) {
            r.tarjeta = card;
            const accion = elegirAccion(card);
            if (accion) {
                r.el = accion;
                return accion;
            }
        }
    }

    if (u?.raiz && !u.raiz.isConnected && u.contentId) {
        const nuevaRaiz = document.querySelector(`.content-list-item[data-content-id="${u.contentId}"]`);
        if (nuevaRaiz) u.raiz = nuevaRaiz;
    }

    const contenedorBusqueda = u?.raiz?.isConnected ? u.raiz : document;
    for (const card of contenedorBusqueda.querySelectorAll(TARJETAS)) {
        if (u?.raiz && card === u.raiz) continue;
        const nCard = nombreCard(card).replace(/^(?:Enlace|Documento de texto),\s*/i, '');
        if (canon(nCard) === canon(r.nombre)) {
            const accion = elegirAccion(card);
            if (accion) {
                r.tarjeta = card;
                r.el = accion;
                return accion;
            }
        }
    }

    if (u?.raiz?.isConnected) {
        const itemsActuales = recursos(u);
        const match = itemsActuales.find(x => canon(x.nombre) === canon(r.nombre));
        if (match?.el?.isConnected) {
            r.tarjeta = match.tarjeta;
            r.el = match.el;
            return match.el;
        }
    }

    return r.el?.isConnected ? r.el : null;
}

export function estaTarjetaBloqueada(card, btn = null) {
    if (!card) return true;
    if (btn) {
        if (
            btn.disabled ||
            btn.getAttribute('aria-disabled') === 'true' ||
            btn.matches('[class*="readOnly"], [class*="isRestricted"]')
        ) {
            return true;
        }
    }

    return [...card.querySelectorAll('[data-analytics-id="components.common.conditional-release-info.buttonBase"]')].some(
        el => el.closest(TARJETAS) === card
    );
}

export function esModuloCard(card) {
    if (!card) return false;
    return [
        ...card.querySelectorAll(
            'button[id^="learning-module-title-"], [data-analytics-id="course.learning.module.base.item.toggleLm.button"]'
        )
    ].some(el => el.closest(TARJETAS) === card);
}

export function esCarpetaEvaluacion(card, btn = null) {
    if (!card) return false;

    const btnCarpeta =
        (btn && btn.closest(TARJETAS) === card ? btn : null) ||
        [
            ...card.querySelectorAll(
                'button[id^="folder-title-"], [data-analytics-id="content.item.folder.toggleFolder.button"]'
            )
        ].find(el => el.closest(TARJETAS) === card) ||
        null;

    const nombre = tituloEl(btnCarpeta) || nombreCard(card);
    if (!nombre) return false;

    return Boolean(
        (btnCarpeta || esCarpeta(card, nombre)) &&
        (RE.carpetaEvaluacion.test(nombre) || RE.moduloFinal.test(nombre))
    );
}

export function obtenerContenedorFilaEvaluacion(card) {
    if (!card) return null;

    const directo = [...card.querySelectorAll('.click-to-invoke-container')].find(
        el => el.closest(TARJETAS) === card
    );
    if (directo) return directo;

    const contentItem = [...card.querySelectorAll('[class*="contentItem-"]')].find(
        el => el.closest(TARJETAS) === card
    );
    if (contentItem) return contentItem;

    return card.querySelector(':scope > .outline-item-inner, :scope > [class*="itemContainer"]') || card;
}

export function esElementoEvaluacionEnNodo(raiz, card = null) {
    if (!raiz) return false;
    const esPropio = el => !card || el.closest(TARJETAS) === card;

    if (
        [
            ...raiz.querySelectorAll(
                '.ax-focusable-title, [data-analytics-id*="gradebook.item"], a[href*="/assessment/"], a[href*="/assignment/"]'
            )
        ].some(el => {
            if (!esPropio(el)) return false;
            const txt = tituloEl(el) || texto(el.getAttribute('aria-label') || '');
            return Boolean(txt && RE.encuestaOSondeo.test(txt));
        })
    ) {
        return false;
    }

    if (
        [
            ...raiz.querySelectorAll(
                'a[href*="/assessment/"], a[href*="/assignment/"], button[href*="/assessment/"], [data-analytics-id*="gradebook.item"]'
            )
        ].some(esPropio)
    ) {
        return true;
    }

    if (
        [...raiz.querySelectorAll('svg[aria-label]')].some(
            el =>
                esPropio(el) &&
                /^(?:examen|prueba|evaluaci[oó]n|cuestionario|actividad|tarea|test|exam|quiz|assignment)$/i.test(
                    texto(el.getAttribute('aria-label'))
                )
        )
    ) {
        return true;
    }

    if (
        [...raiz.querySelectorAll('a[aria-label], button[aria-label], .ax-focusable-title[aria-label]')].some(
            el =>
                esPropio(el) &&
                /^(?:examen|prueba|evaluaci[oó]n|cuestionario|actividad|tarea|test|exam|quiz|assignment)\s*,/i.test(
                    texto(el.getAttribute('aria-label'))
                )
        )
    ) {
        return true;
    }

    if ([...raiz.querySelectorAll('[class*="gradeInfo-"], [class*="gradeDetail-"]')].some(esPropio)) {
        return true;
    }

    return [...raiz.querySelectorAll('.ax-focusable-title, a[href], button')].some(el => {
        if (!esPropio(el)) return false;
        if (
            el.matches(
                '.js-review-state-icon-button, [id^="content-item-overflow-menu-button-"], [data-analytics-id="components.common.conditional-release-info.buttonBase"], [aria-haspopup], button[aria-label*="opciones" i], button[aria-label*="more" i]'
            )
        ) {
            return false;
        }
        const t = tituloEl(el);
        return Boolean(t && RE.itemEvaluacionTitulo.test(t) && !RE.encuestaOSondeo.test(t));
    });
}

export function esTarjetaEvaluacion(card) {
    if (!card) return false;
    if (
        card.closest(
            '[data-maximus], document-panel, section.page-scorm-launch-frame, learning-module-panel-view, content-page-header, nav, .MuiBreadcrumbs-root'
        )
    ) {
        return false;
    }

    const nombre = nombreCard(card);
    if (esModuloCard(card) || esCarpeta(card, nombre)) {
        return false;
    }

    if (nombre && RE.encuestaOSondeo.test(nombre)) {
        return false;
    }

    if (esElementoEvaluacionEnNodo(card, card)) {
        return true;
    }

    for (let p = card.parentElement?.closest(TARJETAS); p; p = p.parentElement?.closest(TARJETAS)) {
        if (esCarpetaEvaluacion(p) || (esModuloCard(p) && RE.moduloFinal.test(nombreCard(p)))) {
            return true;
        }
    }

    return false;
}

export function reiniciarEstadoEvaluacionesSiCambioCurso() {
    const cidCurso = obtenerIdCursoActual();
    if (cidCurso !== estado.evaluacionesCursoId) {
        estado.evaluacionesCursoId = cidCurso;
        estado.evaluacionesColapsadasUsuario.clear();
        estado.evaluacionesModulosSinEval.clear();
        estado.evaluacionesCarpetasConEval.clear();
        estado.evaluacionesCacheApi.clear();
        estado.evaluacionesApiPorCurso = null;
        estado.evaluacionesBotonesAutoAbiertos = new WeakSet();
        estado.evaluacionesNotificacionCerrada = false;
        estado.evaluacionesAutomatizacionActiva = false;
        estado.evaluacionesAnalisisCompleto = false;
        if (estado.evaluacionesTimerBackdrop) {
            clearTimeout(estado.evaluacionesTimerBackdrop);
            estado.evaluacionesTimerBackdrop = null;
        }
    }
}

export function enVistaOutlineCurso() {
    return (
        compatible() &&
        !enVistaDocumentoPantallaCompleta() &&
        !/\/ultra\/courses\/[^/]+\/(?:assessment|discussion|grades|announcements|messages|roster|calendar)\b/i.test(
            location.pathname
        ) &&
        !!document.querySelector(TARJETAS)
    );
}

export async function desplegarEvaluacionesAutomaticamente(alActualizar = null, forzarApi = false) {
    reiniciarEstadoEvaluacionesSiCambioCurso();

    if (!enVistaOutlineCurso() || estado.ocupado) {
        return;
    }

    if (estado.evaluacionesEnCurso) {
        estado.evaluacionesReintentar = true;
        return;
    }

    estado.evaluacionesEnCurso = true;
    estado.evaluacionesReintentar = false;

    const courseIdInicial = obtenerIdCursoActual();
    const debeAbortar = () =>
        estado.ocupado ||
        !enVistaOutlineCurso() ||
        obtenerIdCursoActual() !== courseIdInicial;

    let automatizacionMostrada = false;
    const iniciarAutomatizacionVisual = () => {
        if (automatizacionMostrada || debeAbortar()) return;
        automatizacionMostrada = true;
        if (estado.evaluacionesTimerBackdrop) {
            clearTimeout(estado.evaluacionesTimerBackdrop);
            estado.evaluacionesTimerBackdrop = null;
        }
        estado.evaluacionesAutomatizacionActiva = true;
        alActualizar?.();
    };

    if (!estado.evaluacionesAnalisisCompleto) {
        iniciarAutomatizacionVisual();
    }

    const esperarHijosContenedor = async (card, btn, hijosAntes, ms = 2500) => {
        await esperarHasta(
            () =>
                debeAbortar() ||
                !btn.isConnected ||
                (btn.getAttribute('aria-expanded') === 'true' &&
                    !card.querySelector('.ms-Spinner, [data-testid="skeleton-loader"]') &&
                    card.querySelectorAll(TARJETAS).length > hijosAntes),
            ms
        );
    };

    const expandirCarpetasEvaluacionVisibles = async () => {
        for (let ronda = 0; ronda < 4; ronda++) {
            if (debeAbortar()) return;

            const selectorCarpetas =
                'button[id^="folder-title-"][aria-expanded="false"],' +
                '[data-analytics-id="content.item.folder.toggleFolder.button"][aria-expanded="false"],' +
                'button[aria-expanded="false"],[role="button"][aria-expanded="false"]';

            const pendientes = [...document.querySelectorAll(selectorCarpetas)].filter(btn => {
                if (!visible(btn)) return false;
                if (
                    btn.closest(
                        '[data-maximus], document-panel, section.page-scorm-launch-frame, learning-module-panel-view, content-page-header, nav, .MuiBreadcrumbs-root, .MuiDrawer-root'
                    )
                ) {
                    return false;
                }
                if (
                    btn.matches(
                        'button[id^="learning-module-title-"], [data-analytics-id="course.learning.module.base.item.toggleLm.button"], .js-review-state-icon-button, [id^="content-item-overflow-menu-button-"], [data-analytics-id="components.common.conditional-release-info.buttonBase"], [aria-haspopup]'
                    )
                ) {
                    return false;
                }
                if (estado.evaluacionesBotonesAutoAbiertos.has(btn)) return false;

                const card = btn.closest(TARJETAS);
                if (!card || estaTarjetaBloqueada(card, btn)) return false;

                const cid = card.getAttribute('data-content-id') || '';
                if (cid && estado.evaluacionesColapsadasUsuario.has(cid)) return false;

                return (
                    esCarpetaEvaluacion(card, btn) ||
                    Boolean(cid && estado.evaluacionesCarpetasConEval.has(cid))
                );
            });

            if (!pendientes.length) break;

            iniciarAutomatizacionVisual();

            let abrioAlguno = false;
            for (const btn of pendientes) {
                if (debeAbortar()) return;
                if (!btn.isConnected || btn.getAttribute('aria-expanded') !== 'false') continue;

                const card = btn.closest(TARJETAS);
                if (!card) continue;

                const hijosAntes = card.querySelectorAll(TARJETAS).length;
                estado.evaluacionesBotonesAutoAbiertos.add(btn);
                btn.click();
                abrioAlguno = true;

                await esperarHijosContenedor(card, btn, hijosAntes);
                if (debeAbortar()) return;
                alActualizar?.();
            }

            if (!abrioAlguno) break;
            await dormir(150);
        }
    };

    try {
        const promesaApiCurso = sincronizarEvaluacionesCursoApi(courseIdInicial, forzarApi)
            .then(res => {
                if (res?.disponible && !debeAbortar()) alActualizar?.();
                return res;
            })
            .catch(() => null);

        await expandirCarpetasEvaluacionVisibles();
        if (debeAbortar()) return;
        alActualizar?.();

        const selectorCandidatos =
            'button[id^="learning-module-title-"][aria-expanded="false"],' +
            '[data-analytics-id="course.learning.module.base.item.toggleLm.button"][aria-expanded="false"],' +
            'button[id^="folder-title-"][aria-expanded="false"],' +
            '[data-analytics-id="content.item.folder.toggleFolder.button"][aria-expanded="false"]';

        const candidatos = [];
        const cardsVistas = new Set();

        for (const btn of document.querySelectorAll(selectorCandidatos)) {
            if (!visible(btn)) continue;
            if (
                btn.closest(
                    '[data-maximus], document-panel, section.page-scorm-launch-frame, learning-module-panel-view, content-page-header, nav, .MuiBreadcrumbs-root, .MuiDrawer-root'
                )
            ) {
                continue;
            }
            if (estado.evaluacionesBotonesAutoAbiertos.has(btn)) continue;

            const card = btn.closest(TARJETAS);
            if (!card || cardsVistas.has(card) || estaTarjetaBloqueada(card, btn)) continue;

            const esModulo = btn.matches(
                'button[id^="learning-module-title-"], [data-analytics-id="course.learning.module.base.item.toggleLm.button"]'
            );
            if (!esModulo && card.parentElement?.closest(TARJETAS)) continue;

            const cid = card.getAttribute('data-content-id') || '';
            if (cid && (estado.evaluacionesColapsadasUsuario.has(cid) || estado.evaluacionesModulosSinEval.has(cid))) {
                continue;
            }

            cardsVistas.add(card);
            candidatos.push({
                btn,
                card,
                cid,
                nombre: tituloEl(btn) || nombreCard(card)
            });
        }

        if (candidatos.length) {
            iniciarAutomatizacionVisual();

            const inspecciones = await Promise.all(
                candidatos.map(async item => {
                    if (RE.carpetaEvaluacion.test(item.nombre) || RE.moduloFinal.test(item.nombre)) {
                        return { ...item, info: { resultado: 'si', carpetasEvaluacionIds: [] } };
                    }
                    const info = await inspeccionarEvaluacionesEnContenedorApi(courseIdInicial, item.cid);
                    return { ...item, info };
                })
            );

            for (const { btn, card, cid, info } of inspecciones) {
                if (debeAbortar()) return;
                if (!btn.isConnected || !card.isConnected || btn.getAttribute('aria-expanded') !== 'false') {
                    continue;
                }
                if (cid && estado.evaluacionesColapsadasUsuario.has(cid)) continue;

                if (info.resultado === 'no') {
                    if (cid) estado.evaluacionesModulosSinEval.add(cid);
                    continue;
                }

                if (info.resultado === 'si') {
                    for (const subId of info.carpetasEvaluacionIds) {
                        if (subId) estado.evaluacionesCarpetasConEval.add(subId);
                    }
                    const hijosAntes = card.querySelectorAll(TARJETAS).length;
                    estado.evaluacionesBotonesAutoAbiertos.add(btn);
                    btn.click();

                    await esperarHijosContenedor(card, btn, hijosAntes);
                    if (debeAbortar()) return;
                    await expandirCarpetasEvaluacionVisibles();
                    if (debeAbortar()) return;
                    alActualizar?.();
                    continue;
                }

                // Respaldo cuando la API REST no está disponible: abrir, revisar hijos y volver a cerrar si no hay evaluaciones.
                const hijosAntes = card.querySelectorAll(TARJETAS).length;
                estado.evaluacionesBotonesAutoAbiertos.add(btn);
                btn.click();

                await esperarHijosContenedor(card, btn, hijosAntes);
                if (debeAbortar()) return;

                const hijos = [...card.querySelectorAll(TARJETAS)].filter(h => h !== card);
                const tieneEvaluacion = hijos.some(
                    h => esCarpetaEvaluacion(h) || esTarjetaEvaluacion(h)
                );

                if (tieneEvaluacion) {
                    await expandirCarpetasEvaluacionVisibles();
                    if (debeAbortar()) return;
                    alActualizar?.();
                } else {
                    if (btn.isConnected && btn.getAttribute('aria-expanded') === 'true') {
                        btn.click();
                        await dormir(120);
                    }
                    if (cid) estado.evaluacionesModulosSinEval.add(cid);
                }
            }
        }

        await promesaApiCurso;
        if (!debeAbortar()) {
            await expandirCarpetasEvaluacionVisibles();
            if (!debeAbortar()) alActualizar?.();
        }
    } finally {
        const reintentar = estado.evaluacionesReintentar;
        estado.evaluacionesEnCurso = false;
        estado.evaluacionesReintentar = false;

        if (estado.ocupado || !enVistaOutlineCurso()) {
            if (estado.evaluacionesTimerBackdrop) {
                clearTimeout(estado.evaluacionesTimerBackdrop);
                estado.evaluacionesTimerBackdrop = null;
            }
            estado.evaluacionesAutomatizacionActiva = false;
            alActualizar?.();
        } else if (reintentar) {
            if (estado.evaluacionesTimerBackdrop) {
                clearTimeout(estado.evaluacionesTimerBackdrop);
                estado.evaluacionesTimerBackdrop = null;
            }
            setTimeout(() => {
                desplegarEvaluacionesAutomaticamente(alActualizar, forzarApi);
            }, 350);
        } else if (courseIdInicial !== obtenerIdCursoActual()) {
            if (estado.evaluacionesTimerBackdrop) {
                clearTimeout(estado.evaluacionesTimerBackdrop);
                estado.evaluacionesTimerBackdrop = null;
            }
            estado.evaluacionesAutomatizacionActiva = false;
            alActualizar?.();
        } else {
            estado.evaluacionesAnalisisCompleto = true;
            if (
                automatizacionMostrada ||
                (estado.evaluacionesAutomatizacionActiva && !estado.evaluacionesTimerBackdrop)
            ) {
                if (estado.evaluacionesTimerBackdrop) {
                    clearTimeout(estado.evaluacionesTimerBackdrop);
                }
                estado.evaluacionesTimerBackdrop = setTimeout(() => {
                    estado.evaluacionesTimerBackdrop = null;
                    if (!estado.evaluacionesEnCurso && !estado.evaluacionesReintentar) {
                        estado.evaluacionesAutomatizacionActiva = false;
                        alActualizar?.();
                    }
                }, 450);
            } else if (!estado.evaluacionesAutomatizacionActiva) {
                alActualizar?.();
            }
        }
    }
}
