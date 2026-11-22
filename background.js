// Service Worker de la extensión: descarga binarios saltando CORS y sincroniza los módulos desde GitHub.

const REPO_API_COMMIT = 'https://api.github.com/repos/tivp/maximus-blackboard-downloader/commits/main';
const REPO_RAW_BASE = 'https://raw.githubusercontent.com/tivp/maximus-blackboard-downloader/main';
const CACHE_KEY = 'maximus_github_cache';
const USER_SCRIPT_ID = 'maximus-github-bundle';

const ORDEN_MODULOS = [
    'config.js',
    'utils.js',
    'zip.js',
    'interceptor.js',
    'http.js',
    'api.js',
    'scanner.js',
    'ui.js',
    'visor.js',
    'downloader.js',
    'main.js'
];

const controladoresActivos = new Map();

function bufferABase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const bloque = 0x8000;
    const trozos = [];

    for (let i = 0; i < bytes.byteLength; i += bloque) {
        trozos.push(String.fromCharCode.apply(null, bytes.subarray(i, i + bloque)));
    }

    return btoa(trozos.join(''));
}

function tieneSoporteUserScripts() {
    return typeof chrome.userScripts !== 'undefined' && typeof chrome.userScripts.register === 'function';
}

// Une los 11 módulos ES6 en un único bloque ejecutable para registrarlo como User Script en MV3.
function compilarBundleDesdeModulos(mapaModulos) {
    const bloques = ORDEN_MODULOS.map(nombre => {
        let codigo = String(mapaModulos[nombre] || '');
        codigo = codigo.replace(/^import\s+[\s\S]*?\bfrom\s+['"][^'"]+['"];?[ \t]*(?:\r?\n|$)/gm, '');
        codigo = codigo.replace(/^export\s+(async\s+function|function|const|let)/gm, '$1');
        return `// --- ${nombre} ---\n${codigo.trim()}`;
    });

    return `(() => {\n'use strict';\n\n${bloques.join('\n\n')}\n})();\n`;
}

async function sincronizarUserScriptRegistrado(codigoCompilado) {
    if (!tieneSoporteUserScripts() || !codigoCompilado) {
        return false;
    }

    try {
        if (typeof chrome.userScripts.configureWorld === 'function') {
            try {
                await chrome.userScripts.configureWorld({ messaging: true });
            } catch {
                // Si el navegador no permite configurar messaging en el mundo aislado, se usa el puente DOM de content.js.
            }
        }

        try {
            await chrome.userScripts.unregister({ ids: [USER_SCRIPT_ID] });
        } catch {
            // Ignorar si todavía no había un script previo registrado.
        }

        await chrome.userScripts.register([
            {
                id: USER_SCRIPT_ID,
                matches: ['https://*/*'],
                js: [{ code: codigoCompilado }],
                runAt: 'document_idle',
                world: 'USER_SCRIPT'
            }
        ]);

        return true;
    } catch {
        return false;
    }
}

async function asegurarUserScriptDesdeCache() {
    if (!tieneSoporteUserScripts()) return { activo: false, registradoAhora: false, cache: null };

    const datos = await chrome.storage.local.get(CACHE_KEY);
    const cache = datos[CACHE_KEY] || null;
    if (!cache?.codigoCompilado) {
        return { activo: false, registradoAhora: false, cache: null };
    }

    try {
        const existentes = await chrome.userScripts.getScripts({ ids: [USER_SCRIPT_ID] });
        if (existentes && existentes.length > 0) {
            return { activo: true, registradoAhora: false, cache };
        }
    } catch {
        // Reintentar registro abajo.
    }

    const ok = await sincronizarUserScriptRegistrado(cache.codigoCompilado);
    return { activo: ok, registradoAhora: ok, cache };
}

async function esPestanaObjetivoMaximus(tab) {
    if (!tab?.id || !tab.url?.startsWith('https://')) return false;
    if (/blackboard|iplacex|aulavirtual|\/ultra\/|\/webapps\//i.test(tab.url)) {
        return true;
    }

    try {
        const [res] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.documentElement?.dataset?.maximusIniciado === '1'
        });
        return Boolean(res?.result);
    } catch {
        return false;
    }
}

