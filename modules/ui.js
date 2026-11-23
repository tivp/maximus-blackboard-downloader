// Estilos CSS, barra de progreso por bloques, colores de estado en filas, notificación flotante de evaluaciones y botonera sin logos.

import { TARJETAS, estado } from './config.js';
import { texto, tituloEl } from './utils.js';
import {
    esTarjetaEvaluacion,
    esElementoEvaluacionEnNodo,
    obtenerContenedorFilaEvaluacion,
    enVistaOutlineCurso,
    reiniciarEstadoEvaluacionesSiCambioCurso,
    nombreCard,
    esModuloCard,
    estaTarjetaBloqueada
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

        .maximus-fila-evaluacion,
        .maximus-fila-ok,
        .maximus-fila-error,
        .maximus-fila-omitido {
            position: relative !important;
            isolation: isolate !important;
            box-sizing: border-box !important;
            border: 2px solid #000000 !important;
            border-radius: 10px !important;
            box-shadow: none !important;
            margin-top: 3px !important;
            margin-bottom: 3px !important;
            transition: background-color .15s, box-shadow .15s !important;
        }

        .maximus-fila-evaluacion::before,
        .maximus-fila-ok::before,
        .maximus-fila-error::before,
        .maximus-fila-omitido::before {
            content: '' !important;
            position: absolute !important;
            inset: 4px 6px 6px 6px !important;
            border: 0 !important;
            border-radius: 6px !important;
            background: linear-gradient(
                180deg,
                rgba(255, 255, 255, 0.72) 0%,
                rgba(255, 255, 255, 0.30) 45%,
                rgba(255, 255, 255, 0) 92%
            ) !important;
            pointer-events: none !important;
            z-index: -1 !important;
        }

        .maximus-fila-evaluacion a,
        .maximus-fila-evaluacion button,
        .maximus-fila-ok a,
        .maximus-fila-ok button,
        .maximus-fila-error a,
        .maximus-fila-error button,
        .maximus-fila-omitido a,
        .maximus-fila-omitido button {
            background-color: transparent !important;
        }

        .maximus-fila-evaluacion {
            background: #f7d358 !important;
        }

        .maximus-fila-evaluacion:hover,
        .maximus-fila-evaluacion:focus-within {
            background: #f4c73b !important;
        }

        .maximus-fila-ok {
            background: #6fe094 !important;
        }

        .maximus-fila-ok:hover,
        .maximus-fila-ok:focus-within {
            background: #5bd683 !important;
        }

        .maximus-fila-error {
            background: #f78c8c !important;
        }

        .maximus-fila-error:hover,
        .maximus-fila-error:focus-within {
            background: #f27878 !important;
        }

        .maximus-fila-omitido {
            background: #b9c5d1 !important;
        }

        .maximus-fila-omitido:hover,
        .maximus-fila-omitido:focus-within {
            background: #a8b7c6 !important;
        }

        .maximus-fila-evaluacion-destello {
            background: #f2be22 !important;
            border-color: #000000 !important;
            box-shadow: 0 0 0 3px rgba(242, 188, 36, 0.65) !important;
        }

        @keyframes maximus-giro {
            to {
                transform: rotate(360deg);
            }
        }

        .maximus-eval-notif-spinner {
            box-sizing: border-box !important;
            display: inline-block !important;
            width: 14px !important;
            height: 14px !important;
            border: 2px solid rgba(180, 134, 11, 0.28) !important;
            border-top-color: #b4860b !important;
            border-radius: 50% !important;
            animation: maximus-giro .75s linear infinite !important;
            will-change: transform !important;
            vertical-align: middle !important;
            flex: 0 0 auto !important;
        }

        .maximus-eval-notif {
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            z-index: 2147483646 !important;
            width: min(360px, calc(100vw - 28px)) !important;
            max-height: min(70vh, 504px) !important;
            display: flex !important;
            flex-direction: column !important;
            box-sizing: border-box !important;
            padding: 10px 12px !important;
            background: #fff7cc !important;
            border: 1px solid #f0dd8c !important;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.24) !important;
            border-radius: 9px !important;
            color: #26394b !important;
            font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif !important;
            transition: box-shadow .2s ease, border-color .2s ease !important;
        }

        .maximus-eval-notif.en-automatizacion {
            border-color: #e2b824 !important;
            box-shadow: 0 14px 34px rgba(15, 23, 42, 0.28) !important;
        }

        .maximus-eval-notif.arrastrando {
            transition: none !important;
            user-select: none !important;
            box-shadow: 0 18px 42px rgba(15, 23, 42, 0.34) !important;
        }

        .maximus-eval-notif.minimizada {
            max-height: none !important;
            width: min(288px, calc(100vw - 28px)) !important;
        }

        .maximus-eval-notif.minimizada .maximus-eval-notif-cuerpo {
            display: none !important;
        }

        .maximus-eval-notif-cabecera {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 6px !important;
            cursor: grab !important;
            user-select: none !important;
            touch-action: none !important;
        }

        .maximus-eval-notif.arrastrando .maximus-eval-notif-cabecera {
            cursor: grabbing !important;
        }

        .maximus-eval-notif-cabecera-izq {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            min-width: 0 !important;
            flex: 1 1 auto !important;
        }

        .maximus-eval-notif-titulos {
            display: flex !important;
            flex-direction: column !important;
            min-width: 0 !important;
        }

        .maximus-eval-notif-titulo {
            margin: 0 !important;
            padding: 0 !important;
            font-weight: 700 !important;
            font-size: 12px !important;
            line-height: 1.25 !important;
            color: #26394b !important;
        }

        .maximus-eval-notif-resumen {
            font-size: 10.5px !important;
            line-height: 1.25 !important;
            color: #6e5714 !important;
            margin-top: 1px !important;
        }

        .maximus-eval-notif-controles {
            display: inline-flex !important;
            align-items: center !important;
            gap: 3px !important;
            flex: 0 0 auto !important;
        }

        .maximus-eval-notif-min,
        .maximus-eval-notif-cerrar {
            width: 22px !important;
            height: 22px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            margin: 0 !important;
            border: 1px solid transparent !important;
            border-radius: 5px !important;
            background: transparent !important;
            color: #5c4b12 !important;
            font: 700 14px/1 Arial, sans-serif !important;
            cursor: pointer !important;
            transition: background-color .15s, border-color .15s, color .15s !important;
        }

        .maximus-eval-notif-min:hover,
        .maximus-eval-notif-min:focus-visible,
        .maximus-eval-notif-cerrar:hover,
        .maximus-eval-notif-cerrar:focus-visible {
            background: rgba(229, 184, 46, 0.25) !important;
            border-color: #e6c95c !important;
            color: #26394b !important;
        }

        .maximus-eval-notif-cuerpo {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            overscroll-behavior: contain !important;
            min-height: 0 !important;
            margin-top: 4px !important;
            padding-right: 0 !important;
            scrollbar-width: thin !important;
            scrollbar-color: rgba(180, 134, 11, 0.35) transparent !important;
        }

        .maximus-eval-notif-cuerpo::-webkit-scrollbar {
            width: 5px !important;
        }

        .maximus-eval-notif-cuerpo::-webkit-scrollbar-track {
            background: transparent !important;
        }

        .maximus-eval-notif-cuerpo::-webkit-scrollbar-thumb {
            background: rgba(180, 134, 11, 0.35) !important;
            border-radius: 999px !important;
        }

        .maximus-eval-notif.en-automatizacion .maximus-eval-notif-cuerpo {
            overflow: hidden !important;
        }

        .maximus-eval-notif-vacio[hidden],
        .maximus-eval-notif-lista[hidden],
        .maximus-eval-notif-meta[hidden] {
            display: none !important;
        }

        .maximus-eval-notif-lista {
            margin: 5px 0 0 0 !important;
            padding: 0 !important;
            list-style: none !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 5px !important;
        }

        .maximus-eval-notif-item {
            display: flex !important;
            flex-direction: column !important;
            gap: 2px !important;
            padding: 5px 7px !important;
            border-radius: 6px !important;
            background: rgba(255, 255, 255, 0.68) !important;
            border: 1px solid rgba(240, 221, 140, 0.85) !important;
        }

        .maximus-eval-notif-item-cabecera {
            display: flex !important;
            align-items: baseline !important;
            gap: 5px !important;
            min-width: 0 !important;
        }

        .maximus-eval-notif-num {
            font-weight: 700 !important;
            color: #7a5c00 !important;
            min-width: 16px !important;
            flex: 0 0 auto !important;
        }

        .maximus-eval-notif-link {
            color: #0969da !important;
            font-weight: 600 !important;
            text-decoration: none !important;
            word-break: break-word !important;
            cursor: pointer !important;
            flex: 1 1 auto !important;
            min-width: 0 !important;
        }

        .maximus-eval-notif-link:hover,
        .maximus-eval-notif-link:focus-visible {
            text-decoration: underline !important;
            color: #0550ae !important;
        }

        .maximus-eval-notif-tag {
            flex: 0 0 auto !important;
            font-size: 9.5px !important;
            font-weight: 700 !important;
            padding: 1px 5px !important;
            border-radius: 999px !important;
            white-space: nowrap !important;
        }

        .maximus-eval-notif-tag-sin-iniciar {
            background: rgba(212, 161, 26, 0.18) !important;
            color: #6b4e00 !important;
        }

        .maximus-eval-notif-tag-iniciada {
            background: rgba(9, 105, 218, 0.14) !important;
            color: #0550ae !important;
        }

        .maximus-eval-notif-tag-bloqueada {
            background: rgba(100, 116, 139, 0.16) !important;
            color: #475569 !important;
        }

        .maximus-eval-notif-meta {
            padding-left: 21px !important;
            font-size: 10.5px !important;
            line-height: 1.3 !important;
            color: #5c4b12 !important;
            word-break: break-word !important;
        }

        .maximus-eval-notif-seccion {
            margin-top: 7px !important;
            padding-top: 6px !important;
            border-top: 1px dashed rgba(180, 134, 11, 0.35) !important;
        }

        .maximus-eval-notif-subtitulo {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 6px !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            color: #5c4000 !important;
            margin: 0 0 3px 0 !important;
        }

        .maximus-eval-notif-contador {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-width: 16px !important;
            height: 16px !important;
            padding: 0 5px !important;
            border-radius: 999px !important;
            background: rgba(180, 134, 11, 0.16) !important;
            color: #5c4000 !important;
            font-size: 10px !important;
            font-weight: 700 !important;
        }

        .maximus-eval-notif-contador.ok {
            background: rgba(26, 127, 55, 0.14) !important;
            color: #116329 !important;
        }

        .maximus-eval-notif-vacio {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            min-height: 22px !important;
            font-size: 11.5px !important;
            font-style: italic !important;
            color: #7c5c0a !important;
            padding: 3px 4px !important;
            overflow: hidden !important;
            contain: layout paint !important;
        }

        .maximus-eval-notif-check {
            color: #1a7f37 !important;
            font-weight: 700 !important;
            font-size: 11px !important;
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

function removerPanelesEvaluacion() {
    document.querySelectorAll('.maximus-eval-notif').forEach(el => {
        el._limpiarEventos?.();
        el.remove();
    });
    document.querySelectorAll('.maximus-eval-backdrop').forEach(el => el.remove());
}

export function limpiarPanelesEnVistaDocumento() {
    document.querySelectorAll('.maximus-panel').forEach(p => p.remove());
    removerPanelesEvaluacion();
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
    removerPanelesEvaluacion();
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

    const notif = document.querySelector('.maximus-eval-notif');
    const estabaEnAutomatizacion = Boolean(
        estado.evaluacionesAutomatizacionActiva ||
        notif?.classList.contains('en-automatizacion')
    );
    estado.evaluacionesAutomatizacionActiva = false;

    if (notif) {
        notif.classList.remove('en-automatizacion');
    }
    if (estabaEnAutomatizacion) {
        marcarEvaluaciones();
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

export function obtenerEstadoEvaluacion(fila, card = null) {
    const raiz = card || fila;
    if (!raiz) {
        return { completada: false, estadoLabel: 'Sin iniciar', estadoTipo: 'sin-iniciar' };
    }

    const perteneceATarjeta = el => {
        if (!card) return true;
        const tarjetaCercana = el.closest(TARJETAS);
        return !tarjetaCercana || tarjetaCercana === card;
    };

    const botonesEstado = raiz.querySelectorAll(
        '.js-review-state-icon-button, button[role="checkbox"][data-analytics-id*="review-state"], button[role="checkbox"][aria-label*="Estado de"]'
    );
    let resultadoNoCompletado = null;

    for (const btn of botonesEstado) {
        if (!perteneceATarjeta(btn)) continue;
        const ariaChecked = (btn.getAttribute('aria-checked') || '').trim().toLowerCase();
        if (ariaChecked === 'true') {
            return { completada: true, estadoLabel: 'Completada', estadoTipo: 'completada' };
        }
        if (ariaChecked === 'mixed') {
            resultadoNoCompletado = { completada: false, estadoLabel: 'Iniciado', estadoTipo: 'iniciada' };
            break;
        }
        if (ariaChecked === 'false') {
            resultadoNoCompletado = { completada: false, estadoLabel: 'Sin iniciar', estadoTipo: 'sin-iniciar' };
            break;
        }

        const label = texto(btn.getAttribute('aria-label') || '');
        if (/:\s*completad[oa]\b/i.test(label)) {
            return { completada: true, estadoLabel: 'Completada', estadoTipo: 'completada' };
        }
        if (/:\s*iniciad[oa]\b/i.test(label)) {
            resultadoNoCompletado = { completada: false, estadoLabel: 'Iniciado', estadoTipo: 'iniciada' };
            break;
        }
        if (/:\s*(?:sin\s+iniciar|no\s+iniciad[oa])\b/i.test(label)) {
            resultadoNoCompletado = { completada: false, estadoLabel: 'Sin iniciar', estadoTipo: 'sin-iniciar' };
            break;
        }

        if (btn.querySelector('svg[class*="completed"]')) {
            return { completada: true, estadoLabel: 'Completada', estadoTipo: 'completada' };
        }
    }

    if (!resultadoNoCompletado) {
        const svgsCompletados = raiz.querySelectorAll(
            'svg[class*="makeStylescompleted"], [role="checkbox"] svg[class*="completed"]'
        );
        for (const svg of svgsCompletados) {
            if (perteneceATarjeta(svg)) {
                return { completada: true, estadoLabel: 'Completada', estadoTipo: 'completada' };
            }
        }
    }

    if (card && estaTarjetaBloqueada(card)) {
        return { completada: false, estadoLabel: 'Bloqueada', estadoTipo: 'bloqueada' };
    }

    return resultadoNoCompletado || {
        completada: false,
        estadoLabel: 'Sin iniciar',
        estadoTipo: 'sin-iniciar'
    };
}

export function esEvaluacionCompletada(fila, card = null) {
    return obtenerEstadoEvaluacion(fila, card).completada;
}

function obtenerMetaEvaluacion(fila, card = null) {
    const raiz = card || fila;
    let unidad = '';
    if (raiz) {
        let fallbackCarpeta = '';
        for (let p = raiz.parentElement?.closest(TARJETAS); p; p = p.parentElement?.closest(TARJETAS)) {
            const nom = nombreCard(p);
            if (!nom) continue;
            if (esModuloCard(p)) {
                unidad = nom;
                break;
            }
            if (!fallbackCarpeta) {
                fallbackCarpeta = nom;
            }
        }
        if (!unidad) {
            unidad = fallbackCarpeta;
        }
    }

    const detalles = [];
    const detalleEls = (raiz || document).querySelectorAll(
        '[class*="gradeInfo-"] [class*="gradeDetail-"], [class*="gradeDetail-"]'
    );
    for (const el of detalleEls) {
        if (card && el.closest(TARJETAS) !== card) continue;
        const t = texto(el.textContent || '');
        if (t && !detalles.includes(t)) {
            detalles.push(t);
        }
    }

    return {
        unidad,
        detalles: detalles.join(' · ')
    };
}

function aplicarPosicionNotif(notif, pos) {
    if (!notif) return;
    if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') {
        notif.style.removeProperty?.('left');
        notif.style.removeProperty?.('top');
        notif.style.removeProperty?.('right');
        notif.style.removeProperty?.('bottom');
        notif.style.removeProperty?.('transform');
        delete notif.dataset.maximusPosCustom;
        return;
    }

    const anchoWin = Math.max(window.innerWidth || 0, 320);
    const altoWin = Math.max(window.innerHeight || 0, 240);
    const rect = notif.getBoundingClientRect?.() || { width: 0, height: 0 };
    const w = rect.width > 0 ? rect.width : 324;
    const h = rect.height > 0 ? rect.height : 162;
    const maxLeft = Math.max(8, anchoWin - w - 8);
    const maxTop = Math.max(8, altoWin - h - 8);
    const left = Math.min(Math.max(8, Math.round(pos.left)), maxLeft);
    const top = Math.min(Math.max(8, Math.round(pos.top)), maxTop);

    estado.evaluacionesNotifPos = { left, top };
    notif.dataset.maximusPosCustom = '1';
    notif.style.setProperty('left', `${left}px`, 'important');
    notif.style.setProperty('top', `${top}px`, 'important');
    notif.style.setProperty('right', 'auto', 'important');
    notif.style.setProperty('bottom', 'auto', 'important');
    notif.style.setProperty('transform', 'none', 'important');
}

function habilitarArrastreNotif(notif) {
    const cabecera = notif.querySelector('.maximus-eval-notif-cabecera');
    if (!cabecera) return;

    let arrastrando = false;
    let movio = false;
    let tipoArrastre = '';
    let origenX = 0;
    let origenY = 0;
    let baseLeft = 0;
    let baseTop = 0;

    const limpiar = () => {
        window.removeEventListener('pointermove', alPointerMove);
        window.removeEventListener('pointerup', alPointerUp);
        window.removeEventListener('pointercancel', alPointerCancel);
        window.removeEventListener('mousemove', alMouseMove);
        window.removeEventListener('mouseup', alMouseUp);
        window.removeEventListener('resize', alResize);
    };

    const procesarMovimiento = (e, tipo) => {
        if (!arrastrando || tipo !== tipoArrastre) return;
        if (!notif.isConnected) {
            limpiar();
            return;
        }
        const dx = (e.clientX ?? 0) - origenX;
        const dy = (e.clientY ?? 0) - origenY;
        if (!movio && Math.hypot(dx, dy) < 3) {
            return;
        }
        movio = true;
        notif.classList.add('arrastrando');
        aplicarPosicionNotif(notif, { left: baseLeft + dx, top: baseTop + dy });
    };

    const terminarArrastre = tipo => {
        if (!arrastrando || (tipo && tipo !== tipoArrastre)) return;
        arrastrando = false;
        tipoArrastre = '';
        notif.classList.remove('arrastrando');
    };

    const iniciar = (e, tipo) => {
        if (arrastrando) return;
        if (e.button != null && e.button !== 0) return;
        const target = e.target?.nodeType === 3 ? e.target.parentElement : e.target;
        if (target?.closest?.('button, a, input, select, textarea')) return;

        const rect = notif.getBoundingClientRect?.() || { left: 20, top: 20 };
        const fallbackLeft = Math.max(8, (window.innerWidth || 1280) - (rect.width > 0 ? rect.width : 360) - 20);
        arrastrando = true;
        movio = false;
        tipoArrastre = tipo;
        origenX = e.clientX ?? 0;
        origenY = e.clientY ?? 0;
        baseLeft = Number.isFinite(rect.left) && (rect.width > 0 || rect.left > 0) ? rect.left : (estado.evaluacionesNotifPos?.left ?? fallbackLeft);
        baseTop = Number.isFinite(rect.top) ? rect.top : (estado.evaluacionesNotifPos?.top ?? 20);

        e.preventDefault?.();
    };

    const alPointerMove = e => procesarMovimiento(e, 'pointer');
    const alPointerUp = () => terminarArrastre('pointer');
    const alPointerCancel = () => terminarArrastre();
    const alMouseMove = e => procesarMovimiento(e, 'mouse');
    const alMouseUp = () => terminarArrastre('mouse');
    const alResize = () => {
        if (!notif.isConnected) {
            limpiar();
            return;
        }
        if (estado.evaluacionesNotifPos) {
            aplicarPosicionNotif(notif, estado.evaluacionesNotifPos);
        }
    };

    cabecera.addEventListener('pointerdown', e => iniciar(e, 'pointer'));
    cabecera.addEventListener('mousedown', e => iniciar(e, 'mouse'));
    cabecera.addEventListener('dblclick', e => {
        const target = e.target?.nodeType === 3 ? e.target.parentElement : e.target;
        if (target?.closest?.('button, a')) return;
        estado.evaluacionesNotifPos = null;
        aplicarPosicionNotif(notif, null);
    });

    window.addEventListener('pointermove', alPointerMove);
    window.addEventListener('pointerup', alPointerUp);
    window.addEventListener('pointercancel', alPointerCancel);
    window.addEventListener('mousemove', alMouseMove);
    window.addEventListener('mouseup', alMouseUp);
    window.addEventListener('resize', alResize, { passive: true });

    notif._limpiarEventos = limpiar;
}

function sincronizarEstadoMinNotif(elNotif) {
    if (!elNotif) return;
    const minBtn = elNotif.querySelector('.maximus-eval-notif-min');
    const cuerpo = elNotif.querySelector('.maximus-eval-notif-cuerpo');
    const min = Boolean(estado.evaluacionesNotifMinimizada);
    if (min) {
        elNotif.classList.add('minimizada');
    } else {
        elNotif.classList.remove('minimizada');
    }
    if (cuerpo) cuerpo.hidden = min;
    if (minBtn) {
        minBtn.innerHTML = min ? '+' : '&minus;';
        minBtn.setAttribute('aria-label', min ? 'Expandir' : 'Minimizar');
        minBtn.setAttribute('title', min ? 'Expandir' : 'Minimizar');
        minBtn.setAttribute('aria-expanded', min ? 'false' : 'true');
    }
}

export function actualizarNotificacionEvaluaciones(items = []) {
    if (estado.ocupado || estado.evaluacionesNotificacionCerrada || !enVistaOutlineCurso()) {
        removerPanelesEvaluacion();
        return;
    }

    const enAutomatizacion = Boolean(estado.evaluacionesAutomatizacionActiva);

    const contenedorRaiz = document.body || document.documentElement;
    if (!contenedorRaiz) return;

    document.querySelectorAll('.maximus-eval-backdrop').forEach(el => el.remove());

    let notif = document.querySelector('.maximus-eval-notif');
    if (
        notif &&
        (
            !notif.querySelector('.maximus-eval-notif-cuerpo') ||
            notif.querySelector('.maximus-eval-notif-estado') ||
            notif.querySelector('.maximus-eval-notif-grip')
        )
    ) {
        notif._limpiarEventos?.();
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
            <div class="maximus-eval-notif-cabecera" title="Arrastra para mover · Doble clic para volver a la esquina">
                <div class="maximus-eval-notif-cabecera-izq">
                    <div class="maximus-eval-notif-titulos">
                        <div class="maximus-eval-notif-titulo">Índice de evaluaciones</div>
                        <div class="maximus-eval-notif-resumen"></div>
                    </div>
                </div>
                <div class="maximus-eval-notif-controles">
                    <button class="maximus-eval-notif-min" type="button" aria-label="Minimizar" title="Minimizar">&minus;</button>
                    <button class="maximus-eval-notif-cerrar" type="button" aria-label="Cerrar notificación" title="Cerrar">&times;</button>
                </div>
            </div>
            <div class="maximus-eval-notif-cuerpo">
                <div class="maximus-eval-notif-seccion" data-maximus-seccion="pendientes">
                    <div class="maximus-eval-notif-subtitulo">
                        <span>Evaluaciones pendientes:</span>
                        <span class="maximus-eval-notif-contador maximus-eval-notif-contador-pendientes">0</span>
                    </div>
                    <div class="maximus-eval-notif-vacio maximus-eval-notif-vacio-pendientes">No tienes nada pendiente</div>
                    <ol class="maximus-eval-notif-lista maximus-eval-notif-lista-pendientes"></ol>
                </div>
                <div class="maximus-eval-notif-seccion" data-maximus-seccion="completadas">
                    <div class="maximus-eval-notif-subtitulo">
                        <span>Evaluaciones completadas:</span>
                        <span class="maximus-eval-notif-contador ok maximus-eval-notif-contador-completadas">0</span>
                    </div>
                    <div class="maximus-eval-notif-vacio maximus-eval-notif-vacio-completadas">No hay nada</div>
                    <ol class="maximus-eval-notif-lista maximus-eval-notif-lista-completadas"></ol>
                </div>
            </div>
        `;

        for (const evento of ['pointerdown', 'mousedown', 'mouseup', 'click', 'keydown']) {
            notif.addEventListener(evento, e => e.stopPropagation());
        }

        const btnMin = notif.querySelector('.maximus-eval-notif-min');
        btnMin?.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            estado.evaluacionesNotifMinimizada = !estado.evaluacionesNotifMinimizada;
            sincronizarEstadoMinNotif(notif);
        });

        const btnCerrar = notif.querySelector('.maximus-eval-notif-cerrar');
        btnCerrar?.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            cerrarNotificacionEvaluaciones(true);
        });

        contenedorRaiz.append(notif);
        habilitarArrastreNotif(notif);
        if (estado.evaluacionesNotifPos) {
            aplicarPosicionNotif(notif, estado.evaluacionesNotifPos);
        }
    }

    sincronizarEstadoMinNotif(notif);

    if (enAutomatizacion) {
        notif.classList.add('en-automatizacion');
    } else {
        notif.classList.remove('en-automatizacion');
    }

    if (estado.evaluacionesNotifPos) {
        aplicarPosicionNotif(notif, estado.evaluacionesNotifPos);
    }

    const pendientes = items.filter(it => !it.completada);
    const completadas = items.filter(it => it.completada);

    const resumenEl = notif.querySelector('.maximus-eval-notif-resumen');
    if (resumenEl) {
        if (enAutomatizacion && !items.length) {
            resumenEl.textContent = 'Analizando curso...';
        } else if (!items.length) {
            resumenEl.textContent = 'No tienes nada pendiente';
        } else {
            resumenEl.textContent = `${pendientes.length} ${pendientes.length === 1 ? 'pendiente' : 'pendientes'} · ${completadas.length} ${completadas.length === 1 ? 'completada' : 'completadas'}`;
        }
    }

    const firma = `${enAutomatizacion ? 1 : 0}::${items.map(it => `${it.id}:${it.estadoTipo || ''}:${it.titulo}:${it.unidad || ''}:${it.detalles || ''}`).join('||')}`;
    if (notif.dataset.maximusFirma === firma) {
        return;
    }
    notif.dataset.maximusFirma = firma;

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
                if (enAutomatizacion) {
                    vacio.innerHTML = '<span class="maximus-eval-notif-spinner" role="status" aria-label="Cargando"></span>';
                } else {
                    vacio.textContent = esCompletada ? 'No hay nada' : 'No tienes nada pendiente';
                }
                vacio.hidden = false;
            }
            return;
        }

        lista.hidden = false;
        if (vacio) {
            vacio.hidden = true;
            vacio.textContent = '';
        }

        listaSeccion.forEach((item, idx) => {
            const li = document.createElement('li');
            li.className = 'maximus-eval-notif-item';

            const topRow = document.createElement('div');
            topRow.className = 'maximus-eval-notif-item-cabecera';

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
                topRow.append(num, check, enlace);
            } else {
                topRow.append(num, enlace);
                if (item.estadoLabel) {
                    const tag = document.createElement('span');
                    tag.className = `maximus-eval-notif-tag maximus-eval-notif-tag-${item.estadoTipo || 'sin-iniciar'}`;
                    tag.textContent = item.estadoLabel;
                    topRow.append(tag);
                }
            }

            li.append(topRow);

            const metaTexto = [item.unidad, item.detalles].filter(Boolean).join(' · ');
            if (metaTexto) {
                const meta = document.createElement('div');
                meta.className = 'maximus-eval-notif-meta';
                meta.textContent = metaTexto;
                li.append(meta);
            }

            lista.append(li);
        });
    };

    renderizarSeccion('pendientes', pendientes, false);
    renderizarSeccion('completadas', completadas, true);
}

export function marcarEvaluaciones() {
    reiniciarEstadoEvaluacionesSiCambioCurso();
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
        const { completada, estadoLabel, estadoTipo } = obtenerEstadoEvaluacion(fila, card);
        const { unidad, detalles } = obtenerMetaEvaluacion(fila, card);
        const hashId = generarHashIdEvaluacion(titulo, idx, idsUsados);
        fila.dataset.maximusEvalId = hashId;
        if (!fila.id || fila.id.startsWith('maximus-eval-')) {
            fila.id = hashId;
        }
        return {
            id: hashId,
            titulo,
            completada,
            estadoLabel,
            estadoTipo,
            unidad,
            detalles,
            fila,
            card
        };
    });

    actualizarNotificacionEvaluaciones(items);
    return items;
}
