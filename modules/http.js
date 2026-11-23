// Descarga de archivos, lectura de cabeceras binarias (magic bytes), armado de accesos .url y rastreo de visores HTML.

import { CFG, RE, estado, verificarCancelacion } from './config.js';
import {
    texto,
    seguro,
    limpiarPrefijoXid,
    esUrlExterna,
    esUrlScormOInteractivo,
    esRutaSpaBlackboard,
    urlReal,
    ejecutarPool
} from './utils.js';

function parsearCabeceras(raw) {
    const h = {};
    for (const linea of String(raw || '').split(/\r?\n/)) {
        const p = linea.indexOf(':');
        if (p > 0) {
            h[linea.slice(0, p).trim().toLowerCase()] = linea.slice(p + 1).trim();
        }
    }
    return h;
}

function base64ABytes(b64) {
    if (typeof Uint8Array.fromBase64 === 'function') {
        return Uint8Array.fromBase64(b64);
    }
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
}

function peticionViaRuntime(url) {
    return new Promise((resolve, reject) => {
        if (estado.cancelado) {
            const err = new Error('Descarga detenida por el usuario');
            err.esCancelacion = true;
            return reject(err);
        }

        let finalizado = false;
        const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const abortar = () => {
            if (finalizado) return;
            finalizado = true;
            clearTimeout(timer);
            estado.abortadoresActivos.delete(abortar);
            try {
                chrome.runtime.sendMessage({ action: 'MAXIMUS_ABORT', requestId });
            } catch {
                // Ignorar
            }
            const err = new Error('Descarga detenida por el usuario');
            err.esCancelacion = true;
            reject(err);
        };

        estado.abortadoresActivos.add(abortar);

        const timer = setTimeout(() => {
            if (finalizado) return;
            finalizado = true;
            estado.abortadoresActivos.delete(abortar);
            try {
                chrome.runtime.sendMessage({ action: 'MAXIMUS_ABORT', requestId });
            } catch {
                // Ignorar
            }
            reject(new Error('Tiempo agotado'));
        }, CFG.TIMEOUT);

        try {
            chrome.runtime.sendMessage(
                {
                    action: 'MAXIMUS_FETCH',
                    requestId,
                    url,
                    timeout: CFG.TIMEOUT,
                    maxBytes: CFG.MAX_MB * 1048576
                },
                respuesta => {
                    if (finalizado) return;
                    finalizado = true;
                    clearTimeout(timer);
                    estado.abortadoresActivos.delete(abortar);

                    if (chrome.runtime.lastError) {
                        return reject(new Error(chrome.runtime.lastError.message || 'Error en background'));
                    }
                    if (!respuesta || !respuesta.ok) {
                        return reject(new Error(respuesta?.error || 'Error de red o CORS'));
                    }

                    try {
                        const bytes = base64ABytes(respuesta.base64);
                        if (!bytes.byteLength) {
                            return reject(new Error('Archivo vacío'));
                        }
                        resolve({
                            bytes,
                            headers: respuesta.headers || {},
                            url: respuesta.url || url
                        });
                    } catch (e) {
                        reject(new Error(`Fallo al decodificar binario: ${e.message}`));
                    }
                }
            );
        } catch (err) {
            if (finalizado) return;
            finalizado = true;
            clearTimeout(timer);
            estado.abortadoresActivos.delete(abortar);
            reject(err);
        }
    });
}

