// Lectura del visor lateral/pantalla completa, extracción de enlaces tras hacer clic y cierre automático con el botón X.

import { CFG, TARJETAS, estado, verificarCancelacion } from './config.js';
import {
    dormir,
    texto,
    limpiarPrefijoXid,
    visible,
    esUrlExterna,
    esUrlScormOInteractivo,
    esRutaSpaBlackboard,
    urlReal,
    esperarHasta,
    obtenerIdCursoActual
} from './utils.js';
import { esVisorInteractivoUnity, enVistaDocumentoPantallaCompleta } from './interceptor.js';
import { extraerDocumentoViaApiBlackboard } from './api.js';
import {
    extraerBloquesDeDocumentPanel,
    esTarjetaScormOInteractiva,
    reconectarElementoRecurso
} from './scanner.js';

let fnRehidratarDom = null;

export function registrarRehidratador(fn) {
    fnRehidratarDom = fn;
}

function decodificarTildeBlackboard(raw) {
    if (!raw) return '';
    const limpia = String(raw).split('#')[0].trim();
    const normalizada = limpia.replace(/~([0-9A-Fa-f]{2})/g, '%$1');
    try {
        return decodeURIComponent(normalizada);
    } catch {
        return normalizada.replace(/%2F/gi, '/').replace(/%3A/gi, ':');
    }
}

