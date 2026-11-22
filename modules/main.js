// Montaje de paneles en cada unidad, botón general del curso, reconexión tras vistas completas y arranque del observador.

import { CFG, TARJETAS, estado, cancelarDescargaActiva } from './config.js';
import {
    dormir,
    canon,
    esperarHasta,
    compatible,
    obtenerNombreCurso
} from './utils.js';
import { guardarZip } from './zip.js';
import { activarInterceptorIframes, enVistaDocumentoPantallaCompleta } from './interceptor.js';
import {
    examenFinalHabilitado,
    cabeceras,
    buscarRaiz,
    anclaAncha,
    expandirCarpetas,
    desplegarEvaluacionesAutomaticamente
} from './scanner.js';
import { registrarRehidratador } from './visor.js';
import {
    cambiarTextoBoton,
    copiarTextoPortapapeles,
    inyectarCss,
    crearPiezas,
    pieza,
    restaurarColoresFilas,
    limpiarPanelesEnVistaDocumento,
    marcarEvaluaciones
} from './ui.js';
import {
    ejecutar,
    ejecutarTodoElCurso,
    registrarAgendador
} from './downloader.js';

export function montar(u) {
    const panel = document.createElement('div');
    panel.className = 'maximus-panel';
    panel.dataset.maximus = 'panel';

    panel.innerHTML = `
        <button class="maximus-boton" type="button">
            <span class="maximus-boton-texto">Descargar .zip</span>
        </button>
        <div class="maximus-barra">
            <span class="maximus-pct">0%</span>
        </div>
        <div class="maximus-estado">
            Listo para descargar en ZIP
        </div>
        <button class="maximus-log" type="button" hidden>
            Copiar log
        </button>
    `;

    const ancla = anclaAncha(u);

    const guts = ancla.querySelector('[class*="contentItemComponentDetailsGuts"]');
    const desc = guts?.querySelector('.js-description');

    if (guts && desc) {
        panel.classList.add('maximus-flujo');
        guts.append(panel);
    } else {
        if (getComputedStyle(ancla).position === 'static') {
            ancla.style.position = 'relative';
        }
        ancla.append(panel);
    }

    u.panel = panel;
    u.boton = panel.querySelector('.maximus-boton');
    u.barra = panel.querySelector('.maximus-barra');
    u.pct = panel.querySelector('.maximus-pct');
    u.estado = panel.querySelector('.maximus-estado');
    u.copiar = panel.querySelector('.maximus-log');

    const colocar = () => {
        if (!panel.isConnected || !u.titulo.isConnected) return;
        if (panel.classList.contains('maximus-flujo')) return;

        const t = u.titulo.getBoundingClientRect();
        const r = ancla.getBoundingClientRect();
        const anchura = r.width;

        let izquierda = Math.max(0, t.left - r.left);

        if (anchura < 650 || anchura - izquierda < 350) {
            izquierda = 12;
        }

        panel.style.setProperty('--maximus-left', `${izquierda}px`);
        panel.style.setProperty('left', `${izquierda}px`, 'important');
        panel.style.setProperty('top', `${Math.max(0, t.bottom - r.top + 8)}px`, 'important');
        panel.style.setProperty('right', 'auto', 'important');
        panel.style.setProperty('width', CFG.ANCHO_PANEL, 'important');
    };

    for (const evento of ['pointerdown', 'mousedown', 'mouseup', 'click', 'keydown']) {
        panel.addEventListener(evento, e => e.stopPropagation());
    }

    u.boton.addEventListener('click', evento => {
        if (estado.ocupado) {
            if (estado.tareaActiva === u) {
                cancelarDescargaActiva();
            }
            return;
        }

        if (u.zipBlob && !evento.shiftKey) {
            guardarZip(u);
            u.estado.textContent = 'ZIP descargado nuevamente.';
        } else {
            ejecutar(u);
        }
    });

    u.copiar.addEventListener('click', async () => {
        await copiarTextoPortapapeles(u.log.join('\n'));
        const original = u.copiar.textContent;
        u.copiar.textContent = '¡Log copiado!';
        setTimeout(() => {
            u.copiar.textContent = original;
        }, 1800);
    });

    window.addEventListener('resize', colocar, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
        u.observador = new ResizeObserver(() => requestAnimationFrame(colocar));
        u.observador.observe(ancla);
        u.observador.observe(u.titulo);
    }

    requestAnimationFrame(colocar);
}

