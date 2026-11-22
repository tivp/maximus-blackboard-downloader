// Estilos CSS, barra de progreso por bloques, colores de estado en filas, notificación flotante de evaluaciones y botonera sin logos.

import { TARJETAS, estado } from './config.js';
import { texto, tituloEl } from './utils.js';
import {
    esTarjetaEvaluacion,
    esElementoEvaluacionEnNodo,
    obtenerContenedorFilaEvaluacion,
    enVistaOutlineCurso,
    nombreCard
} from './scanner.js';

export function cambiarTextoBoton(boton, etiqueta) {
    if (!boton) return;
    let span = boton.querySelector('.maximus-boton-texto');
    if (!span) {
        boton.innerHTML = '<span class="maximus-boton-texto"></span>';
        span = boton.querySelector('.maximus-boton-texto');
    }
    span.textContent = etiqueta;
}

export function obtenerTextoBoton(boton) {
    if (!boton) return '';
    const span = boton.querySelector('.maximus-boton-texto');
    return span ? span.textContent : boton.textContent;
}

export async function copiarTextoPortapapeles(contenido) {
    if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(contenido, 'text');
        return;
    }
    try {
        await navigator.clipboard.writeText(contenido);
    } catch {
        const area = document.createElement('textarea');
        area.value = contenido;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
    }
}

