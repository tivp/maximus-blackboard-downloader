// Corre en el contexto principal (MAIN) de la pestaña para atajar popups de window.open y evitar que Blackboard se congele en segundo plano.

(() => {
    'use strict';

    const estaOcupado = () => document.documentElement?.dataset?.maximusOcupado === '1';

    // Si la pestaña queda oculta mientras corre una descarga, redirigimos requestAnimationFrame a setTimeout para que la interfaz de Blackboard no se congele.
    try {
        const nativoRAF = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = callback => {
            if (estaOcupado() && document.hidden) {
                return setTimeout(() => callback(performance.now()), 16);
            }
            return nativoRAF(callback);
        };
    } catch {
        // Ignorar si no se permite reasignar.
    }

    // Cuando un recurso intenta abrir otra pestaña con window.open durante una descarga, mandamos la URL al módulo interceptor y devolvemos null.
    try {
        const nativoWindowOpen = window.open.bind(window);
        window.open = function (url, ...args) {
            if (estaOcupado() && url) {
                window.dispatchEvent(
                    new CustomEvent('maximus-popup-interceptado', {
                        detail: { url: String(url) }
                    })
                );
                return null;
            }
            return nativoWindowOpen(url, ...args);
        };
    } catch {
        // Ignorar si el navegador protege window.open.
    }
})();