export function sincronizarBotonCurso() {
    if (enVistaDocumentoPantallaCompleta()) {
        return;
    }

    if (estado.panelCurso && !estado.panelCurso.panel?.isConnected) {
        if (estado.panelCurso.zipUrl) URL.revokeObjectURL(estado.panelCurso.zipUrl);
        estado.panelCurso = null;
    }

    if (!examenFinalHabilitado()) {
        if (estado.panelCurso?.panel?.isConnected) {
            estado.panelCurso.panel.remove();
            estado.panelCurso = null;
        }
        return;
    }

    if (estado.panelCurso?.panel?.isConnected) {
        return;
    }

    const tituloHeader =
        document.getElementById('course-content-outline-header-text') ||
        document.querySelector('header.outline-header h2');

    if (!tituloHeader) return;

    const filaHeader = tituloHeader.parentElement;
    if (!filaHeader) return;

    const panel = document.createElement('div');
    panel.className = 'maximus-panel maximus-panel-curso';
    panel.dataset.maximus = 'panel-curso';

    panel.innerHTML = `
        <button class="maximus-boton" type="button">
            <span class="maximus-boton-texto">Descargar todo el curso</span>
        </button>
        <div class="maximus-barra">
            <span class="maximus-pct">0%</span>
        </div>
        <div class="maximus-estado">
            Examen final habilitado · Listo para descargar todo el curso en ZIP
        </div>
        <button class="maximus-log" type="button" hidden>
            Copiar log
        </button>
    `;

    const botonBuscar = filaHeader.querySelector('[data-analytics-id="course-outline.filter.search.button"], a, button');
    if (botonBuscar && botonBuscar !== tituloHeader) {
        filaHeader.insertBefore(panel, botonBuscar);
    } else {
        filaHeader.appendChild(panel);
    }

    const pc = {
        esCurso: true,
        nombre: obtenerNombreCurso(),
        panel,
        boton: panel.querySelector('.maximus-boton'),
        barra: panel.querySelector('.maximus-barra'),
        pct: panel.querySelector('.maximus-pct'),
        estado: panel.querySelector('.maximus-estado'),
        copiar: panel.querySelector('.maximus-log'),
        piezas: [],
        estadosPiezas: [],
        log: [],
        zipBlob: null,
        zipUrl: null,
        zipNombre: ''
    };

    estado.panelCurso = pc;

    for (const evento of ['pointerdown', 'mousedown', 'mouseup', 'click', 'keydown']) {
        panel.addEventListener(evento, e => e.stopPropagation());
    }

    pc.boton.addEventListener('click', evento => {
        if (estado.ocupado) {
            if (estado.tareaActiva === pc) {
                cancelarDescargaActiva();
            }
            return;
        }

        if (pc.zipBlob && !evento.shiftKey) {
            guardarZip(pc);
            pc.estado.textContent = 'ZIP del curso completo descargado nuevamente.';
        } else {
            ejecutarTodoElCurso(pc);
        }
    });

    pc.copiar.addEventListener('click', async () => {
        await copiarTextoPortapapeles(pc.log.join('\n'));
        const original = pc.copiar.textContent;
        pc.copiar.textContent = '¡Log copiado!';
        setTimeout(() => {
            pc.copiar.textContent = original;
        }, 1800);
    });
}