export function inyectarCss() {
    let style = document.getElementById('maximus-css');
    if (!style) {
        style = document.createElement('style');
        style.id = 'maximus-css';
        document.head.append(style);
    }

    style.textContent = `
        .maximus-panel {
            position: absolute !important;
            z-index: 9 !important;
            display: grid !important;
            grid-template-columns: max-content minmax(0,1fr);
            align-items: center;
            gap: 4px 8px;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 75% !important;
            min-width: min(470px, calc(100% - var(--maximus-left,0px) - 12px)) !important;
            max-width: calc(100% - var(--maximus-left,0px) - 12px) !important;
            border: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            color: #26394b;
            font: 12px Arial,sans-serif;
        }

        .maximus-panel.maximus-flujo {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            right: auto !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            margin-top: 8px !important;
        }

        .maximus-panel.maximus-panel-curso {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            right: auto !important;
            flex: 1 1 420px !important;
            width: auto !important;
            min-width: 280px !important;
            max-width: 680px !important;
            margin: 0 14px !important;
        }

        header.outline-header > div {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            gap: 8px 12px !important;
        }

        #course-content-outline-header-text {
            flex: 0 0 auto !important;
            margin-right: 4px !important;
        }

        .maximus-boton,
        .maximus-barra {
            height: 32px !important;
            min-height: 32px !important;
            max-height: 32px !important;
            box-sizing: border-box !important;
            margin: 0 !important;
        }

        .maximus-boton {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
            padding: 0 11px !important;
            background: #fff !important;
            border: 1px solid #718399 !important;
            border-radius: 4px;
            color: #26394b !important;
            white-space: nowrap;
            cursor: pointer;
            font: 600 12px Arial,sans-serif !important;
            transition: background-color .15s, border-color .15s, color .15s;
        }

        .maximus-boton.listo {
            background: #e8f8ee !important;
            border-color: #29aa59 !important;
            color: #166534 !important;
        }

        .maximus-boton.detener {
            background: #fee2e2 !important;
            border-color: #dc2626 !important;
            color: #991b1b !important;
            cursor: pointer !important;
        }

        .maximus-boton.detener:hover {
            background: #fecaca !important;
        }

        .maximus-boton:disabled {
            opacity: .55;
            cursor: not-allowed;
        }

        .maximus-barra {
            display: flex !important;
            gap: 0 !important;
            padding: 0 !important;
            min-width: 0;
            position: relative;
            overflow: hidden;
            border: 1px solid #afbfcc;
            border-radius: 4px;
            background: #e8edf2;
        }

        .maximus-pieza {
            flex: 1 1 0;
            min-width: 0;
            height: 100%;
            padding: 0 !important;
            margin: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: #dbe3eb;
            transition: background-color .15s;
        }

        .maximus-pieza.ok { background: #4dc86e !important; }
        .maximus-pieza.error { background: #ea5151 !important; }
        .maximus-pieza.omitido { background: #96a0ab !important; }
        .maximus-pieza.procesando { background: #f0c34f !important; }

        .maximus-pct {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            color: #23394d;
            font: bold 11px Arial,sans-serif;
            text-shadow: 0 1px 2px #fff;
        }

        .maximus-estado {
            grid-column: 1/-1;
            color: #52708b;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font: 11px Arial,sans-serif;
        }

        .maximus-log {
            grid-column: 1/-1;
            justify-self: start;
            padding: 0;
            border: 0;
            background: transparent !important;
            color: #26618f;
            cursor: pointer;
            text-decoration: underline;
            font: 11px Arial,sans-serif;
        }

        .maximus-fila-evaluacion {
            background: #fff7cc !important;
            border: 1px solid #f0dd8c !important;
            box-shadow: inset 4px 0 0 #e5b82e !important;
            border-radius: 6px !important;
            transition: background-color .15s, border-color .15s, box-shadow .15s;
        }

        .maximus-fila-evaluacion:hover,
        .maximus-fila-evaluacion:focus-within {
            background: #ffefad !important;
            border-color: #e6c95c !important;
            box-shadow: inset 4px 0 0 #d4a11a !important;
        }

        .maximus-fila-evaluacion a,
        .maximus-fila-evaluacion button {
            background-color: transparent !important;
        }

        .maximus-fila-ok,
        .maximus-fila-ok:hover,
        .maximus-fila-ok:focus-within {
            background: #d8f7df !important;
            box-shadow: inset 4px 0 #29aa59 !important;
            border-radius: 4px !important;
        }

        .maximus-fila-error,
        .maximus-fila-error:hover,
        .maximus-fila-error:focus-within {
            background: #ffe0e0 !important;
            box-shadow: inset 4px 0 #d33f45 !important;
            border-radius: 4px !important;
        }

        .maximus-fila-omitido,
        .maximus-fila-omitido:hover {
            background: #eef1f4 !important;
            box-shadow: inset 4px 0 #9aa5b1 !important;
            border-radius: 4px !important;
        }

        .maximus-fila-ok a,
        .maximus-fila-ok button,
        .maximus-fila-error a,
        .maximus-fila-error button {
            background: transparent !important;
        }

        .maximus-fila-evaluacion-destello {
            background: #ffea9f !important;
            border-color: #d4a11a !important;
            box-shadow: inset 4px 0 0 #d4a11a, 0 0 0 3px rgba(229, 184, 46, 0.55) !important;
        }

        .maximus-eval-backdrop {
            position: fixed !important;
            inset: 0 !important;
            z-index: 2147483645 !important;
            background: rgba(10, 14, 23, 0.56) !important;
            backdrop-filter: blur(6px) !important;
            -webkit-backdrop-filter: blur(6px) !important;
            opacity: 0 !important;
            pointer-events: none !important;
            transition: opacity .25s ease !important;
        }

        .maximus-eval-backdrop.activo {
            opacity: 1 !important;
            pointer-events: auto !important;
        }

        .maximus-eval-notif {
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            z-index: 2147483646 !important;
            width: min(390px, calc(100vw - 32px)) !important;
            max-height: min(75vh, 520px) !important;
            display: flex !important;
            flex-direction: column !important;
            box-sizing: border-box !important;
            padding: 13px 16px 13px 18px !important;
            background: #fff7cc !important;
            border: 1px solid #f0dd8c !important;
            box-shadow: inset 4px 0 0 #e5b82e, 0 14px 34px rgba(15, 23, 42, 0.28) !important;
            border-radius: 8px !important;
            color: #26394b !important;
            font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif !important;
            transition: top .2s ease, left .2s ease, right .2s ease, transform .2s ease, box-shadow .2s ease !important;
        }

        .maximus-eval-notif.en-automatizacion {
            top: 84px !important;
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            box-shadow: inset 4px 0 0 #e5b82e, 0 22px 48px rgba(0, 0, 0, 0.45) !important;
        }

        .maximus-eval-notif-cabecera {
            display: flex !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 8px !important;
            padding-right: 24px !important;
        }

        .maximus-eval-notif-titulo {
            margin: 0 !important;
            padding: 0 !important;
            font-weight: 700 !important;
            font-size: 13px !important;
            line-height: 1.35 !important;
            color: #26394b !important;
        }

        .maximus-eval-notif-cerrar {
            position: absolute !important;
            top: 8px !important;
            right: 8px !important;
            width: 24px !important;
            height: 24px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            margin: 0 !important;
            border: 1px solid transparent !important;
            border-radius: 4px !important;
            background: transparent !important;
            color: #5c4b12 !important;
            font: 700 16px/1 Arial, sans-serif !important;
            cursor: pointer !important;
            transition: background-color .15s, border-color .15s, color .15s !important;
        }

        .maximus-eval-notif-cerrar:hover,
        .maximus-eval-notif-cerrar:focus-visible {
            background: rgba(229, 184, 46, 0.25) !important;
            border-color: #e6c95c !important;
            color: #26394b !important;
        }

        .maximus-eval-notif-estado {
            margin-top: 6px !important;
            font-size: 12px !important;
            color: #6e5714 !important;
        }

        .maximus-eval-notif-estado[hidden],
        .maximus-eval-notif-lista[hidden] {
            display: none !important;
        }

        .maximus-eval-notif-lista {
            margin: 8px 0 0 0 !important;
            padding: 0 !important;
            list-style: none !important;
            overflow-y: auto !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 6px !important;
        }

        .maximus-eval-notif-item {
            display: flex !important;
            align-items: baseline !important;
            gap: 6px !important;
            padding: 4px 8px !important;
            border-radius: 5px !important;
            background: rgba(255, 255, 255, 0.58) !important;
            border: 1px solid rgba(240, 221, 140, 0.75) !important;
        }

        .maximus-eval-notif-num {
            font-weight: 700 !important;
            color: #7a5c00 !important;
            min-width: 18px !important;
            flex: 0 0 auto !important;
        }

        .maximus-eval-notif-link {
            color: #0969da !important;
            font-weight: 600 !important;
            text-decoration: none !important;
            word-break: break-word !important;
            cursor: pointer !important;
        }

        .maximus-eval-notif-link:hover,
        .maximus-eval-notif-link:focus-visible {
            text-decoration: underline !important;
            color: #0550ae !important;
        }

        .maximus-eval-notif-seccion {
            margin-top: 8px !important;
            padding-top: 7px !important;
            border-top: 1px dashed rgba(180, 134, 11, 0.35) !important;
        }

        .maximus-eval-notif-subtitulo {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 8px !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            color: #5c4000 !important;
            margin: 0 0 4px 0 !important;
        }

        .maximus-eval-notif-contador {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-width: 18px !important;
            height: 18px !important;
            padding: 0 6px !important;
            border-radius: 999px !important;
            background: rgba(180, 134, 11, 0.16) !important;
            color: #5c4000 !important;
            font-size: 11px !important;
            font-weight: 700 !important;
        }

        .maximus-eval-notif-contador.ok {
            background: rgba(26, 127, 55, 0.14) !important;
            color: #116329 !important;
        }

        .maximus-eval-notif-vacio {
            display: block !important;
            font-size: 12px !important;
            font-style: italic !important;
            color: #7c5c0a !important;
            padding: 2px 0 2px 4px !important;
        }

        .maximus-eval-notif-vacio[hidden],
        .maximus-eval-notif-lista[hidden] {
            display: none !important;
        }

        .maximus-eval-notif-check {
            color: #1a7f37 !important;
            font-weight: 700 !important;
            font-size: 12px !important;
            flex: 0 0 auto !important;
        }

        @media (max-width: 650px) {
            .maximus-panel {
                grid-template-columns: 1fr !important;
                width: calc(100% - 24px) !important;
                min-width: 0 !important;
                max-width: calc(100% - 24px) !important;
            }
            .maximus-estado,
            .maximus-log {
                grid-column: 1 !important;
            }
        }
    `;
}

