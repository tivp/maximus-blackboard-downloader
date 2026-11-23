// Utilidades de texto, validación de URLs, tiempos en segundo plano y lectura del DOM base.

import { RE, TARJETAS, estado } from './config.js';

// Chrome y Edge atrasan setTimeout a 1 segundo o más cuando la pestaña está oculta.
// Un Web Worker en un Blob aparte mantiene el reloj a tiempo real aunque el usuario cambie de ventana.
export const dormir = (() => {
    try {
        const blob = new Blob(
            ['onmessage = function(e) { setTimeout(function() { postMessage(e.data.id); }, e.data.ms); };'],
            { type: 'application/javascript' }
        );
        const worker = new Worker(URL.createObjectURL(blob));
        const callbacks = new Map();
        let seq = 0;

        worker.onmessage = e => {
            const fn = callbacks.get(e.data);
            if (fn) {
                callbacks.delete(e.data);
                fn();
            }
        };

        return ms =>
            new Promise(resolve => {
                const id = ++seq;
                callbacks.set(id, resolve);
                worker.postMessage({ id, ms });
            });
    } catch {
        // Si la política CSP del sitio bloquea el Worker con blob:, caemos al setTimeout normal.
        return ms => new Promise(resolve => setTimeout(resolve, ms));
    }
})();

export const texto = value =>
    String(value ?? '')
        .replace(/[\u200b-\u200d\ufeff\u00a0]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const canon = value => texto(value).toLocaleLowerCase('es');

// Quita caracteres prohibidos en nombres de archivo de Windows y recorta a 140 letras para no romper rutas largas en el ZIP.
export const seguro = (value, defecto = 'Sin nombre') => {
    const nombre = texto(value)
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[. ]+$/g, '')
        .slice(0, 140);

    return nombre || defecto;
};

// Blackboard suele pegarle prefijos internos como "xid-12345_1" o "_123_1" al nombre real de los archivos.
export const limpiarPrefijoXid = nombre => {
    const limpio = String(nombre || '').replace(/^(?:_?\d+_\d+|xid-\d+_\d+)(?=[A-Za-z])/i, '');
    return limpio || nombre;
};

export const clonarBytes = src => {
    if (!src) return new Uint8Array(0);
    const vista = src instanceof Uint8Array ? src : new Uint8Array(src);
    const limpio = new Uint8Array(vista.byteLength);
    limpio.set(vista);
    return limpio;
};

export const visible = el =>
    !!el?.isConnected &&
    !!el.getClientRects().length &&
    getComputedStyle(el).visibility !== 'hidden';

