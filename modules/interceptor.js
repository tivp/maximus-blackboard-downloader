// Freno a redirecciones fuera de /outline, bloqueo de descargas sueltas y corte de carga en iframes de Unity/SCORM.

import { estado } from './config.js';
import { esUrlExterna, esUrlScormOInteractivo, esRutaSpaBlackboard, visible } from './utils.js';

export function esVisorInteractivoUnity() {
    if (estado.ultimoInteractivoDetectado) return true;
    if (/\/ultra\/courses\/[^/]+\/scorm\//i.test(location.pathname)) return true;

    const scormEl = document.querySelector(
        'section.page-scorm-launch-frame, bb-scorm-launch-frame, iframe#scorm-launch-iframe, iframe[src*="scor-scormengine"], iframe[ng-src*="scor-scormengine"], [aria-label="Iniciar SCORM"]'
    );
    if (scormEl && visible(scormEl)) return true;

    const unityEl = document.querySelector(
        '#unity-container, #unity-canvas, .unity-desktop, .unity-mobile, canvas[id*="unity" i]'
    );
    if (unityEl && visible(unityEl)) return true;

    return false;
}

export function enVistaDocumentoPantallaCompleta() {
    return !!(
        esVisorInteractivoUnity() ||
        document.querySelector('document-panel, section.page-scorm-launch-frame, bb-scorm-launch-frame, learning-module-panel-view') ||
        /\/ultra\/courses\/[^/]+\/(?:document|scorm)\//i.test(location.pathname)
    );
}

export function activarInterceptorIframes() {
    const registrarUrlPopup = rawUrl => {
        try {
            const abs = new URL(String(rawUrl), location.href).href;
            if (esUrlScormOInteractivo(abs)) {
                estado.ultimoInteractivoDetectado = true;
            } else {
                estado.ultimaUrlIframeInterceptada = abs;
            }
        } catch {
            // URL mal formada.
        }
    };

    // Recibe las URLs que page-hook.js atrapa cuando Blackboard llama a window.open en el mundo principal.
    window.addEventListener('maximus-popup-interceptado', e => {
        if (estado.ocupado && e.detail?.url) {
            registrarUrlPopup(e.detail.url);
        }
    });

    try {
        const nativoRAF = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = callback => {
            if (estado.ocupado && document.hidden) {
                return setTimeout(() => callback(performance.now()), 16);
            }
            return nativoRAF(callback);
        };
    } catch {
        // En la extensión esto también lo cubre page-hook.js en el mundo principal.
    }

    try {
        const nativoWindowOpen = window.open.bind(window);
        window.open = function (url, ...args) {
            if (estado.ocupado && url) {
                registrarUrlPopup(url);
                return null;
            }
            return nativoWindowOpen(url, ...args);
        };
    } catch {
        // Algunos entornos congelan window.open; de eso se encarga page-hook.js.
    }

    // Si un recurso intenta abrir un enlace externo o forzar una navegación fuera de /outline, guardamos la URL y frenamos el clic.
    document.addEventListener(
        'click',
        e => {
            if (!estado.ocupado) return;
            const a = e.target?.closest?.('a[href]');
            if (!a) return;

            // El enlace de migas de pan sí tiene que pasar porque se usa para volver al listado del curso.
            if (
                a.getAttribute('data-analytics-id') === 'course.content.header.breadcrumbs.course.link' ||
                /\/outline(?:$|[?#])/i.test(a.getAttribute('href') || '')
            ) {
                return;
            }

            const rawHref = a.getAttribute('href') || '';
            if (
                !rawHref ||
                rawHref.startsWith('blob:') ||
                rawHref.startsWith('javascript:') ||
                rawHref.startsWith('#') ||
                a.hasAttribute('download')
            ) {
                return;
            }

            if (!esRutaSpaBlackboard(rawHref)) {
                try {
                    estado.ultimaUrlIframeInterceptada = new URL(rawHref, location.href).href;
                } catch {
                    // Ignorar si no es una URL válida.
                }
                e.preventDefault();
            }
        },
        true
    );

    // Corta la carga de iframes apenas aparecen para que Unity no consuma memoria ni se disparen descargas fuera del ZIP.
    const silenciarIframe = iframe => {
        if (!estado.ocupado || !iframe || iframe.tagName !== 'IFRAME') return;
        if (iframe.dataset.maximusNinja === '1') return;

        const id = iframe.id || '';
        const rawSrc = iframe.getAttribute('src') || iframe.getAttribute('ng-src') || '';
        const title = iframe.getAttribute('title') || '';

        if (
            id === 'scorm-launch-iframe' ||
            /scorm/i.test(id) ||
            /scorm/i.test(title) ||
            esUrlScormOInteractivo(rawSrc) ||
            iframe.closest('bb-scorm-launch-frame, .page-scorm-launch-frame')
        ) {
            estado.ultimoInteractivoDetectado = true;
            iframe.dataset.maximusScorm = '1';
            if (rawSrc && rawSrc !== 'about:blank') {
                iframe.dataset.maximusSrc = rawSrc;
                iframe.setAttribute('src', 'about:blank');
            }
            return;
        }

        const enPanel = iframe.closest('.bb-offcanvas-panel, .ms-Panel, [class*="rootIsOpen_"]');
        if (id !== 'url-launch-iframe' && !enPanel) return;

        if (
            rawSrc &&
            rawSrc !== 'about:blank' &&
            !rawSrc.startsWith('javascript:') &&
            (/bbcswebdav|xythos|xid-|download|\.html?(?:$|[?#])/i.test(rawSrc) ||
                esUrlExterna(rawSrc))
        ) {
            estado.ultimaUrlIframeInterceptada = rawSrc;
            iframe.dataset.maximusSrc = rawSrc;
            iframe.setAttribute('src', 'about:blank');
        }
    };

    new MutationObserver(mutaciones => {
        if (!estado.ocupado) return;
        for (const m of mutaciones) {
            if (m.type === 'attributes' && m.target.tagName === 'IFRAME') {
                silenciarIframe(m.target);
            } else if (m.type === 'childList') {
                for (const nodo of m.addedNodes) {
                    if (nodo.nodeType !== 1) continue;
                    if (nodo.tagName === 'IFRAME') {
                        silenciarIframe(nodo);
                    } else if (nodo.querySelectorAll) {
                        nodo.querySelectorAll('iframe').forEach(silenciarIframe);
                    }
                }
            }
        }
    }).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
    });
}