export function progreso(u, n, total, mensaje) {
    if (!u?.pct || !u?.estado) return;
    u.pct.textContent = `${total ? Math.round((n / total) * 100) : 0}%`;
    u.estado.textContent = mensaje;
    u.estado.title = mensaje;
}

export function crearPiezas(u, items) {
    if (!u?.barra) return;
    u.barra.querySelectorAll('.maximus-pieza').forEach(x => x.remove());

    u.estadosPiezas = items.map(r => ({ nombre: r.nombre, estado: '' }));

    u.piezas = items.map((r, i) => {
        const x = document.createElement('span');
        x.className = 'maximus-pieza';
        x.title = `${i + 1}. ${r.nombre}: pendiente`;
        u.barra.insertBefore(x, u.pct);
        return x;
    });
}

export function pieza(u, i, estadoPieza, nombre) {
    if (!u) return;
    if (u.estadosPiezas?.[i]) {
        u.estadosPiezas[i].estado = estadoPieza;
        u.estadosPiezas[i].nombre = nombre;
    }
    if (!u.piezas?.[i]) return;
    u.piezas[i].className = `maximus-pieza ${estadoPieza}`;
    u.piezas[i].title = `${i + 1}. ${nombre}: ${estadoPieza}`;
}

export function filaRecurso(it) {
    if (it.contentId && (!it.tarjeta || !it.tarjeta.isConnected)) {
        it.tarjeta = document.querySelector(`.content-list-item[data-content-id="${it.contentId}"]`);
    }

    const card = it.tarjeta;
    if (card) {
        const fila = card.querySelector(
            ':scope > .outline-item-inner,' +
            ':scope > [class*="itemContainer"],' +
            ':scope > .click-to-invoke-container'
        );
        if (fila) return fila;
    }

    return (
        it.el?.closest(
            '.outline-item-inner,.click-to-invoke-container,[class*="itemContainer"],[role="region"][aria-label="Archivo"]'
        ) ||
        card ||
        it.el
    );
}

