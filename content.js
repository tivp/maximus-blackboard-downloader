// Puente DOM entre el mundo USER_SCRIPT/MAIN y background.js, más cargador con respaldo local.

(() => {
    'use strict';

    if (document.documentElement) {
        document.documentElement.dataset.maximusBridge = '1';
    }

    // Reenvía peticiones binarias CORS desde el script actualizado al Service Worker.
    window.addEventListener('maximus-bridge-fetch', e => {
        const detalle = e.detail;
        if (!detalle?.requestId || !detalle?.url) return;

        const eventoRespuesta = `maximus-bridge-res-${detalle.requestId}`;

        try {
            chrome.runtime.sendMessage(
                {
                    action: 'MAXIMUS_FETCH',
                    requestId: detalle.requestId,
                    url: detalle.url,
                    timeout: detalle.timeout,
                    maxBytes: detalle.maxBytes
                },
                respuesta => {
                    const payload = chrome.runtime.lastError
                        ? { ok: false, error: chrome.runtime.lastError.message }
                        : (respuesta || { ok: false, error: 'Sin respuesta del background' });

                    window.dispatchEvent(new CustomEvent(eventoRespuesta, { detail: payload }));
                }
            );
        } catch (err) {
            window.dispatchEvent(
                new CustomEvent(eventoRespuesta, {
                    detail: { ok: false, error: err?.message || 'Error al enviar petición' }
                })
            );
        }
    });

    window.addEventListener('maximus-bridge-abort', e => {
        const requestId = e.detail?.requestId;
        if (!requestId) return;
        try {
            chrome.runtime.sendMessage({ action: 'MAXIMUS_ABORT', requestId });
        } catch {
            // Ignorar si la pestaña se está cerrando.
        }
    });

    const cargarModulosLocales = async () => {
        if (document.documentElement?.dataset?.maximusIniciado === '1') {
            return;
        }
        try {
            const urlModulo = chrome.runtime.getURL('modules/main.js');
            await import(urlModulo);
        } catch (err) {
            console.error('[Maximus Orden] Falló la carga de módulos:', err);
        }
    };

    const consultarInicio = () =>
        new Promise(resolve => {
            try {
                chrome.runtime.sendMessage({ action: 'MAXIMUS_INIT_TAB' }, respuesta => {
                    if (chrome.runtime.lastError) {
                        resolve({ inyectadoRemoto: false });
                        return;
                    }
                    resolve(respuesta || { inyectadoRemoto: false });
                });
            } catch {
                resolve({ inyectadoRemoto: false });
            }
        });

    (async () => {
        const info = await consultarInicio();

        if (info.inyectadoRemoto) {
            // Damos un margen breve para que termine de ejecutarse el script registrado en USER_SCRIPT.
            await new Promise(r => setTimeout(r, 300));
            if (document.documentElement?.dataset?.maximusIniciado !== '1') {
                await cargarModulosLocales();
            }
            return;
        }

        await cargarModulosLocales();
    })();
})();