function peticionViaPuenteDom(url) {
    return new Promise((resolve, reject) => {
        if (estado.cancelado) {
            const err = new Error('Descarga detenida por el usuario');
            err.esCancelacion = true;
            return reject(err);
        }

        let finalizado = false;
        let ackRecibido = false;
        const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const eventoRespuesta = `maximus-bridge-res-${requestId}`;

        const limpiar = () => {
            clearTimeout(timer);
            if (timerAck) clearTimeout(timerAck);
            estado.abortadoresActivos.delete(abortar);
            window.removeEventListener('message', alMensaje);
            window.removeEventListener(eventoRespuesta, alEvento);
        };

        const procesarPayload = respuesta => {
            if (finalizado) return;
            ackRecibido = true;
            finalizado = true;
            limpiar();

            if (!respuesta || !respuesta.ok) {
                return reject(new Error(respuesta?.error || 'Error de red o CORS'));
            }

            try {
                const bytes = base64ABytes(respuesta.base64);
                if (!bytes.byteLength) {
                    return reject(new Error('Archivo vacío'));
                }
                resolve({
                    bytes,
                    headers: respuesta.headers || {},
                    url: respuesta.url || url
                });
            } catch (err) {
                reject(new Error(`Fallo al decodificar binario: ${err.message}`));
            }
        };

        const alMensaje = e => {
            if (e.source !== window || !e.data) return;
            if (e.data.__maximus === 'bridge-ack' && e.data?.requestId === requestId) {
                ackRecibido = true;
                if (timerAck) clearTimeout(timerAck);
                return;
            }
            if (e.data.__maximus === 'bridge-res' && e.data?.requestId === requestId) {
                procesarPayload(e.data.payload);
            }
        };

        const alEvento = e => {
            let payload = e.detail;
            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch {
                    payload = null;
                }
            }
            procesarPayload(payload);
        };

        const abortar = () => {
            if (finalizado) return;
            finalizado = true;
            limpiar();
            window.postMessage({ __maximus: 'bridge-abort', requestId }, location.origin || '*');
            window.dispatchEvent(new CustomEvent('maximus-bridge-abort', { detail: { requestId } }));
            const err = new Error('Descarga detenida por el usuario');
            err.esCancelacion = true;
            reject(err);
        };

        estado.abortadoresActivos.add(abortar);

        // Solo exigimos ACK rápido cuando el content.js cargado en la pestaña soporta bridge-ack (v2).
        const soportaAck = document.documentElement?.dataset?.maximusBridgeV2 === '1';
        const timerAck = soportaAck
            ? setTimeout(() => {
                  if (finalizado || ackRecibido) return;
                  finalizado = true;
                  limpiar();
                  reject(new Error('Puente DOM sin respuesta'));
              }, 2000)
            : null;

        const timer = setTimeout(() => {
            if (finalizado) return;
            finalizado = true;
            limpiar();
            window.postMessage({ __maximus: 'bridge-abort', requestId }, location.origin || '*');
            window.dispatchEvent(new CustomEvent('maximus-bridge-abort', { detail: { requestId } }));
            reject(new Error('Tiempo agotado'));
        }, CFG.TIMEOUT);

        window.addEventListener('message', alMensaje);
        window.addEventListener(eventoRespuesta, alEvento, { once: true });

        const detalleEnvio = {
            requestId,
            url,
            timeout: CFG.TIMEOUT,
            maxBytes: CFG.MAX_MB * 1048576
        };
        window.postMessage({ __maximus: 'bridge-fetch', ...detalleEnvio }, location.origin || '*');
        window.dispatchEvent(new CustomEvent('maximus-bridge-fetch', { detail: detalleEnvio }));
    });
}