export function colorear(it, estadoFila, detalle) {
    if (it.contentId) {
        estado.estadoFilas.set(it.contentId, { estado: estadoFila, detalle });
    }

    const fila = filaRecurso(it);
    if (!fila) return;

    fila.classList.remove('maximus-fila-ok', 'maximus-fila-error', 'maximus-fila-omitido');
    fila.classList.add(`maximus-fila-${estadoFila}`);
    fila.title = detalle;
}

export function restaurarColoresFilas() {
    for (const [clave, info] of estado.estadoFilas.entries()) {
        const card = document.querySelector(`.content-list-item[data-content-id="${clave}"]`);
        if (card) {
            const fila =
                card.querySelector(
                    ':scope > .outline-item-inner, :scope > [class*="itemContainer"], :scope > .click-to-invoke-container'
                ) || card;
            fila.classList.remove('maximus-fila-ok', 'maximus-fila-error', 'maximus-fila-omitido');
            fila.classList.add(`maximus-fila-${info.estado}`);
            fila.title = info.detalle;
        }
    }
}

export function limpiarPanelesEnVistaDocumento() {
    document.querySelectorAll('.maximus-panel, .maximus-eval-backdrop, .maximus-eval-notif').forEach(p => p.remove());
}

const selectorIgnorarEval =
    '.js-review-state-icon-button,' +
    '[id^="content-item-overflow-menu-button-"],' +
    '[data-analytics-id="components.common.conditional-release-info.buttonBase"],' +
    '[aria-haspopup],' +
    '[data-maximus]';

let timerDestelloEval = null;