export function descubrir() {
    if (!compatible()) {
        return;
    }

    if (enVistaDocumentoPantallaCompleta()) {
        limpiarPanelesEnVistaDocumento();
        return;
    }

    restaurarColoresFilas();
    marcarEvaluaciones();

    if (estado.ocupado) {
        return;
    }

    for (const [el, u] of estado.unidades) {
        if (!el.isConnected || !u.panel?.isConnected) {
            u.observador?.disconnect();
            if (u.zipUrl) URL.revokeObjectURL(u.zipUrl);
            estado.unidades.delete(el);
        }
    }

    const lista = cabeceras();
    const todos = lista.map(x => x.el);

    for (const x of lista) {
        if (estado.unidades.has(x.el)) continue;

        const raiz = buscarRaiz(x.el, todos);
        if (!raiz || raiz === document.body) continue;

        if (
            [...estado.unidades.values()].some(
                u => u.raiz === raiz && canon(u.nombre) === canon(x.nombre)
            )
        ) {
            continue;
        }

        const u = {
            esCurso: false,
            contentId: raiz.getAttribute('data-content-id') || '',
            titulo: x.el,
            nombre: x.nombre,
            raiz,
            piezas: [],
            estadosPiezas: [],
            log: [],
            zipBlob: null,
            zipUrl: null,
            zipNombre: ''
        };

        estado.unidades.set(x.el, u);
        montar(u);
    }

    sincronizarBotonCurso();
    desplegarEvaluacionesAutomaticamente(marcarEvaluaciones);
}

export async function rehidratarDomCurso(uActiva = null, pcActivo = null) {
    await esperarHasta(
        () => !enVistaDocumentoPantallaCompleta() && !!document.querySelector(TARJETAS),
        CFG.ESPERA_CARGA
    );
    await dormir(400);

    const nuevasCabeceras = cabeceras();
    const todos = nuevasCabeceras.map(x => x.el);

    for (const x of nuevasCabeceras) {
        const raiz = buscarRaiz(x.el, todos);
        if (!raiz) continue;
        const cid = raiz.getAttribute('data-content-id') || '';

        const existente = [...estado.unidades.values()].find(
            u => (cid && u.contentId === cid) || canon(u.nombre) === canon(x.nombre)
        );

        if (existente) {
            if (existente.titulo !== x.el) {
                estado.unidades.delete(existente.titulo);
                existente.titulo = x.el;
                existente.raiz = raiz;
                estado.unidades.set(x.el, existente);
            } else {
                existente.raiz = raiz;
            }
            if (!existente.panel?.isConnected) {
                const estadoTextoPrevio = existente.estado?.textContent || '';
                const pctPrevio = existente.pct?.textContent || '0%';
                montar(existente);
                if (estadoTextoPrevio) existente.estado.textContent = estadoTextoPrevio;
                if (pctPrevio) existente.pct.textContent = pctPrevio;

                if (existente.estadosPiezas?.length) {
                    const copiaEstados = existente.estadosPiezas.map(s => ({ ...s }));
                    crearPiezas(existente, copiaEstados);
                    copiaEstados.forEach((st, idx) => {
                        if (st.estado) pieza(existente, idx, st.estado, st.nombre);
                    });
                }

                if (estado.ocupado && estado.tareaActiva === existente) {
                    cambiarTextoBoton(existente.boton, 'Detener descarga');
                    existente.boton.classList.add('detener');
                    existente.boton.disabled = false;
                } else if (estado.ocupado) {
                    existente.boton.disabled = true;
                }
            }
        }
    }

    if (pcActivo && !pcActivo.panel?.isConnected) {
        const tituloHeader =
            document.getElementById('course-content-outline-header-text') ||
            document.querySelector('header.outline-header h2');
        const filaHeader = tituloHeader?.parentElement;
        if (filaHeader) {
            const botonBuscar = filaHeader.querySelector(
                '[data-analytics-id="course-outline.filter.search.button"], a, button'
            );
            if (botonBuscar && botonBuscar !== tituloHeader) {
                filaHeader.insertBefore(pcActivo.panel, botonBuscar);
            } else {
                filaHeader.appendChild(pcActivo.panel);
            }
        }
    }

    if (uActiva) {
        await expandirCarpetas(uActiva);
    }

    restaurarColoresFilas();
    marcarEvaluaciones();
}