// Descarga mediante el Service Worker de la extensión (o GM_xmlhttpRequest en Tampermonkey) para saltar bloqueos CORS en servidores externos.
async function peticionExterna(url) {
    if (typeof GM_xmlhttpRequest === 'function') {
        return new Promise((resolve, reject) => {
            if (estado.cancelado) {
                const err = new Error('Descarga detenida por el usuario');
                err.esCancelacion = true;
                return reject(err);
            }

            let finalizado = false;
            let req = null;

            const abortar = () => {
                if (finalizado) return;
                finalizado = true;
                clearTimeout(timer);
                estado.abortadoresActivos.delete(abortar);
                try {
                    req?.abort?.();
                } catch {
                    // Ignorar
                }
                const err = new Error('Descarga detenida por el usuario');
                err.esCancelacion = true;
                reject(err);
            };

            estado.abortadoresActivos.add(abortar);

            const timer = setTimeout(() => {
                if (finalizado) return;
                finalizado = true;
                estado.abortadoresActivos.delete(abortar);
                try {
                    req?.abort?.();
                } catch {
                    // Ignorar
                }
                reject(new Error('Tiempo agotado'));
            }, CFG.TIMEOUT);

            const fin = (fn, val) => {
                if (finalizado) return;
                finalizado = true;
                clearTimeout(timer);
                estado.abortadoresActivos.delete(abortar);
                fn(val);
            };

            req = GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType: 'arraybuffer',
                timeout: CFG.TIMEOUT,
                anonymous: false,
                headers: { Accept: '*/*' },
                onload: r => {
                    if (r.status < 200 || r.status >= 300) {
                        return fin(reject, new Error(`HTTP ${r.status}`));
                    }
                    const buffer = r.response;
                    if (!buffer || !buffer.byteLength) {
                        return fin(reject, new Error('Archivo vacío'));
                    }
                    if (buffer.byteLength > CFG.MAX_MB * 1048576) {
                        return fin(reject, new Error('Archivo demasiado grande'));
                    }
                    fin(resolve, {
                        bytes: buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer),
                        headers: parsearCabeceras(r.responseHeaders),
                        url: r.finalUrl || url
                    });
                },
                onerror: () => fin(reject, new Error('Error de red o CORS')),
                ontimeout: () => fin(reject, new Error('Tiempo agotado')),
                onabort: () => {
                    const err = new Error('Descarga detenida por el usuario');
                    err.esCancelacion = true;
                    fin(reject, err);
                }
            });
        });
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
            return await peticionViaRuntime(url);
        } catch (err) {
            if (err?.esCancelacion || estado.cancelado) throw err;
            if (document.documentElement?.dataset?.maximusBridge === '1') {
                return await peticionViaPuenteDom(url);
            }
            throw err;
        }
    }

    // Si el bundle corre en USER_SCRIPT o MAIN sin acceso directo a chrome.runtime, usa el puente DOM de content.js.
    if (document.documentElement?.dataset?.maximusBridge === '1') {
        return await peticionViaPuenteDom(url);
    }

    return await fetchLocal(url);
}

async function fetchLocal(url) {
    verificarCancelacion();

    const ctrl = new AbortController();
    const abortar = () => ctrl.abort();
    estado.abortadoresActivos.add(abortar);
    const timeout = setTimeout(() => ctrl.abort(), CFG.TIMEOUT);

    try {
        const r = await fetch(url, {
            credentials: 'include',
            redirect: 'follow',
            signal: ctrl.signal
        });

        if (!r.ok) {
            throw new Error(`HTTP ${r.status}`);
        }

        if (Number(r.headers.get('content-length') || 0) > CFG.MAX_MB * 1048576) {
            throw new Error('Archivo demasiado grande');
        }

        const bytes = new Uint8Array(await r.arrayBuffer());

        if (!bytes.length || bytes.length > CFG.MAX_MB * 1048576) {
            throw new Error('Respuesta vacía o demasiado grande');
        }

        return {
            bytes,
            headers: Object.fromEntries(r.headers.entries()),
            url: r.url || url
        };
    } catch (e) {
        if (estado.cancelado) {
            const err = new Error('Descarga detenida por el usuario');
            err.esCancelacion = true;
            throw err;
        }
        throw e;
    } finally {
        clearTimeout(timeout);
        estado.abortadoresActivos.delete(abortar);
    }
}

function esHtmlRecursoDescargable(res) {
    try {
        const u = new URL(res.url, location.href);
        const cd = String(res.headers?.['content-disposition'] || '').toLowerCase();

        if (cd.includes('attachment') || /\.html?\b/i.test(cd)) {
            return true;
        }

        if (u.origin !== location.origin) {
            return true;
        }

        if (
            /\.html?$/i.test(u.pathname) &&
            !/^\/(?:ultra|webapps\/login|webapps\/portal)\b/i.test(u.pathname)
        ) {
            return true;
        }
    } catch {
        // Ignorar URL inválida.
    }
    return false;
}