export function obtenerTituloEvaluacion(fila, card = null) {
    const raiz = card || fila;
    if (!raiz) return 'Evaluación';

    const selectores = [
        '[data-analytics-id*="gradebook.item"]',
        'a[href*="/assessment/"], a[href*="/assignment/"], button[href*="/assessment/"]',
        '.ax-focusable-title',
        'a[href], button'
    ];

    let crudo = '';
    for (const sel of selectores) {
        const candidato = [...raiz.querySelectorAll(sel)].find(
            el =>
                !el.closest(selectorIgnorarEval) &&
                !el.matches(selectorIgnorarEval) &&
                (!card || el.closest(TARJETAS) === card)
        );
        if (candidato) {
            const t = tituloEl(candidato);
            if (t) {
                crudo = t;
                break;
            }
        }
    }

    if (!crudo && card) {
        crudo = nombreCard(card);
    }
    if (!crudo) {
        crudo = tituloEl(fila);
    }

    const limpio = texto(crudo).replace(
        /^(?:examen|prueba|evaluaci[oó]n|cuestionario|actividad|tarea|test|exam|quiz|assignment)\s*,\s*/i,
        ''
    );

    return limpio || 'Evaluación';
}

export function generarHashIdEvaluacion(titulo, idx, usados = new Set()) {
    const slug = texto(titulo)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);

    const base = `maximus-eval-${idx + 1}${slug ? `-${slug}` : ''}`;
    let id = base;
    let n = 2;
    while (usados.has(id)) {
        id = `${base}-${n++}`;
    }
    usados.add(id);
    return id;
}

function desplazarContenedoresAncestrosEval(destino) {
    let cur = destino?.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
        try {
            const st = getComputedStyle(cur);
            const overflowY = st?.overflowY || '';
            if (/(?:auto|scroll)/.test(overflowY) && cur.scrollHeight > cur.clientHeight + 4) {
                const cRect = cur.getBoundingClientRect();
                const dRect = destino.getBoundingClientRect();
                const delta = dRect.top - cRect.top - cur.clientHeight / 2 + dRect.height / 2;
                const nuevoTop = Math.max(0, (cur.scrollTop || 0) + delta);
                if (typeof cur.scrollTo === 'function') {
                    cur.scrollTo({ top: nuevoTop, behavior: 'smooth' });
                } else {
                    cur.scrollTop = nuevoTop;
                }
            }
        } catch {
            // Ignorar contenedores sin métricas de desplazamiento
        }
        cur = cur.parentElement;
    }
}

export function cerrarNotificacionEvaluaciones(marcarCerradaUsuario = true) {
    if (marcarCerradaUsuario) {
        estado.evaluacionesNotificacionCerrada = true;
    }
    if (estado.evaluacionesTimerBackdrop) {
        clearTimeout(estado.evaluacionesTimerBackdrop);
        estado.evaluacionesTimerBackdrop = null;
    }
    estado.evaluacionesAutomatizacionActiva = false;
    document.querySelectorAll('.maximus-eval-backdrop, .maximus-eval-notif').forEach(el => el.remove());
}

export function establecerEstadoAutomatizacionEvaluaciones(activo, alRevalidar = null) {
    if (activo) {
        if (estado.evaluacionesTimerBackdrop) {
            clearTimeout(estado.evaluacionesTimerBackdrop);
            estado.evaluacionesTimerBackdrop = null;
        }
        estado.evaluacionesAutomatizacionActiva = true;
        (alRevalidar || marcarEvaluaciones)();
        return;
    }

    if (estado.evaluacionesTimerBackdrop) {
        clearTimeout(estado.evaluacionesTimerBackdrop);
    }
    estado.evaluacionesTimerBackdrop = setTimeout(() => {
        estado.evaluacionesTimerBackdrop = null;
        estado.evaluacionesAutomatizacionActiva = false;
        (alRevalidar || marcarEvaluaciones)();
    }, 450);
}

