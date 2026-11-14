// Estilos CSS, barra de progreso por bloques, colores de estado en filas y botonera con el logo de Transformer en Base64.

import { LOGO_BASE64, estado } from './config.js';

export function cambiarTextoBoton(boton, etiqueta) {
    if (!boton) return;
    let span = boton.querySelector('.maximus-boton-texto');
    if (!span) {
        boton.innerHTML = `<img class="maximus-logo" src="${LOGO_BASE64}" alt=""><span class="maximus-boton-texto"></span>`;
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

        .maximus-logo {
            width: 16px !important;
            height: 16px !important;
            flex: 0 0 16px !important;
            object-fit: contain !important;
            pointer-events: none !important;
            opacity: .88;
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
    document.querySelectorAll('.maximus-panel').forEach(p => p.remove());
}