// A las presentaciones HTML descargadas se les mete un <base href="..."> para que sus imágenes y hojas CSS carguen bien al abrirlas desde el PC.
function prepararBytesHtml(res) {
    try {
        const textoHtml = new TextDecoder('utf-8').decode(res.bytes);
        if (!/<base\b/i.test(textoHtml) && /^https?:/i.test(res.url)) {
            const baseTag = `<base href="${res.url.replace(/"/g, '&quot;')}">`;
            let modificado = textoHtml;
            if (/<head\b[^>]*>/i.test(modificado)) {
                modificado = modificado.replace(/(<head\b[^>]*>)/i, `$1\n    ${baseTag}`);
            } else if (/<html\b[^>]*>/i.test(modificado)) {
                modificado = modificado.replace(/(<html\b[^>]*>)/i, `$1\n<head>${baseTag}</head>`);
            } else {
                modificado = `${baseTag}\n${modificado}`;
            }
            return new TextEncoder().encode(modificado);
        }
    } catch {
        // Si no es UTF-8 válido, dejamos los bytes tal cual vinieron.
    }
    return res.bytes;
}

function crearAccesoDirectoHtml(res, nombreItemSugerido, subCarpeta = '') {
    let tituloAcceso = '';
    try {
        const html = new TextDecoder('utf-8').decode(res.bytes);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        tituloAcceso = texto(doc.querySelector('title')?.textContent || '');
    } catch {
        // Ignorar fallo de parseo.
    }

    if (!tituloAcceso) {
        tituloAcceso = texto(nombreItemSugerido || '').replace(/\.html?$/i, '') || 'Acceso directo web';
    }

    const nombreBase = seguro(tituloAcceso, 'Acceso directo web').replace(/\.url$/i, '');
    const contenidoUrl = `[InternetShortcut]\r\nURL=${res.url}\r\n`;

    return {
        nombre: `${nombreBase}.url`,
        bytes: new TextEncoder().encode(contenidoUrl),
        subCarpeta
    };
}