export function irAEvaluacionHash(hashId) {
    if (!hashId) return;

    if (estado.evaluacionesTimerBackdrop) {
        clearTimeout(estado.evaluacionesTimerBackdrop);
        estado.evaluacionesTimerBackdrop = null;
    }
    estado.evaluacionesAutomatizacionActiva = false;

    const backdrop = document.querySelector('.maximus-eval-backdrop');
    if (backdrop) backdrop.classList.remove('activo');

    const notif = document.querySelector('.maximus-eval-notif');
    if (notif) {
        notif.classList.remove('en-automatizacion');
        const estadoEl = notif.querySelector('.maximus-eval-notif-estado');
        if (estadoEl) estadoEl.hidden = true;
    }

    try {
        if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
            history.replaceState(null, '', `#${hashId}`);
        } else if (typeof location !== 'undefined') {
            location.hash = hashId;
        }
    } catch {
        // Ignorar si la página bloquea modificar el hash
    }

    let destino =
        document.querySelector(`[data-maximus-eval-id="${hashId}"]`) ||
        document.getElementById(hashId);

    if (!destino) return;

    const ancestrosPorAbrir = [];
    for (let p = destino.parentElement?.closest(TARJETAS); p; p = p.parentElement?.closest(TARJETAS)) {
        const btnColapsado = [
            ...p.querySelectorAll('button[aria-expanded="false"], [role="button"][aria-expanded="false"]')
        ].find(b => b.closest(TARJETAS) === p && !b.disabled && b.getAttribute('aria-disabled') !== 'true');
        if (btnColapsado) ancestrosPorAbrir.unshift(btnColapsado);
    }
    for (const btn of ancestrosPorAbrir) {
        try {
            btn.click();
        } catch {
            // Ignorar
        }
    }

    destino =
        document.querySelector(`[data-maximus-eval-id="${hashId}"]`) ||
        document.getElementById(hashId) ||
        destino;

    desplazarContenedoresAncestrosEval(destino);
    try {
        destino.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch {
        destino.scrollIntoView?.();
    }

    if (timerDestelloEval) {
        clearTimeout(timerDestelloEval);
    }
    document
        .querySelectorAll('.maximus-fila-evaluacion-destello')
        .forEach(el => el.classList.remove('maximus-fila-evaluacion-destello'));

    destino.classList.add('maximus-fila-evaluacion-destello');
    timerDestelloEval = setTimeout(() => {
        destino.classList.remove('maximus-fila-evaluacion-destello');
        timerDestelloEval = null;
    }, 1800);
}

export function esEvaluacionCompletada(fila, card = null) {
    const raiz = card || fila;
    if (!raiz) return false;

    const perteneceATarjeta = el => {
        if (!card) return true;
        const tarjetaCercana = el.closest(TARJETAS);
        return !tarjetaCercana || tarjetaCercana === card;
    };

    const botonesEstado = raiz.querySelectorAll(
        '.js-review-state-icon-button, button[role="checkbox"][data-analytics-id*="review-state"], button[role="checkbox"][aria-label*="Estado de"]'
    );
    for (const btn of botonesEstado) {
        if (!perteneceATarjeta(btn)) continue;
        const ariaChecked = (btn.getAttribute('aria-checked') || '').trim().toLowerCase();
        if (ariaChecked === 'true') return true;
        if (ariaChecked === 'false' || ariaChecked === 'mixed') return false;

        const label = texto(btn.getAttribute('aria-label') || '');
        if (/:\s*completad[oa]\b/i.test(label)) return true;
        if (/:\s*(?:iniciad[oa]|sin\s+iniciar|no\s+iniciad[oa])\b/i.test(label)) return false;

        if (btn.querySelector('svg[class*="completed"]')) return true;
    }

    const svgsCompletados = raiz.querySelectorAll('svg[class*="makeStylescompleted"], [role="checkbox"] svg[class*="completed"]');
    for (const svg of svgsCompletados) {
        if (perteneceATarjeta(svg)) return true;
    }

    return false;
}