export const posicion = (a, b) =>
    a === b
        ? 0
        : (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

export function esUrlExterna(rawUrl) {
    try {
        const u = new URL(rawUrl, location.href);
        return /^https?:$/.test(u.protocol) && u.origin !== location.origin;
    } catch {
        return false;
    }
}

export function esUrlScormOInteractivo(rawUrl) {
    return /scor-scormengine|\/scorm\/|launchPackage|unity|webgl|h5p/i.test(String(rawUrl || ''));
}

export function esRutaSpaBlackboard(rawUrl) {
    try {
        const u = new URL(rawUrl, location.href);
        return (
            u.origin === location.origin &&
            /\/ultra\/|\/learn\/|\/webapps\//i.test(u.pathname) &&
            !/\.html?$/i.test(u.pathname) &&
            !/bbcswebdav|xythos|filedownload/i.test(u.href)
        );
    } catch {
        return false;
    }
}

// Limpia URLs de atributos del DOM, saca enlaces reales escondidos en parámetros (?file=, ?url=) y descarta rutas vacías o de SCORM.
export const urlReal = (value, base = location.href) => {
    try {
        const limpia = String(value ?? '')
            .replace(/^file-preview-/i, '')
            .replace(/&amp;/gi, '&')
            .replace(/\\\//g, '/')
            .trim();

        if (!limpia || /^\s*(?:javascript:|data:|mailto:|tel:|about:|#)/i.test(limpia)) {
            return null;
        }

        const url = new URL(limpia, base);

        if (esUrlScormOInteractivo(url.href)) {
            return null;
        }

        if (
            url.origin === location.origin &&
            url.pathname === location.pathname &&
            !RE.archivo.test(url.href) &&
            !RE.descarga.test(url.href)
        ) {
            return null;
        }

        if (/\/ultra\/courses\/[^/]+\/(?:document|assessment|discussion|scorm)\//i.test(url.pathname)) {
            return null;
        }

        for (const param of ['file', 'url', 'src', 'document', 'pdf']) {
            const sub = url.searchParams.get(param);
            if (sub && (/^https?:\/\//i.test(sub) || sub.startsWith('/'))) {
                try {
                    const subUrl = new URL(sub, url.href);
                    if (
                        RE.archivo.test(subUrl.href) ||
                        RE.descarga.test(subUrl.href) ||
                        esUrlExterna(subUrl.href)
                    ) {
                        return subUrl.href;
                    }
                } catch {
                    // Seguimos con el siguiente parámetro.
                }
            }
        }

        return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
};

export async function esperarHasta(prueba, ms, paso = 50) {
    let transcurrido = 0;
    let ultimoTick = Date.now();

    while (transcurrido < ms) {
        if (estado.cancelado) return false;

        try {
            if (prueba()) return true;
        } catch {
            // El nodo puede estar a mitad de renderizado en Angular/React.
        }

        await dormir(paso);

        if (estado.cancelado) return false;

        const ahora = Date.now();
        if (!document.hidden) {
            transcurrido += Math.min(ahora - ultimoTick, paso * 3);
        }
        ultimoTick = ahora;
    }

    try {
        return !estado.cancelado && !!prueba();
    } catch {
        return false;
    }
}

export async function ejecutarPool(lista, concurrencia, tarea) {
    const items = Array.isArray(lista) ? lista : [];
    if (!items.length) return [];

    const limite = Math.max(1, Math.min(Number(concurrencia) || 1, items.length));
    const resultados = new Array(items.length);
    let cursor = 0;

    const worker = async () => {
        while (cursor < items.length) {
            if (estado.cancelado) break;
            const idx = cursor++;
            resultados[idx] = await tarea(items[idx], idx);
        }
    };

    await Promise.all(Array.from({ length: limite }, worker));
    return resultados;
}

export function compatible() {
    return (
        /blackboard|iplacex|aulavirtual/i.test(location.hostname) ||
        (!!(
            document.querySelector(TARJETAS) ||
            document.querySelector('document-panel, section.page-scorm-launch-frame, bb-scorm-launch-frame')
        ) &&
            /\/ultra\/|\/courses?\/|\/webapps\//i.test(location.pathname))
    );
}

export function obtenerIdCursoActual() {
    const m = location.pathname.match(/\/courses\/(_\d+_\d+)/i);
    return m ? m[1] : '';
}

export function obtenerNombreCurso() {
    const h1 = document.querySelector('course-banner h1, [class*="courseTitle"]');
    if (h1 && texto(h1.textContent)) {
        return seguro(h1.textContent, 'Curso Completo');
    }
    const t = texto(document.title).replace(/^Contenido\s*\/\s*/i, '');
    return seguro(t, 'Curso Completo');
}

// Extrae el título visible de un botón o tarjeta quitando antes iconos, textos para lectores de pantalla y paneles propios.
export function tituloEl(el) {
    if (!el) return '';

    const copia = el.cloneNode(true);
    copia
        .querySelectorAll('svg,img,i,[aria-hidden="true"],[data-maximus],.sr-only,.visually-hidden,ul,ol')
        .forEach(n => n.remove());

    return texto(copia.textContent || el.getAttribute('aria-label') || el.getAttribute('title'));
}