// Mira los primeros bytes reales del archivo porque Blackboard a veces manda PDFs o ZIPs con Content-Type genérico octet-stream.
export function analizar(res) {
    const b = res.bytes;

    const mime = String(res.headers['content-type'] || '')
        .split(';')[0]
        .trim()
        .toLowerCase();

    const cd = String(res.headers['content-disposition'] || '').toLowerCase();

    const inicio = new TextDecoder()
        .decode(b.subarray(0, 700))
        .trimStart();

    if (
        /^<!doctype\s+html|^<html\b|^<head\b|^<body\b/i.test(inicio) ||
        /text\/html|application\/xhtml/.test(mime)
    ) {
        if (esHtmlRecursoDescargable(res)) {
            const extHtml = /\.htm$/i.test(new URL(res.url, location.href).pathname)
                ? '.htm'
                : '.html';
            return { tipo: 'archivo', ext: extHtml, esHtml: true };
        }
        return { tipo: 'html' };
    }

    if (new TextDecoder('latin1').decode(b.subarray(0, 1024)).includes('%PDF-')) {
        return { tipo: 'archivo', ext: '.pdf' };
    }

    if (mime === 'application/pdf' || /\.pdf(?:[?#]|$)/i.test(res.url)) {
        return { tipo: 'invalido', razon: 'PDF sin cabecera %PDF-' };
    }

    if (
        (b[0] === 73 && b[1] === 68 && b[2] === 51) ||
        (b[0] === 255 && (b[1] & 224) === 224 && /audio|octet-stream/.test(mime))
    ) {
        return { tipo: 'archivo', ext: '.mp3' };
    }

    // Firma PK (0x50 0x4B): puede ser un .zip normal o un documento de Office moderno (.docx, .xlsx, .pptx).
    if (b[0] === 80 && b[1] === 75 && [3, 5, 7].includes(b[2])) {
        const urlExt = new URL(res.url, location.href).pathname
            .match(/\.(?:docx|xlsx|pptx|odt|ods|odp|epub|zip)$/i)?.[0]
            ?.toLowerCase();
        if (urlExt) return { tipo: 'archivo', ext: urlExt };
        if (/wordprocessingml/.test(mime)) return { tipo: 'archivo', ext: '.docx' };
        if (/spreadsheetml/.test(mime)) return { tipo: 'archivo', ext: '.xlsx' };
        if (/presentationml/.test(mime)) return { tipo: 'archivo', ext: '.pptx' };
        return { tipo: 'archivo', ext: '.zip' };
    }

    // Firma OLE2 de Office antiguo (.doc, .xls, .ppt).
    if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) {
        if (/ms-excel|excel/.test(mime)) return { tipo: 'archivo', ext: '.xls' };
        if (/powerpoint/.test(mime)) return { tipo: 'archivo', ext: '.ppt' };
        return { tipo: 'archivo', ext: '.doc' };
    }

    if (b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21) {
        return { tipo: 'archivo', ext: '.rar' };
    }

    if (b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf) {
        return { tipo: 'archivo', ext: '.7z' };
    }

    const decoder = new TextDecoder();

    if (decoder.decode(b.subarray(0, 4)) === 'OggS') {
        return { tipo: 'archivo', ext: '.ogg' };
    }

    if (decoder.decode(b.subarray(0, 4)) === 'fLaC') {
        return { tipo: 'archivo', ext: '.flac' };
    }

    if (
        decoder.decode(b.subarray(0, 4)) === 'RIFF' &&
        decoder.decode(b.subarray(8, 12)) === 'WAVE'
    ) {
        return { tipo: 'archivo', ext: '.wav' };
    }

    if (decoder.decode(b.subarray(4, 8)) === 'ftyp') {
        return {
            tipo: 'archivo',
            ext: /audio/.test(mime) ? '.m4a' : '.mp4'
        };
    }

    if (b[0] === 255 && b[1] === 216) {
        return { tipo: 'archivo', ext: '.jpg' };
    }

    if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71) {
        return { tipo: 'archivo', ext: '.png' };
    }

    const mimeExt = {
        'audio/mpeg': '.mp3',
        'audio/mp3': '.mp3',
        'audio/mp4': '.m4a',
        'audio/x-m4a': '.m4a',
        'audio/wav': '.wav',
        'audio/x-wav': '.wav',
        'audio/ogg': '.ogg',
        'audio/aac': '.aac',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'text/csv': '.csv',
        'text/plain': '.txt',
        'application/rtf': '.rtf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx'
    };

    if (mimeExt[mime]) {
        return { tipo: 'archivo', ext: mimeExt[mime] };
    }

    const extUrl = new URL(res.url, location.href).pathname
        .match(RE.archivo)?.[0]
        ?.toLowerCase();

    if (
        extUrl &&
        (!mime ||
            /octet-stream|force-download|application\/download/.test(mime) ||
            cd.includes('attachment'))
    ) {
        return { tipo: 'archivo', ext: extUrl };
    }

    if (cd.includes('attachment') || cd.includes('filename=')) {
        const m = cd.match(
            /\.(pdf|docx?|xlsx?|pptx?|html?|mp3|m4a|wav|mp4|zip|rar|7z|txt|csv)\b/i
        );
        return { tipo: 'archivo', ext: m ? `.${m[1].toLowerCase()}` : '.bin' };
    }

    if (/application\/json/.test(mime)) {
        return { tipo: 'json' };
    }

    return {
        tipo: 'invalido',
        razon: `Formato no reconocido: ${mime || 'sin tipo'}`
    };
}