export function actualizarNotificacionEvaluaciones(items = []) {
    if (estado.ocupado || estado.evaluacionesNotificacionCerrada || !enVistaOutlineCurso()) {
        document.querySelectorAll('.maximus-eval-backdrop, .maximus-eval-notif').forEach(el => el.remove());
        return;
    }

    const enAutomatizacion = Boolean(estado.evaluacionesAutomatizacionActiva);

    if (!items.length && !enAutomatizacion) {
        document.querySelectorAll('.maximus-eval-backdrop, .maximus-eval-notif').forEach(el => el.remove());
        return;
    }

    const contenedorRaiz = document.body || document.documentElement;
    if (!contenedorRaiz) return;

    let backdrop = document.querySelector('.maximus-eval-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.className = 'maximus-eval-backdrop';
        backdrop.dataset.maximus = 'eval-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');
        contenedorRaiz.append(backdrop);
    }
    if (enAutomatizacion) {
        backdrop.classList.add('activo');
    } else {
        backdrop.classList.remove('activo');
    }

    let notif = document.querySelector('.maximus-eval-notif');
    if (notif && !notif.querySelector('.maximus-eval-notif-lista-pendientes')) {
        notif.remove();
        notif = null;
    }
    if (!notif) {
        notif = document.createElement('div');
        notif.className = 'maximus-eval-notif';
        notif.dataset.maximus = 'eval-notif';
        notif.setAttribute('role', 'region');
        notif.setAttribute('aria-label', 'Índice de evaluaciones');

        notif.innerHTML = `
            <div class="maximus-eval-notif-cabecera">
                <div class="maximus-eval-notif-titulo">Índice de evaluaciones</div>
                <button class="maximus-eval-notif-cerrar" type="button" aria-label="Cerrar notificación" title="Cerrar">&times;</button>
            </div>
            <div class="maximus-eval-notif-estado" hidden>Buscando y desplegando evaluaciones...</div>
            <div class="maximus-eval-notif-seccion" data-maximus-seccion="pendientes">
                <div class="maximus-eval-notif-subtitulo">
                    <span>Evaluaciones pendientes:</span>
                    <span class="maximus-eval-notif-contador maximus-eval-notif-contador-pendientes">0</span>
                </div>
                <div class="maximus-eval-notif-vacio maximus-eval-notif-vacio-pendientes">Ninguna</div>
                <ol class="maximus-eval-notif-lista maximus-eval-notif-lista-pendientes"></ol>
            </div>
            <div class="maximus-eval-notif-seccion" data-maximus-seccion="completadas">
                <div class="maximus-eval-notif-subtitulo">
                    <span>Evaluaciones completadas:</span>
                    <span class="maximus-eval-notif-contador ok maximus-eval-notif-contador-completadas">0</span>
                </div>
                <div class="maximus-eval-notif-vacio maximus-eval-notif-vacio-completadas">Ninguna</div>
                <ol class="maximus-eval-notif-lista maximus-eval-notif-lista-completadas"></ol>
            </div>
        `;

        for (const evento of ['pointerdown', 'mousedown', 'mouseup', 'click', 'keydown']) {
            notif.addEventListener(evento, e => e.stopPropagation());
        }

        const btnCerrar = notif.querySelector('.maximus-eval-notif-cerrar');
        btnCerrar?.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            cerrarNotificacionEvaluaciones(true);
        });

        contenedorRaiz.append(notif);
    }

    if (enAutomatizacion) {
        notif.classList.add('en-automatizacion');
    } else {
        notif.classList.remove('en-automatizacion');
    }

    const estadoEl = notif.querySelector('.maximus-eval-notif-estado');
    if (estadoEl) {
        estadoEl.hidden = !enAutomatizacion;
    }

    const firma = `${enAutomatizacion ? 1 : 0}::${items.map(it => `${it.id}:${it.completada ? 1 : 0}:${it.titulo}`).join('||')}`;
    if (notif.dataset.maximusFirma === firma) {
        return;
    }
    notif.dataset.maximusFirma = firma;

    const pendientes = items.filter(it => !it.completada);
    const completadas = items.filter(it => it.completada);

    const renderizarSeccion = (tipo, listaSeccion, esCompletada) => {
        const contador = notif.querySelector(`.maximus-eval-notif-contador-${tipo}`);
        const vacio = notif.querySelector(`.maximus-eval-notif-vacio-${tipo}`);
        const lista = notif.querySelector(`.maximus-eval-notif-lista-${tipo}`);
        if (contador) contador.textContent = String(listaSeccion.length);
        if (!lista) return;

        lista.innerHTML = '';
        if (!listaSeccion.length) {
            lista.hidden = true;
            if (vacio) {
                vacio.textContent = enAutomatizacion ? 'Cargando...' : 'Ninguna';
                vacio.hidden = false;
            }
            return;
        }

        lista.hidden = false;
        if (vacio) vacio.hidden = true;

        listaSeccion.forEach((item, idx) => {
            const li = document.createElement('li');
            li.className = 'maximus-eval-notif-item';

            const num = document.createElement('span');
            num.className = 'maximus-eval-notif-num';
            num.textContent = `${idx + 1}.`;

            const enlace = document.createElement('a');
            enlace.className = 'maximus-eval-notif-link';
            enlace.setAttribute('href', `#${item.id}`);
            enlace.textContent = item.titulo;
            enlace.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                irAEvaluacionHash(item.id);
            });

            if (esCompletada) {
                const check = document.createElement('span');
                check.className = 'maximus-eval-notif-check';
                check.setAttribute('aria-hidden', 'true');
                check.textContent = '✓';
                li.append(num, check, enlace);
            } else {
                li.append(num, enlace);
            }
            lista.append(li);
        });
    };

    renderizarSeccion('pendientes', pendientes, false);
    renderizarSeccion('completadas', completadas, true);
}