async function ejecutarCodigoEnPestana(tabId, codigoCompilado) {
    if (!tabId || !codigoCompilado) return false;

    if (tieneSoporteUserScripts() && typeof chrome.userScripts.execute === 'function') {
        try {
            await chrome.userScripts.execute({
                target: { tabId },
                js: [{ code: codigoCompilado }],
                world: 'USER_SCRIPT'
            });
            return true;
        } catch {
            // Probar respaldo en mundo MAIN si la pestaña lo permite.
        }
    }

    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            args: [codigoCompilado],
            func: codigo => {
                const s = document.createElement('script');
                s.textContent = codigo;
                (document.head || document.documentElement).appendChild(s);
                s.remove();
            }
        });
        return true;
    } catch {
        return false;
    }
}

async function actualizarScriptsDesdeGithub() {
    const resCommit = await fetch(`${REPO_API_COMMIT}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json' }
    });

    if (!resCommit.ok) {
        throw new Error(`No se pudo consultar GitHub (HTTP ${resCommit.status})`);
    }

    const commitData = await resCommit.json();
    const sha = String(commitData.sha || '');
    const shaCorto = sha ? sha.slice(0, 7) : 'main';
    const mensajeCommit = String(commitData.commit?.message || 'Actualización').split('\n')[0].trim();
    const fechaCommit = commitData.commit?.author?.date || '';

    const entradas = await Promise.all(
        ORDEN_MODULOS.map(async nombre => {
            const url = `${REPO_RAW_BASE}/modules/${nombre}?t=${Date.now()}`;
            const resp = await fetch(url, { cache: 'no-store' });
            if (!resp.ok) {
                throw new Error(`Error al bajar modules/${nombre} (HTTP ${resp.status})`);
            }
            const texto = await resp.text();
            return [nombre, texto];
        })
    );

    const modulos = Object.fromEntries(entradas);
    const codigoCompilado = compilarBundleDesdeModulos(modulos);

    const cache = {
        sha,
        shaCorto,
        mensajeCommit,
        fechaCommit,
        actualizadoEn: new Date().toLocaleString('es-CL'),
        modulos,
        codigoCompilado
    };

    await chrome.storage.local.set({ [CACHE_KEY]: cache });

    const userScriptsActivo = await sincronizarUserScriptRegistrado(codigoCompilado);

    let pestanasActualizadas = 0;
    try {
        const pestanas = await chrome.tabs.query({ url: 'https://*/*' });
        for (const tab of pestanas) {
            if (await esPestanaObjetivoMaximus(tab)) {
                const ejecutado = await ejecutarCodigoEnPestana(tab.id, codigoCompilado);
                if (ejecutado) pestanasActualizadas++;
            }
        }
    } catch {
        // Ignorar si no hay pestañas abiertas.
    }

    return {
        ok: true,
        cache: {
            sha: cache.sha,
            shaCorto: cache.shaCorto,
            mensajeCommit: cache.mensajeCommit,
            fechaCommit: cache.fechaCommit,
            actualizadoEn: cache.actualizadoEn,
            totalModulos: ORDEN_MODULOS.length
        },
        userScriptsActivo,
        pestanasActualizadas
    };
}

asegurarUserScriptDesdeCache().catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
    asegurarUserScriptDesdeCache().catch(() => {});
});

function manejarMensajeRed(mensaje, enviarRespuesta) {
    if (mensaje.action === 'MAXIMUS_ABORT') {
        const ctrl = controladoresActivos.get(mensaje.requestId);
        if (ctrl) {
            controladoresActivos.delete(mensaje.requestId);
            try {
                ctrl.abort();
            } catch {
                // Ya estaba cerrada.
            }
        }
        enviarRespuesta({ ok: true });
        return false;
    }

    if (mensaje.action === 'MAXIMUS_FETCH') {
        const { requestId, url, timeout = 30000, maxBytes = 500 * 1048576 } = mensaje;
        const ctrl = new AbortController();
        if (requestId) controladoresActivos.set(requestId, ctrl);

        const reloj = setTimeout(() => ctrl.abort(), timeout);

        fetch(url, {
            method: 'GET',
            credentials: 'include',
            redirect: 'follow',
            signal: ctrl.signal,
            headers: { Accept: '*/*' }
        })
            .then(async r => {
                if (!r.ok) {
                    throw new Error(`HTTP ${r.status}`);
                }

                const largoCabecera = Number(r.headers.get('content-length') || 0);
                if (largoCabecera > maxBytes) {
                    throw new Error('Archivo demasiado grande');
                }

                const buffer = await r.arrayBuffer();
                if (!buffer || !buffer.byteLength) {
                    throw new Error('Archivo vacío');
                }
                if (buffer.byteLength > maxBytes) {
                    throw new Error('Archivo demasiado grande');
                }

                const headers = {};
                r.headers.forEach((valor, clave) => {
                    headers[clave.toLowerCase()] = valor;
                });

                try {
                    enviarRespuesta({
                        ok: true,
                        base64: bufferABase64(buffer),
                        headers,
                        url: r.url || url
                    });
                } catch {
                    try {
                        enviarRespuesta({
                            ok: false,
                            error: 'Archivo excede el límite de mensajería de Chrome'
                        });
                    } catch {
                        // Canal cerrado si la pestaña se cerró antes de responder.
                    }
                }
            })
            .catch(err => {
                try {
                    enviarRespuesta({
                        ok: false,
                        error: err?.name === 'AbortError' ? 'Tiempo agotado o cancelado' : (err?.message || 'Error de red')
                    });
                } catch {
                    // Canal cerrado si la pestaña se cerró antes de responder.
                }
            })
            .finally(() => {
                clearTimeout(reloj);
                if (requestId) controladoresActivos.delete(requestId);
            });

        return true;
    }

    return null;
}

chrome.runtime.onMessage.addListener((mensaje, sender, enviarRespuesta) => {
    if (!mensaje || typeof mensaje !== 'object') return false;

    const red = manejarMensajeRed(mensaje, enviarRespuesta);
    if (red !== null) {
        return red;
    }

    if (mensaje.action === 'MAXIMUS_GET_STATUS') {
        chrome.storage.local
            .get(CACHE_KEY)
            .then(datos => {
                const c = datos[CACHE_KEY];
                enviarRespuesta({
                    ok: true,
                    cache: c
                        ? {
                              sha: c.sha,
                              shaCorto: c.shaCorto,
                              mensajeCommit: c.mensajeCommit,
                              fechaCommit: c.fechaCommit,
                              actualizadoEn: c.actualizadoEn,
                              totalModulos: Object.keys(c.modulos || {}).length
                          }
                        : null,
                    userScriptsActivo: tieneSoporteUserScripts(),
                    extensionId: chrome.runtime.id
                });
            })
            .catch(err => {
                enviarRespuesta({ ok: false, error: err?.message || 'Error al leer estado' });
            });
        return true;
    }

    if (mensaje.action === 'MAXIMUS_UPDATE_SCRIPTS') {
        actualizarScriptsDesdeGithub()
            .then(res => enviarRespuesta(res))
            .catch(err => enviarRespuesta({ ok: false, error: err?.message || 'Error al actualizar desde GitHub' }));
        return true;
    }

    if (mensaje.action === 'MAXIMUS_INIT_TAB') {
        asegurarUserScriptDesdeCache()
            .then(async info => {
                if (info.activo && info.registradoAhora && sender.tab?.id && info.cache?.codigoCompilado) {
                    await ejecutarCodigoEnPestana(sender.tab.id, info.cache.codigoCompilado);
                }
                enviarRespuesta({ inyectadoRemoto: info.activo });
            })
            .catch(() => {
                enviarRespuesta({ inyectadoRemoto: false });
            });
        return true;
    }

    return false;
});

if (chrome.runtime?.onUserScriptMessage?.addListener) {
    chrome.runtime.onUserScriptMessage.addListener((mensaje, sender, enviarRespuesta) => {
        if (!mensaje || typeof mensaje !== 'object') return false;
        const red = manejarMensajeRed(mensaje, enviarRespuesta);
        return red === true;
    });
}
