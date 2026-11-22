// Puente DOM entre el mundo USER_SCRIPT/MAIN y background.js, más cargador con respaldo local.

(() => {
    'use strict';

    if (document.documentElement) {
        document.documentElement.dataset.maximusBridge = '1';
        document.documentElement.dataset.maximusBridgeV2 = '1';
    }

    if (!window.__maximusBridgeListo) {
        window.__maximusBridgeListo = true;

        const solicitudesEnCurso = new Set();

        const enviarFetchAlBackground = (detalle, responder) => {
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

                        responder(payload);
                    }
                );
            } catch (err) {
                responder({ ok: false, error: err?.message || 'Error al enviar petición' });
            }
        };

        const enviarAbortAlBackground = requestId => {
            if (!requestId) return;
            try {
                chrome.runtime.sendMessage({ action: 'MAXIMUS_ABORT', requestId });
            } catch {
                // Ignorar si la pestaña se está cerrando.
            }
        };

        const iniciarBridgeFetch = (detalle, responder) => {
            if (!detalle?.requestId || !detalle?.url) return;
            if (solicitudesEnCurso.has(detalle.requestId)) return;
            solicitudesEnCurso.add(detalle.requestId);

            window.postMessage(
                {
                    __maximus: 'bridge-ack',
                    requestId: detalle.requestId
                },
                location.origin || '*'
            );

            enviarFetchAlBackground(detalle, payload => {
                solicitudesEnCurso.delete(detalle.requestId);
                responder(payload);
            });
        };

        // Puente por window.postMessage (canal seguro entre mundos en Chrome MV3) y respaldo por CustomEvent.
        window.addEventListener('message', e => {
            if (e.source !== window || !e.data || typeof e.data !== 'object') return;

            if (e.data.__maximus === 'bridge-fetch') {
                const detalle = e.data;
                iniciarBridgeFetch(detalle, payload => {
                    window.postMessage(
                        {
                            __maximus: 'bridge-res',
                            requestId: detalle.requestId,
                            payload
                        },
                        location.origin || '*'
                    );
                });
                return;
            }

            if (e.data.__maximus === 'bridge-abort') {
                solicitudesEnCurso.delete(e.data.requestId);
                enviarAbortAlBackground(e.data.requestId);
            }
        });

        // Reenvía peticiones binarias CORS desde el script actualizado al Service Worker.
        window.addEventListener('maximus-bridge-fetch', e => {
            let detalle = e.detail;
            if (typeof detalle === 'string') {
                try {
                    detalle = JSON.parse(detalle);
                } catch {
                    return;
                }
            }
            if (!detalle?.requestId || !detalle?.url) return;

            const eventoRespuesta = `maximus-bridge-res-${detalle.requestId}`;
            iniciarBridgeFetch(detalle, payload => {
                window.dispatchEvent(new CustomEvent(eventoRespuesta, { detail: payload }));
            });
        });

        window.addEventListener('maximus-bridge-abort', e => {
            let detalle = e.detail;
            if (typeof detalle === 'string') {
                try {
                    detalle = JSON.parse(detalle);
                } catch {
                    return;
                }
            }
            if (detalle?.requestId) {
                solicitudesEnCurso.delete(detalle.requestId);
                enviarAbortAlBackground(detalle.requestId);
            }
        });
    }

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
            await new Promise(r => setTimeout(r, 600));
            if (document.documentElement?.dataset?.maximusIniciado !== '1') {
                await cargarModulosLocales();
            }
            return;
        }

        await cargarModulosLocales();
    })();
})();