export function marcarEvaluaciones() {
    const marcados = new Set();
    const registros = [];

    for (const card of document.querySelectorAll(TARJETAS)) {
        if (!esTarjetaEvaluacion(card)) continue;
        const fila = obtenerContenedorFilaEvaluacion(card);
        if (!fila || marcados.has(fila)) continue;
        marcados.add(fila);
        fila.classList.add('maximus-fila-evaluacion');
        registros.push({ fila, card });
    }

    for (const fila of document.querySelectorAll('.click-to-invoke-container')) {
        if (fila.closest(TARJETAS) || marcados.has(fila)) continue;
        if (
            fila.closest(
                '[data-maximus], document-panel, section.page-scorm-launch-frame, learning-module-panel-view, content-page-header, nav, .MuiBreadcrumbs-root, .MuiDrawer-root'
            )
        ) {
            continue;
        }
        if (
            fila.querySelector(
                'button[id^="learning-module-title-"], [data-analytics-id="course.learning.module.base.item.toggleLm.button"], button[id^="folder-title-"], [data-analytics-id="content.item.folder.toggleFolder.button"]'
            )
        ) {
            continue;
        }
        if (esElementoEvaluacionEnNodo(fila, null)) {
            marcados.add(fila);
            fila.classList.add('maximus-fila-evaluacion');
            registros.push({ fila, card: null });
        }
    }

    for (const el of document.querySelectorAll('.maximus-fila-evaluacion')) {
        if (!marcados.has(el)) {
            el.classList.remove('maximus-fila-evaluacion', 'maximus-fila-evaluacion-destello');
            delete el.dataset.maximusEvalId;
            if (el.id && el.id.startsWith('maximus-eval-')) {
                el.removeAttribute('id');
            }
        }
    }

    const idsUsados = new Set();
    const items = registros.map(({ fila, card }, idx) => {
        const titulo = obtenerTituloEvaluacion(fila, card);
        const completada = esEvaluacionCompletada(fila, card);
        const hashId = generarHashIdEvaluacion(titulo, idx, idsUsados);
        fila.dataset.maximusEvalId = hashId;
        if (!fila.id || fila.id.startsWith('maximus-eval-')) {
            fila.id = hashId;
        }
        return { id: hashId, titulo, completada, fila, card };
    });

    actualizarNotificacionEvaluaciones(items);
    return items;
}