export function archivoNombre(res, sugerido, tipo) {
    const cd = res.headers['content-disposition'] || '';

    let nombre =
        /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(cd)?.[1] ||
        /filename\s*=\s*"([^"]+)"/i.exec(cd)?.[1] ||
        /filename\s*=\s*([^;]+)/i.exec(cd)?.[1] ||
        '';

    try {
        nombre = decodeURIComponent(nombre.replace(/^['"]|['"]$/g, '').trim());
    } catch {
        // Dejar sin decodificar si trae secuencias % sueltas.
    }

    if (!RE.archivo.test(nombre)) {
        try {
            const u = new URL(res.url, location.href);
            const deParam =
                u.searchParams.get('filename') ||
                u.searchParams
                    .get('response-content-disposition')
                    ?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i)?.[1];

            if (deParam) {
                nombre = decodeURIComponent(deParam);
            } else {
                nombre = decodeURIComponent(u.pathname.split('/').pop() || '');
            }
        } catch {
            // Conservar nombre actual.
        }
    }

    nombre = limpiarPrefijoXid(nombre);

    if (!RE.archivo.test(nombre)) {
        nombre = sugerido;
    }

    nombre = seguro(nombre, 'Archivo');

    if (!RE.archivo.test(nombre)) {
        nombre += tipo.ext || '.bin';
    }

    if (tipo.ext === '.pdf' && !/\.pdf$/i.test(nombre)) {
        nombre = nombre.replace(/\.[^.]+$/, '') + '.pdf';
    }

    if (tipo.esHtml && !/\.html?$/i.test(nombre)) {
        nombre = nombre.replace(/\.[^.]+$/, '') + (tipo.ext || '.html');
    }

    return nombre;
}

export async function pedirArchivo(url) {
    verificarCancelacion();

    const errores = [];
    let pagina = null;

    const mismoOrigen = new URL(url, location.href).origin === location.origin;

    const metodos = mismoOrigen
        ? [['Fetch', fetchLocal], ['BG', peticionExterna]]
        : [['BG', peticionExterna], ['Fetch', fetchLocal]];

    for (const [nombre, fn] of metodos) {
        verificarCancelacion();
        try {
            const res = await fn(url);
            const tipo = analizar(res);

            if (tipo.tipo === 'archivo') {
                return { res, tipo };
            }

            if (tipo.tipo === 'html') {
                if (!pagina) pagina = { res, tipo };
                if (mismoOrigen && nombre === 'Fetch') {
                    return { res, tipo };
                }
            }

            errores.push(`${nombre}: ${tipo.razon || tipo.tipo}`);
        } catch (e) {
            if (e.esCancelacion || estado.cancelado) throw e;
            errores.push(`${nombre}: ${e.message}`);
            if (mismoOrigen && nombre === 'Fetch' && /^HTTP (?:404|410)\b/.test(e.message || '')) {
                break;
            }
        }
    }

    if (pagina) return pagina;

    throw new Error(errores.join(' | ') || 'No se pudo descargar');
}

function linksHTML(res) {
    const html = new TextDecoder().decode(res.bytes);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    if (
        doc.querySelector('input[type="password"]') &&
        /login|iniciar sesi[oó]n|sign in/i.test(doc.body?.textContent || '')
    ) {
        throw new Error('Sesión expirada');
    }

    const encontrados = new Map();

    const agregar = (raw, nombre = 'Archivo') => {
        const url = urlReal(raw, res.url);
        if (
            url &&
            (RE.archivo.test(url) || RE.descarga.test(url) || esUrlExterna(url)) &&
            !encontrados.has(url)
        ) {
            encontrados.set(url, { url, nombre });
        }
    };

    for (const el of doc.querySelectorAll(
        'a[href],a[data-ally-file-preview-url],iframe[src],embed[src],object[data],audio[src],video[src],source[src],[data-download-url]'
    )) {
        const nombre =
            texto(
                el.getAttribute('download') ||
                el.getAttribute('data-ally-file-eid') ||
                el.getAttribute('title') ||
                el.textContent
            ) || 'Archivo';

        for (const attr of ['href', 'data-ally-file-preview-url', 'src', 'data', 'data-download-url']) {
            const valor = el.getAttribute(attr);
            if (valor) agregar(valor, nombre);
        }

        if (encontrados.size >= CFG.MAX_ENLACES) break;
    }

    const regex =
        /(?:fileUrl|downloadUrl|resourceUrl|pdfUrl|audioUrl|mediaUrl|signedUrl|url)\s*["']?\s*[:=]\s*["']([^"']{5,1500})["']/gi;

    for (const m of html.matchAll(regex)) {
        agregar(m[1]);
        if (encontrados.size >= CFG.MAX_ENLACES) break;
    }

    return [...encontrados.values()];
}

export async function recuperar(url, nombre, nivel = 0, visitados = new Set(), subCarpeta = '') {
    verificarCancelacion();

    const real = urlReal(url);

    if (!real || visitados.has(real)) {
        return { archivos: [], errores: [] };
    }

    visitados.add(real);

    const intentos = [real];

    if (/bbcswebdav|\/attachments?\/|xid-/i.test(real)) {
        try {
            const forzada = new URL(real);
            forzada.searchParams.set('isForcedDownload', 'true');
            intentos.push(forzada.href);
        } catch {
            // Ignorar
        }
    }

    let pagina = null;
    const errores = [];

    for (const intento of [...new Set(intentos)]) {
        verificarCancelacion();
        try {
            const x = await pedirArchivo(intento);

            if (x.tipo.tipo === 'archivo') {
                const bytesFinales = x.tipo.esHtml
                    ? prepararBytesHtml(x.res)
                    : x.res.bytes;

                const archivosSalida = [
                    {
                        nombre: archivoNombre(x.res, nombre, x.tipo),
                        bytes: bytesFinales,
                        subCarpeta
                    }
                ];

                if (x.tipo.esHtml && /^https?:/i.test(x.res.url)) {
                    archivosSalida.push(crearAccesoDirectoHtml(x.res, nombre, subCarpeta));
                }

                return {
                    archivos: archivosSalida,
                    errores: []
                };
            }

            if (x.tipo.tipo === 'html') {
                pagina = x.res;
            }
        } catch (e) {
            if (e.esCancelacion || estado.cancelado) throw e;
            errores.push(e.message);
        }
    }

    if (!pagina || nivel >= CFG.MAX_HTML) {
        return {
            archivos: [],
            errores: errores.length ? errores : ['Visor sin archivo descargable']
        };
    }

    const links = linksHTML(pagina);

    if (!links.length) {
        if (!esRutaSpaBlackboard(pagina.url) && !esUrlScormOInteractivo(pagina.url)) {
            const tipoHtml = { tipo: 'archivo', ext: '.html', esHtml: true };
            const archivosSalida = [
                {
                    nombre: archivoNombre(pagina, nombre, tipoHtml),
                    bytes: prepararBytesHtml(pagina),
                    subCarpeta
                }
            ];

            if (/^https?:/i.test(pagina.url)) {
                archivosSalida.push(crearAccesoDirectoHtml(pagina, nombre, subCarpeta));
            }

            return {
                archivos: archivosSalida,
                errores: []
            };
        }

        return {
            archivos: [],
            errores: ['Visor HTML sin URL de archivo']
        };
    }

    const resultado = { archivos: [], errores: [] };
    const respuestas = await ejecutarPool(
        links,
        Math.min(3, links.length),
        async item => {
            verificarCancelacion();
            try {
                return await recuperar(
                    item.url,
                    item.nombre === 'Archivo' ? nombre : item.nombre,
                    nivel + 1,
                    visitados,
                    subCarpeta
                );
            } catch (e) {
                if (e.esCancelacion || estado.cancelado) throw e;
                return { archivos: [], errores: [e.message] };
            }
        }
    );

    verificarCancelacion();
    for (const r of respuestas) {
        if (!r) continue;
        resultado.archivos.push(...r.archivos);
        resultado.errores.push(...r.errores);
    }

    return resultado;
}