export function registrarControlColapsoEvaluaciones() {
    if (window.__maximusClickEvalListener) {
        document.removeEventListener('click', window.__maximusClickEvalListener, true);
    }

    const selectorBotonesToggle =
        'button[id^="learning-module-title-"],' +
        '[data-analytics-id="course.learning.module.base.item.toggleLm.button"],' +
        'button[id^="folder-title-"],' +
        '[data-analytics-id="content.item.folder.toggleFolder.button"],' +
        'button[aria-expanded],' +
        '[role="button"][aria-expanded]';

    const selectorIgnorarBtn =
        '.js-review-state-icon-button,' +
        '[id^="content-item-overflow-menu-button-"],' +
        '[data-analytics-id="components.common.conditional-release-info.buttonBase"]';

    const manejarClick = e => {
        if (!e.isTrusted) return;
        const target = e.target;
        if (!target?.closest) return;
        if (target.closest(`[data-maximus], ${selectorIgnorarBtn}`)) return;

        const card = target.closest(TARJETAS);
        if (!card) return;

        const btnDirecto = target.closest(selectorBotonesToggle);
        let btn = btnDirecto && btnDirecto.closest(TARJETAS) === card ? btnDirecto : null;

        if (!btn) {
            const cabecera = target.closest(
                '.outline-item-inner, .click-to-invoke-container, [class*="learningModuleItem"], [class*="itemContainer"]'
            );
            if (!cabecera || cabecera.closest(TARJETAS) !== card) return;
            if (cabecera.matches('[class*="itemContainer"]') && cabecera.querySelector(TARJETAS)) return;

            btn = [...cabecera.querySelectorAll(selectorBotonesToggle)].find(
                b => b.closest(TARJETAS) === card && !b.matches(selectorIgnorarBtn)
            );
        }

        if (!btn || btn.matches(selectorIgnorarBtn)) return;

        const cid = card.getAttribute('data-content-id') || '';
        if (!cid) return;

        const expandido = btn.getAttribute('aria-expanded');
        if (expandido === 'true') {
            estado.evaluacionesColapsadasUsuario.add(cid);
        } else if (expandido === 'false') {
            estado.evaluacionesColapsadasUsuario.delete(cid);
        }
    };

    window.__maximusClickEvalListener = manejarClick;
    document.addEventListener('click', manejarClick, true);
}

export function agendar() {
    if (enVistaDocumentoPantallaCompleta()) {
        limpiarPanelesEnVistaDocumento();
        return;
    }
    if (estado.ocupado || estado.pendiente) return;
    estado.pendiente = true;
    setTimeout(() => {
        estado.pendiente = false;
        descubrir();
    }, 550);
}

export function iniciar() {
    if (!compatible()) return;

    // Si había una instancia previa corriendo tras actualizar desde GitHub, la limpia antes de volver a montar.
    if (window.__maximusObserver) {
        try {
            window.__maximusObserver.disconnect();
        } catch {
            // Ignorar si ya estaba desconectado.
        }
    }

    document.querySelectorAll('.maximus-panel, .maximus-eval-backdrop, .maximus-eval-notif').forEach(p => p.remove());
    estado.unidades.clear();
    estado.panelCurso = null;
    estado.evaluacionesCursoId = '';
    estado.evaluacionesEnCurso = false;
    estado.evaluacionesReintentar = false;
    estado.evaluacionesColapsadasUsuario.clear();
    estado.evaluacionesModulosSinEval.clear();
    estado.evaluacionesCarpetasConEval.clear();
    estado.evaluacionesCacheApi.clear();
    estado.evaluacionesBotonesAutoAbiertos = new WeakSet();
    estado.evaluacionesNotificacionCerrada = false;
    estado.evaluacionesAutomatizacionActiva = false;
    if (estado.evaluacionesTimerBackdrop) {
        clearTimeout(estado.evaluacionesTimerBackdrop);
        estado.evaluacionesTimerBackdrop = null;
    }
    if (document.documentElement) {
        document.documentElement.dataset.maximusIniciado = '1';
    }

    registrarRehidratador(rehidratarDomCurso);
    registrarAgendador(agendar);
    registrarControlColapsoEvaluaciones();

    activarInterceptorIframes();
    inyectarCss();
    descubrir();

    window.__maximusObserver = new MutationObserver(agendar);
    window.__maximusObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
} else {
    iniciar();
}