function extraerToolHrefDeLaunchFrame(panel = null) {
    const candidatos = [];
    if (location?.href) candidatos.push(location.href);

    const raiz =
        panel ||
        document.querySelector('.bb-offcanvas-panel.active, .bb-offcanvas-panel') ||
        document;

    for (const el of raiz.querySelectorAll('[ng-href*="toolHref="], [href*="toolHref="], use')) {
        for (const attr of ['ng-href', 'href', 'xlink:href']) {
            const v = el.getAttribute(attr);
            if (v && v.includes('toolHref=')) {
                candidatos.push(v);
            }
        }
    }

    for (const rawUrl of candidatos) {
        try {
            const m = String(rawUrl).match(/[?&]toolHref=([^&#]+)/i);
            if (!m?.[1]) continue;
            const dec = decodificarTildeBlackboard(m[1]);
            const real = urlReal(dec);
            if (real) return real;
        } catch {
            // Ignorar URL inválida
        }
    }

    return '';
}

export function visor() {
    const docPanelPage = document.querySelector('document-panel');
    const scormPage = document.querySelector(
        'section.page-scorm-launch-frame, bb-scorm-launch-frame, learning-module-panel-view'
    );
    const launchFrameEl = document.querySelector('url-launch-frame');
    const urlLaunchVisible = Boolean(launchFrameEl && visible(launchFrameEl));

    const panel =
        (docPanelPage && visible(docPanelPage) ? docPanelPage : null) ||
        (scormPage && visible(scormPage) ? scormPage : null) ||
        document.querySelector('.bb-offcanvas-panel.active') ||
        document.querySelector('.ms-Panel.is-open, [class*="rootIsOpen_"]') ||
        launchFrameEl?.closest('.bb-offcanvas-panel, .ms-Panel');

    const esInteractivoUnity = esVisorInteractivoUnity();

    const esFullDocument =
        esInteractivoUnity ||
        panel?.tagName.toLowerCase() === 'document-panel' ||
        panel?.matches?.('section.page-scorm-launch-frame, bb-scorm-launch-frame, learning-module-panel-view') ||
        enVistaDocumentoPantallaCompleta();

    const iframe =
        panel?.querySelector(
            'iframe#scorm-launch-iframe, iframe#url-launch-iframe, iframe[src]:not([hidden]), iframe[data-maximus-src]'
        ) ||
        document.querySelector(
            '#scorm-launch-iframe, url-launch-frame #url-launch-iframe, #url-launch-iframe'
        );

    const toolHref = extraerToolHrefDeLaunchFrame(panel);

    const srcIframe =
        iframe?.dataset?.maximusSrc ||
        (iframe?.getAttribute('src') !== 'about:blank' ? iframe?.getAttribute('src') : '') ||
        iframe?.getAttribute('ng-src') ||
        toolHref ||
        estado.ultimaUrlIframeInterceptada ||
        '';

    const bloquesDoc = panel && !esInteractivoUnity ? extraerBloquesDeDocumentPanel(panel) : [];

    const enlacesDescarga =
        panel && !esInteractivoUnity
            ? [
                  ...panel.querySelectorAll(
                      'a[data-ally-file-preview-url], a[download], a[href*="bbcswebdav"], a[href*="isForcedDownload"], a[href*="download"], a[href$=".html"], a[href$=".htm"], a[target="_blank"][href^="http"], button[data-download-url]'
                  )
              ].filter(el =>
                  urlReal(
                      el.getAttribute('data-ally-file-preview-url') ||
                      el.getAttribute('href') ||
                      el.getAttribute('data-download-url')
                  )
              )
            : [];

    const enlaceDescargaPanel = enlacesDescarga[0] || null;

    const mediaPanel =
        panel && !esInteractivoUnity
            ? panel.querySelector('audio[src], video[src], audio source[src], video source[src]')
            : null;

    const cuerpoDocumento =
        panel && !esInteractivoUnity
            ? panel.querySelector(
                  '.bb-editor-root, .ql-editor, .bbml-editor, [data-analytics-id*="document"], .content_9896f174'
              )
            : null;

    const abierto =
        esInteractivoUnity ||
        enVistaDocumentoPantallaCompleta() ||
        /\/launchFrame\b/i.test(location.pathname) ||
        urlLaunchVisible ||
        (!!panel &&
            visible(panel) &&
            (esFullDocument ||
                panel.classList.contains('active') ||
                panel.classList.contains('is-open') ||
                /rootIsOpen_/i.test(panel.className)));

    return {
        iframe,
        srcIframe,
        panel,
        esFullDocument,
        esInteractivoUnity,
        bloquesDoc,
        enlacesDescarga,
        enlaceDescargaPanel,
        mediaPanel,
        cuerpoDocumento,
        abierto
    };
}

// Busca primero la X de la esquina superior izquierda (course.content.header.exit) o la X de offcanvas (.bb-close).
export function buscarBotonCerrarVisor(v) {
    const esBotonBanner = b => b?.getAttribute('data-analytics-id') === 'course.launch.frame.close.button';

    const candidatos = [
        document.querySelector('button[data-analytics-id="course.content.header.exit"]'),
        document.querySelector('button[data-analytics-id="course.content.scorm.launchFrame.exit"]'),
        document.querySelector('button[data-analytics-id="document.panel.exit"]'),
        document.querySelector('button.bb-close[data-close="bb-offcanvas"]'),
        document.querySelector('button[analytics-id="bb-close.courseCore.course.webLinkLaunchFrame.title"]'),
        document.querySelector('content-page-header button[aria-label="Salir"], content-page-header button[aria-label="Close"]'),
        document.querySelector('bb-readonly-panel-header button[aria-label="Salir"]'),
        ...(v.panel
            ? v.panel.querySelectorAll(
                  'button[data-analytics-id="course.content.header.exit"],' +
                  'button[data-analytics-id="course.content.scorm.launchFrame.exit"],' +
                  'button.bb-close[data-close="bb-offcanvas"],' +
                  'button.ms-Panel-closeButton,' +
                  'button[class*="closeButton_"],' +
                  'button[analytics-id="bb-close.courseCore.course.webLinkLaunchFrame.title"],' +
                  'button[aria-label="Salir"],' +
                  'button[aria-label="Cerrar"],' +
                  'button[aria-label="Close"]'
              )
            : []),
        document.querySelector('button.ms-Panel-closeButton, button[class*="closeButton_"]'),
        document.querySelector('a[data-analytics-id="course.content.header.breadcrumbs.course.link"]')
    ].filter(b => b && !esBotonBanner(b));

    return candidatos.find(b => visible(b)) || candidatos[0] || null;
}

export async function cerrarVisor(uLog, uActiva = null, pcActivo = null) {
    estado.ultimoInteractivoDetectado = false;
    estado.ultimaUrlIframeInterceptada = '';
    const v = visor();
    if (!v.abierto && !enVistaDocumentoPantallaCompleta()) return true;

    const eraFullDocument = v.esFullDocument || enVistaDocumentoPantallaCompleta();
    const teniaLaunchFrameUrl = /\/launchFrame\b/i.test(location.pathname);

    // Vaciamos los iframes (SCORM y launchFrame) para soltar memoria y evitar leer data-maximus-src viejos.
    for (const ifr of document.querySelectorAll(
        'iframe#scorm-launch-iframe, iframe#url-launch-iframe, iframe[src*="scor-scormengine"], iframe[data-maximus-src]'
    )) {
        delete ifr.dataset.maximusSrc;
        if (ifr.getAttribute('src') !== 'about:blank') {
            ifr.setAttribute('src', 'about:blank');
        }
    }

    const boton = buscarBotonCerrarVisor(v);

    if (boton) {
        boton.click();
    } else if (eraFullDocument || teniaLaunchFrameUrl) {
        history.back();
    } else {
        uLog?.log?.push('[VISOR] No se encontró la X de la esquina / Salir');
        return false;
    }

    let cerrado = await esperarHasta(
        () => {
            estado.ultimoInteractivoDetectado = false;
            return !visor().abierto && !enVistaDocumentoPantallaCompleta();
        },
        1800
    );

    if (!cerrado) {
        const overlay = document.querySelector('.bb-offcanvas-overlay');
        if (overlay && visible(overlay)) {
            overlay.click();
        }
        if (eraFullDocument || teniaLaunchFrameUrl || /\/launchFrame\b/i.test(location.pathname)) {
            history.back();
        }
        cerrado = await esperarHasta(
            () => {
                estado.ultimoInteractivoDetectado = false;
                return !visor().abierto && !enVistaDocumentoPantallaCompleta();
            },
            1800
        );
    }

    if (!cerrado) {
        const linkOutline = document.querySelector(
            'a[data-analytics-id="course.content.header.breadcrumbs.course.link"], a[data-analytics-id="course.l1.outline.link"]'
        );
        if (linkOutline) {
            linkOutline.click();
        } else if (eraFullDocument || /\/launchFrame\b/i.test(location.pathname)) {
            history.back();
        }
        cerrado = await esperarHasta(
            () => {
                estado.ultimoInteractivoDetectado = false;
                return !visor().abierto && !enVistaDocumentoPantallaCompleta();
            },
            3500
        );
    }

    if (eraFullDocument && !estado.cancelado && fnRehidratarDom) {
        await fnRehidratarDom(uActiva, pcActivo);
    } else if (eraFullDocument && estado.cancelado) {
        await esperarHasta(() => !!document.querySelector(TARJETAS), 6000);
    }

    return cerrado;
}

export async function asegurarElementoEnDom(r, uActiva, uLog, pcActivo) {
    if (enVistaDocumentoPantallaCompleta() || visor().abierto) {
        await cerrarVisor(uLog, uActiva, pcActivo);
    }

    let el = reconectarElementoRecurso(r, uActiva);
    if (el?.isConnected) return el;

    if (uActiva && fnRehidratarDom) {
        await fnRehidratarDom(uActiva, pcActivo);
    }

    await esperarHasta(() => {
        el = reconectarElementoRecurso(r, uActiva);
        return !!el?.isConnected;
    }, 5500);

    return reconectarElementoRecurso(r, uActiva);
}

// Intenta sacar el recurso por API REST primero; si no alcanza, hace clic en el ítem del DOM y lee el visor que abre Blackboard.
export async function capturarClic(r, uLog, uActiva = null, pcActivo = null, saltarApi = false) {
    verificarCancelacion();

    const courseId = obtenerIdCursoActual();
    const docId =
        r.contentId ||
        r.hrefOriginal?.match(/\/(?:document|scorm\/overview)\/(_\d+_\d+)/i)?.[1] ||
        '';

    if (!saltarApi && courseId && docId) {
        const viaApi = await extraerDocumentoViaApiBlackboard(courseId, docId, r.nombre);
        if (viaApi && viaApi.length > 0) {
            if (viaApi[0]?.omitidoInteractivo) {
                return viaApi;
            }
            uLog?.log?.push(`[NINJA API] ${r.nombre} extraído sin cambiar de pantalla (${viaApi.length} elementos)`);
            return viaApi.map(item => ({ ...item, viaApi: true }));
        }
    }

    if (
        r.url &&
        (esUrlExterna(r.url) || /\.html?(?:$|[?#])/i.test(r.url) || !esRutaSpaBlackboard(r.url))
    ) {
        return [{ url: r.url, nombre: r.nombre }];
    }

    await asegurarElementoEnDom(r, uActiva, uLog, pcActivo);

    if (!r.el?.isConnected) {
        throw new Error('El enlace ya no existe en el DOM');
    }

    if (esTarjetaScormOInteractiva(r.tarjeta, r.el, r.nombre, r.carpetas || [])) {
        return [{ omitidoInteractivo: true }];
    }

    const hrefDirectoEl = r.el.getAttribute('href') || '';
    if (hrefDirectoEl && esUrlScormOInteractivo(hrefDirectoEl)) {
        return [{ omitidoInteractivo: true }];
    }
    if (hrefDirectoEl && !esRutaSpaBlackboard(hrefDirectoEl)) {
        const urlDirecta = urlReal(hrefDirectoEl);
        if (urlDirecta) {
            return [{ url: urlDirecta, nombre: r.nombre }];
        }
    }

    if (!(await cerrarVisor(uLog, uActiva, pcActivo))) {
        throw new Error('No se pudo cerrar el visor anterior');
    }

    verificarCancelacion();
    await asegurarElementoEnDom(r, uActiva, uLog, pcActivo);

    const anterior = visor();
    const srcAntes = anterior.srcIframe || '';
    estado.ultimaUrlIframeInterceptada = '';
    estado.ultimoInteractivoDetectado = false;

    r.el.click();

    const valido = await esperarHasta(() => {
        if (esVisorInteractivoUnity()) return true;
        if (estado.ultimaUrlIframeInterceptada) return true;

        const v = visor();
        const src =
            v.enlaceDescargaPanel?.getAttribute('data-ally-file-preview-url') ||
            v.enlaceDescargaPanel?.getAttribute('href') ||
            v.enlaceDescargaPanel?.getAttribute('data-download-url') ||
            v.mediaPanel?.getAttribute('src') ||
            v.srcIframe;

        return !!(
            enVistaDocumentoPantallaCompleta() ||
            (v.abierto &&
                (v.esFullDocument ||
                    v.bloquesDoc?.length ||
                    (src && (src !== srcAntes || !anterior.abierto)) ||
                    v.cuerpoDocumento))
        );
    }, CFG.ESPERA_VISOR);

    verificarCancelacion();

    // Si al abrir el ítem resultó ser un paquete de Unity o SCORM, pulsamos la X de inmediato y lo saltamos.
    if (esVisorInteractivoUnity() || visor().esInteractivoUnity || esUrlScormOInteractivo(visor().srcIframe)) {
        uLog?.log?.push(`[UNITY/SCORM] Detectado en "${r.nombre}" -> Presionando la X de la esquina para salir`);
        await cerrarVisor(uLog, uActiva, pcActivo);
        return [{ omitidoInteractivo: true }];
    }

    if (!valido && estado.ultimaUrlIframeInterceptada) {
        const urlCapturada = estado.ultimaUrlIframeInterceptada;
        if (visor().abierto || enVistaDocumentoPantallaCompleta()) {
            await cerrarVisor(uLog, uActiva, pcActivo);
        }
        return [{ url: urlCapturada, nombre: r.nombre }];
    }

    if (!valido) {
        throw new Error('Blackboard no abrió el visor de descarga');
    }

    if (estado.ultimaUrlIframeInterceptada && !visor().abierto && !enVistaDocumentoPantallaCompleta()) {
        const urlCapturada = estado.ultimaUrlIframeInterceptada;
        estado.ultimaUrlIframeInterceptada = '';
        return [{ url: urlCapturada, nombre: r.nombre }];
    }

    if (visor().esFullDocument || enVistaDocumentoPantallaCompleta() || r.esDocUltra) {
        await esperarHasta(() => {
            if (esVisorInteractivoUnity()) return true;
            const docPanel = document.querySelector('document-panel') || visor().panel;
            if (!docPanel) return false;
            const cargando = docPanel.querySelector('[class*="progressContainer"], .ms-Spinner');
            if (cargando) return false;
            const bloques = extraerBloquesDeDocumentPanel(docPanel);
            if (bloques.length > 0) return true;
            const regionesArchivo = docPanel.querySelectorAll('[role="region"][aria-label="Archivo"]');
            if (regionesArchivo && regionesArchivo.length > 0) return false;
            const editor = docPanel.querySelector('.bbml-editor, .ql-editor');
            return !!(editor && texto(editor.textContent).length > 20);
        }, 8000);

        await dormir(350);
    } else {
        await esperarHasta(() => {
            if (esVisorInteractivoUnity()) return true;
            const v = visor();
            return !!(
                v.bloquesDoc?.length ||
                v.enlaceDescargaPanel ||
                v.mediaPanel ||
                v.srcIframe
            );
        }, 1800);
    }

    verificarCancelacion();

    if (esVisorInteractivoUnity() || visor().esInteractivoUnity || esUrlScormOInteractivo(visor().srcIframe)) {
        uLog?.log?.push(`[UNITY/SCORM] Detectado en "${r.nombre}" -> Presionando la X de la esquina para salir`);
        await cerrarVisor(uLog, uActiva, pcActivo);
        return [{ omitidoInteractivo: true }];
    }

    if (document.querySelector('url-launch-frame') && !visor().srcIframe && !estado.ultimaUrlIframeInterceptada) {
        const btnNuevaVentana = document.querySelector(
            'button[data-analytics-id="courseCore.course.webLinkLaunchFrame.openInNewWindow"]'
        );
        if (btnNuevaVentana) {
            btnNuevaVentana.click();
            await esperarHasta(() => !!estado.ultimaUrlIframeInterceptada, 1200);
        }
    }

    verificarCancelacion();

    const v = visor();
    let resultadoCaptura = null;

    const bloquesExtraidos = extraerBloquesDeDocumentPanel(v.panel || document);
    if (bloquesExtraidos.length) {
        resultadoCaptura = bloquesExtraidos.map(b => ({
            url: b.url,
            nombre: b.nombreArchivoSugerido || b.nombre,
            subCarpeta: b.nombre
        }));
    }

    if (!resultadoCaptura && v.enlacesDescarga?.length) {
        const items = v.enlacesDescarga
            .map(el => ({
                url: urlReal(
                    el.getAttribute('data-ally-file-preview-url') ||
                    el.getAttribute('href') ||
                    el.getAttribute('data-download-url')
                ),
                nombre: limpiarPrefijoXid(
                    el.getAttribute('data-ally-file-eid') ||
                    el.getAttribute('download') ||
                    r.nombre
                )
            }))
            .filter(x => x.url);

        if (items.length) resultadoCaptura = items;
    }

    if (!resultadoCaptura) {
        const directo =
            v.enlaceDescargaPanel?.getAttribute('data-ally-file-preview-url') ||
            v.enlaceDescargaPanel?.getAttribute('href') ||
            v.enlaceDescargaPanel?.getAttribute('data-download-url') ||
            v.mediaPanel?.getAttribute('src');

        if (directo && urlReal(directo)) {
            resultadoCaptura = [{ url: urlReal(directo), nombre: r.nombre }];
        }
    }

    if (!resultadoCaptura) {
        const urlIframe = urlReal(v.srcIframe);
        if (urlIframe) {
            resultadoCaptura = [{ url: urlIframe, nombre: r.nombre }];
        }
    }

    if (!resultadoCaptura) {
        try {
            const docIframe = v.iframe?.contentDocument;
            if (docIframe) {
                if (docIframe.querySelector('#unity-container, #unity-canvas, canvas[id*="unity" i]')) {
                    uLog?.log?.push(`[UNITY/SCORM] Canvas Unity detectado en "${r.nombre}" -> Presionando la X`);
                    await cerrarVisor(uLog, uActiva, pcActivo);
                    return [{ omitidoInteractivo: true }];
                }

                const internos = [
                    ...docIframe.querySelectorAll(
                        'a[download], a[href*="bbcswebdav"], audio[src], video[src], source[src], embed[src]'
                    )
                ]
                    .map(el => ({
                        url: urlReal(el.getAttribute('href') || el.getAttribute('src'), location.href),
                        nombre: r.nombre
                    }))
                    .filter(x => x.url);

                if (internos.length) {
                    resultadoCaptura = internos;
                }
            }
        } catch {
            // Iframe en otro dominio bloqueado por políticas del navegador.
        }
    }

    if (!resultadoCaptura) {
        const contenedorTexto = v.panel || document.querySelector('document-panel');
        if (contenedorTexto) {
            const parrafos = [...contenedorTexto.querySelectorAll('.ql-editor, .bbml-editor')]
                .map(ed => (ed.innerText || ed.textContent || '').trim())
                .filter(Boolean)
                .join('\r\n\r\n');

            const contenidoTxt =
                parrafos ||
                texto(v.cuerpoDocumento?.innerText || v.cuerpoDocumento?.textContent || '');
            if (contenidoTxt && contenidoTxt.length > 5) {
                resultadoCaptura = [{ textoPlano: contenidoTxt }];
            }
        }
    }

    if (resultadoCaptura) {
        if (visor().abierto || enVistaDocumentoPantallaCompleta()) {
            await cerrarVisor(uLog, uActiva, pcActivo);
        }
        return resultadoCaptura;
    }

    throw new Error('El visor no tiene archivo descargable');
}
