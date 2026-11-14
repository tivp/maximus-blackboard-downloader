// ==UserScript==
// @name         Maximus Orden | Blackboard
// @namespace    https://tampermonkey.net/
// @version      3.2.0
// @description  Descarga unidades o el curso completo en ZIP (Cierre automático con la X en contenidos Unity/SCORM, soporte HTML + .url, Protocolo Ninja API + Iframe, botón Detener y árbol ASCII).
// @author       tivp
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjIyMCAxOTAgNTUyIDU0MiI+PHBvbHlnb24gcG9pbnRzPSIzNzAuNyw1MDYuOSAzNzAuMyw1MDYuNyAzMzEuNSw0NzguNyAzMzEuMyw0NTMuNyAyNzguMyw0MTUuMSAyOTMsNjA3LjIgMzcwLjcsNjczIi8+PHBvbHlnb24gcG9pbnRzPSI1NDYsNDc5IDU0Niw2MDcuNiA0NDYuMSw2MDcuNiA0NDYuMSw0NzguNCAzOTAuNyw1MDcuMSAzOTAuNyw2ODkuOSA0MTUuNiw3MTEgNDQ1LjksNjM4LjkgNTQ1LjMsNjM4LjkgNTc1LjgsNzExIDYwMC44LDY4NyA2MDAuOCw1MDcuNCIvPjxwb2x5Z29uIHBvaW50cz0iNDMxLjUsNzIxLjcgNTU5LjUsNzIxLjcgNTMzLjksNjU3IDQ1Ny41LDY1NyIvPjxwb2x5Z29uIHBvaW50cz0iNjIwLjYsNjczLjcgNjIwLjYsNTA2LjIgNjU5LjksNDc4LjQgNjU5LjksNDU0LjQgNzEyLjUsNDE2LjEgNjk4LjEsNjA3LjIiLz48cG9seWdvbiBwb2ludHM9IjQ2Mi42LDU4OC45IDQ2Mi42LDQ2MC42IDQ0Ny43LDM2NS45IDQ5NS44LDQwMC4zIDU0Mi42LDM2NS45IDUyOS4xLDQ2MS40IDUyOS4xLDU4OC45Ii8+PHBhdGggZD0iTTQyNy45LDM1NC4xbC0xMDEtNjYuM2wtMTEuNS01Mi43bC04My43LTYuM2wzNC42LDE1Nmw4MC40LDU4LjdsOTguMiwxNS41TDQyNy45LDM1NC4xeiBNMjc2LjMsMjgzLjdsMTE3LjgsNzguNWwyLjUsMTYuNmwtMTE2LjItNzcuM0wyNzYuMywyODMuN3ogTTI4OS4xLDM0N2wtNC4xLTE3LjhsMTE3LjgsNzguNWwyLjUsMTYuNkwyODkuMSwzNDd6Ii8+PHBhdGggZD0iTTU0Ni42LDQ1OS4xbDk4LjItMTUuNWw4MC40LTU4LjdsMzQuNi0xNTZsLTgzLjcsNi4zbC0xMS41LDUyLjdsLTEwMSw2Ni4zTDU0Ni42LDQ1OS4xeiBNNzExLDMwMS41bC0xMTYuMiw3Ny4zbDIuNS0xNi42bDExNy44LTc4LjVMNzExLDMwMS41eiBNNTg2LjEsNDI0LjJsMi41LTE2LjZsMTE3LjgtNzguNWwtNC4xLDE3LjhMNTg2LjEsNDI0LjJ6Ii8+PHBhdGggZD0iTTQ5NS4yLDIwMS4zYy05NiwwLTE1OS4xLDMzLjQtMTU5LjEsMzMuNGw4LjYsNDMuM2wxNTAuNSw5OS40bDE1MS4zLTk5LjFsOC42LTQyLjhDNjU1LjEsMjM1LjQsNTkxLjIsMjAxLjMsNDk1LjIsMjAxLjN6IE00OTYsMzE3LjFsLTg2LjktNTcuOWgxNzIuN0w0OTYsMzE3LjF6Ii8+PC9zdmc+
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_download
// @connect      *
// ==/UserScript==

(() => {
    'use strict';

    // --- Módulo 1: Configuración, constantes, logo Base64 y estado compartido ---

    // Ajustes base, selectores y estado compartido entre los módulos.

    const CFG = Object.freeze({
        ANCHO_PANEL: '75%',
        TIMEOUT: 30000,
        ESPERA_VISOR: 14000,
        ESPERA_CARGA: 12000,
        MAX_MB: 500,
        MAX_HTML: 2,
        MAX_ENLACES: 20,
        PAUSA: 90
    });

    // Logo de Transformer (Autobot) vectorizado en Base64 a partir de Transfomer Logo.svg.
    const LOGO_BASE64 =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjIyMCAxOTAgNTUyIDU0MiI+PHBvbHlnb24gcG9pbnRzPSIzNzAuNyw1MDYuOSAzNzAuMyw1MDYuNyAzMzEuNSw0NzguNyAzMzEuMyw0NTMuNyAyNzguMyw0MTUuMSAyOTMsNjA3LjIgMzcwLjcsNjczIi8+PHBvbHlnb24gcG9pbnRzPSI1NDYsNDc5IDU0Niw2MDcuNiA0NDYuMSw2MDcuNiA0NDYuMSw0NzguNCAzOTAuNyw1MDcuMSAzOTAuNyw2ODkuOSA0MTUuNiw3MTEgNDQ1LjksNjM4LjkgNTQ1LjMsNjM4LjkgNTc1LjgsNzExIDYwMC44LDY4NyA2MDAuOCw1MDcuNCIvPjxwb2x5Z29uIHBvaW50cz0iNDMxLjUsNzIxLjcgNTU5LjUsNzIxLjcgNTMzLjksNjU3IDQ1Ny41LDY1NyIvPjxwb2x5Z29uIHBvaW50cz0iNjIwLjYsNjczLjcgNjIwLjYsNTA2LjIgNjU5LjksNDc4LjQgNjU5LjksNDU0LjQgNzEyLjUsNDE2LjEgNjk4LjEsNjA3LjIiLz48cG9seWdvbiBwb2ludHM9IjQ2Mi42LDU4OC45IDQ2Mi42LDQ2MC42IDQ0Ny43LDM2NS45IDQ5NS44LDQwMC4zIDU0Mi42LDM2NS45IDUyOS4xLDQ2MS40IDUyOS4xLDU4OC45Ii8+PHBhdGggZD0iTTQyNy45LDM1NC4xbC0xMDEtNjYuM2wtMTEuNS01Mi43bC04My43LTYuM2wzNC42LDE1Nmw4MC40LDU4LjdsOTguMiwxNS41TDQyNy45LDM1NC4xeiBNMjc2LjMsMjgzLjdsMTE3LjgsNzguNWwyLjUsMTYuNmwtMTE2LjItNzcuM0wyNzYuMywyODMuN3ogTTI4OS4xLDM0N2wtNC4xLTE3LjhsMTE3LjgsNzguNWwyLjUsMTYuNkwyODkuMSwzNDd6Ii8+PHBhdGggZD0iTTU0Ni42LDQ1OS4xbDk4LjItMTUuNWw4MC40LTU4LjdsMzQuNi0xNTZsLTgzLjcsNi4zbC0xMS41LDUyLjdsLTEwMSw2Ni4zTDU0Ni42LDQ1OS4xeiBNNzExLDMwMS41bC0xMTYuMiw3Ny4zbDIuNS0xNi42bDExNy44LTc4LjVMNzExLDMwMS41eiBNNTg2LjEsNDI0LjJsMi41LTE2LjZsMTE3LjgtNzguNWwtNC4xLDE3LjhMNTg2LjEsNDI0LjJ6Ii8+PHBhdGggZD0iTTQ5NS4yLDIwMS4zYy05NiwwLTE1OS4xLDMzLjQtMTU5LjEsMzMuNGw4LjYsNDMuM2wxNTAuNSw5OS40bDE1MS4zLTk5LjFsOC42LTQyLjhDNjU1LjEsMjM1LjQsNTkxLjIsMjAxLjMsNDk1LjIsMjAxLjN6IE00OTYsMzE3LjFsLTg2LjktNTcuOWgxNzIuN0w0OTYsMzE3LjF6Ii8+PC9zdmc+';

    // Filtros para distinguir unidades, carpetas, archivos y material que no se descarga (foros, encuestas, SCORM).
    const RE = {
        unidad: /^(?:(?:unidad|semana|m[oó]dulo)\s*(?:\d+|[ivxlcdm]+)(?:\s*(?:[|:\-–—]|\s+)\s*\S.*)?|informaci[oó]n\s+general|evaluaci[oó]n\s+final|examen\s+final)$/i,
        moduloFinal: /^(?:evaluaci[oó]n\s+final|examen(?:\s+final)?)$/i,
        itemExamen: /\b(?:examen(?:\s+final)?|[usm]\d+\s*[|:]\s*examen)\b/i,
        archivo: /\.(?:pdf|docx?|xlsx?|pptx?|odt|ods|odp|txt|rtf|csv|tsv|json|xml|html?|url|zip|rar|7z|gz|tar|mp3|m4a|wav|ogg|flac|aac|mp4|mov|webm|avi|mkv|png|jpe?g|gif|webp|svg|epub|sql|py|ipynb)(?:$|[?#])/i,
        descarga: /bbcswebdav|xythos|\/attachments?\/|\/download(?:[/?#]|$)|filedownload|xid-\d+|[?&](?:download|filename|attachment|isForcedDownload|file)=/i,
        interactivo: /\b(?:material(?:es)?|contenido|recurso(?:s)?)\s+interactiv[oa]s?\b|\b(?:scorm|h5p|unity|webgl)\b/i,
        excluir: /^(?:(?:[usm]\d+\s*[|:]\s*)?(?:foro(?:\s+de\s+discusi[oó]n)?|evaluaci[oó]n(?:\s+diagn[oó]stica)?|examen|sondeo.*|encuesta.*)|foro de discusi[oó]n|consultas sobre la asignatura|asistente virtual|sondeo de conocimientos.*)$/i,
        carpeta: /^(?:(?:[usm]\d+\s*[|:]\s*)?(?:material de estudio|material en otros formatos|actividades|evaluaci[oó]n(?: de la (?:unidad|semana))?.*|recursos(?:\s+de\s+aprendizaje.*)?|material complementario))$/i
    };

    const TARJETAS = '.content-list-item[data-content-id],.element-card.outline-item';

    // Estado global de ejecución. Se guarda en un único objeto para que los módulos lean y escriban sin referencias sueltas.
    const estado = {
        unidades: new Map(),
        estadoFilas: new Map(),
        panelCurso: null,
        ocupado: false,
        cancelado: false,
        tareaActiva: null,
        pendiente: false,
        ultimaUrlIframeInterceptada: '',
        ultimoInteractivoDetectado: false,
        abortadoresActivos: new Set()
    };

    // Sincroniza el atributo en <html> para que page-hook.js sepa cuándo hay una descarga en curso.
    function marcarOcupado(valor) {
        estado.ocupado = Boolean(valor);
        if (document.documentElement) {
            if (estado.ocupado) {
                document.documentElement.dataset.maximusOcupado = '1';
            } else {
                delete document.documentElement.dataset.maximusOcupado;
            }
        }
    }

    function cancelarDescargaActiva() {
        if (!estado.ocupado) return;
        estado.cancelado = true;

        for (const abortar of estado.abortadoresActivos) {
            try {
                abortar();
            } catch {
                // Si la petición ya había terminado no pasa nada.
            }
        }
        estado.abortadoresActivos.clear();

        if (estado.tareaActiva?.estado) {
            estado.tareaActiva.estado.textContent = 'Deteniendo descarga y restaurando vista...';
        }
    }

    function verificarCancelacion() {
        if (estado.cancelado) {
            const err = new Error('Descarga detenida por el usuario');
            err.esCancelacion = true;
            throw err;
        }
    }

    // --- Módulo 2: Utilidades de texto, reloj en Web Worker y validación de URLs ---

    // Utilidades de texto, validación de URLs, tiempos en segundo plano y lectura del DOM base.


    // Chrome y Edge atrasan setTimeout a 1 segundo o más cuando la pestaña está oculta.
    // Un Web Worker en un Blob aparte mantiene el reloj a tiempo real aunque el usuario cambie de ventana.
    const dormir = (() => {
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

    const texto = value =>
        String(value ?? '')
            .replace(/[\u200b-\u200d\ufeff\u00a0]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const canon = value => texto(value).toLocaleLowerCase('es');

    // Quita caracteres prohibidos en nombres de archivo de Windows y recorta a 140 letras para no romper rutas largas en el ZIP.
    const seguro = (value, defecto = 'Sin nombre') => {
        const nombre = texto(value)
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[. ]+$/g, '')
            .slice(0, 140);

        return nombre || defecto;
    };

    // Blackboard suele pegarle prefijos internos como "xid-12345_1" o "_123_1" al nombre real de los archivos.
    const limpiarPrefijoXid = nombre => {
        const limpio = String(nombre || '').replace(/^(?:_?\d+_\d+|xid-\d+_\d+)(?=[A-Za-z])/i, '');
        return limpio || nombre;
    };

    const clonarBytes = src => {
        if (!src) return new Uint8Array(0);
        const vista = src instanceof Uint8Array ? src : new Uint8Array(src);
        const limpio = new Uint8Array(vista.byteLength);
        limpio.set(vista);
        return limpio;
    };

    const visible = el =>
        !!el?.isConnected &&
        !!el.getClientRects().length &&
        getComputedStyle(el).visibility !== 'hidden';

    const posicion = (a, b) =>
        a === b
            ? 0
            : (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

    function esUrlExterna(rawUrl) {
        try {
            const u = new URL(rawUrl, location.href);
            return /^https?:$/.test(u.protocol) && u.origin !== location.origin;
        } catch {
            return false;
        }
    }

    function esUrlScormOInteractivo(rawUrl) {
        return /scor-scormengine|\/scorm\/|launchPackage|unity|webgl|h5p/i.test(String(rawUrl || ''));
    }

    function esRutaSpaBlackboard(rawUrl) {
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
    const urlReal = (value, base = location.href) => {
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

    async function esperarHasta(prueba, ms, paso = 120) {
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

    function compatible() {
        return (
            /blackboard|iplacex|aulavirtual/i.test(location.hostname) ||
            (!!(
                document.querySelector(TARJETAS) ||
                document.querySelector('document-panel, section.page-scorm-launch-frame, bb-scorm-launch-frame')
            ) &&
                /\/ultra\/|\/courses?\/|\/webapps\//i.test(location.pathname))
        );
    }

    function obtenerIdCursoActual() {
        const m = location.pathname.match(/\/courses\/(_\d+_\d+)/i);
        return m ? m[1] : '';
    }

    function obtenerNombreCurso() {
        const h1 = document.querySelector('course-banner h1, [class*="courseTitle"]');
        if (h1 && texto(h1.textContent)) {
            return seguro(h1.textContent, 'Curso Completo');
        }
        const t = texto(document.title).replace(/^Contenido\s*\/\s*/i, '');
        return seguro(t, 'Curso Completo');
    }

    // Extrae el título visible de un botón o tarjeta quitando antes iconos, textos para lectores de pantalla y paneles propios.
    function tituloEl(el) {
        if (!el) return '';

        const copia = el.cloneNode(true);
        copia
            .querySelectorAll('svg,img,i,[aria-hidden="true"],[data-maximus],.sr-only,.visually-hidden,ul,ol')
            .forEach(n => n.remove());

        return texto(copia.textContent || el.getAttribute('aria-label') || el.getAttribute('title'));
    }

    // --- Módulo 3: Empaquetador ZIP en binario puro y árbol ASCII para reportes ---

    // Armado de archivos .zip en binario puro (STORE sin compresión para no trabar la CPU con videos) y árbol de texto para _REPORTE.txt.


    function generarMapaArbol(raizNombre, listaArchivos) {
        const raiz = { hijos: new Map(), archivos: [] };

        for (const item of listaArchivos) {
            const partes = String(item.ruta)
                .replace(/\\/g, '/')
                .split('/')
                .filter(Boolean);

            if (partes[0] && canon(partes[0]) === canon(raizNombre)) {
                partes.shift();
            }

            let actual = raiz;
            for (let i = 0; i < partes.length - 1; i++) {
                const dir = partes[i];
                if (!actual.hijos.has(dir)) {
                    actual.hijos.set(dir, { nombre: dir, hijos: new Map(), archivos: [] });
                }
                actual = actual.hijos.get(dir);
            }

            const archivo = partes.at(-1) || 'Archivo';
            actual.archivos.push({
                nombre: archivo,
                comentario: item.comentario || ''
            });
        }

        const lineas = [`${raizNombre}/`];

        const recorrer = (nodo, prefijo) => {
            const carpetas = [...nodo.hijos.values()];
            const archivos = nodo.archivos;
            const entradas = [
                ...carpetas.map(c => ({ tipo: 'dir', datos: c })),
                ...archivos.map(a => ({ tipo: 'file', datos: a }))
            ];

            entradas.forEach((entrada, idx) => {
                const esUltimo = idx === entradas.length - 1;
                const conector = esUltimo ? '└── ' : '├── ';
                const subPrefijo = prefijo + (esUltimo ? '    ' : '│   ');

                if (entrada.tipo === 'dir') {
                    lineas.push(`${prefijo}${conector}${entrada.datos.nombre}/`);
                    recorrer(entrada.datos, subPrefijo);
                } else {
                    const izq = `${prefijo}${conector}${entrada.datos.nombre}`;
                    if (entrada.datos.comentario) {
                        const relleno = ' '.repeat(Math.max(2, 54 - izq.length));
                        lineas.push(`${izq}${relleno}# ${entrada.datos.comentario}`);
                    } else {
                        lineas.push(izq);
                    }
                }
            });
        };

        recorrer(raiz, '');
        return lineas.join('\r\n');
    }

    function describirArchivo(nombreArchivo, bytesLength, etiquetaItem = '') {
        const kb = bytesLength / 1024;
        const tamano = kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb.toFixed(1)} KB`;
        const ext = (nombreArchivo.match(/\.[^.]+$/)?.[0] || '').toLowerCase();

        let tipo = 'Recurso descargado';
        if (ext === '.pdf') tipo = 'Documento PDF';
        else if (['.html', '.htm'].includes(ext)) tipo = 'Página / Presentación web HTML';
        else if (ext === '.url') tipo = 'Acceso directo a Internet (URL)';
        else if (['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) tipo = 'Video de presentación / multimedia';
        else if (['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac'].includes(ext)) tipo = 'Recurso de audio';
        else if (['.doc', '.docx', '.odt', '.rtf'].includes(ext)) tipo = 'Documento de texto';
        else if (['.xls', '.xlsx', '.ods', '.csv'].includes(ext)) tipo = 'Hoja de cálculo / datos';
        else if (['.ppt', '.pptx', '.odp'].includes(ext)) tipo = 'Presentación de diapositivas';
        else if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) tipo = 'Archivo comprimido';
        else if (ext === '.txt') tipo = 'Nota / Texto extraído';

        return etiquetaItem && canon(etiquetaItem) !== canon(nombreArchivo.replace(/\.[^.]+$/, ''))
            ? `${tipo} (${etiquetaItem}) · ${tamano}`
            : `${tipo} · ${tamano}`;
    }

    // Tabla precalculada para el CRC32 estándar que pide la cabecera de cada entrada del ZIP.
    const CRC_TABLA = (() => {
        const tabla = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            tabla[i] = c >>> 0;
        }
        return tabla;
    })();

    function calcularCrc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.byteLength; i++) {
            crc = CRC_TABLA[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function crearZipNativo() {
        const archivos = new Map();

        return {
            tiene(ruta) {
                return archivos.has(ruta.toLowerCase());
            },
            agregar(ruta, contenido) {
                const limpia = String(ruta)
                    .replace(/\\/g, '/')
                    .replace(/\/+/g, '/')
                    .replace(/^\/|\/$/g, '');

                const bytes =
                    typeof contenido === 'string'
                        ? new TextEncoder().encode(contenido)
                        : clonarBytes(contenido);

                archivos.set(limpia.toLowerCase(), {
                    ruta: limpia,
                    bytes
                });
            },
            generarBlob() {
                const encoder = new TextEncoder();
                const ahora = new Date();
                const anio = Math.max(1980, ahora.getFullYear());
                const fechaDos = ((anio - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
                const horaDos = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);

                const partesLocales = [];
                const partesCentrales = [];
                let offsetLocal = 0;
                let tamanoCentral = 0;
                let total = 0;

                for (const item of archivos.values()) {
                    const nombreBytes = encoder.encode(item.ruta);
                    const datos = item.bytes;
                    const tamano = datos.byteLength >>> 0;
                    const crc = calcularCrc32(datos);

                    // Cabecera local del archivo (30 bytes). El bit 0x0800 activa UTF-8 para tildes y eñes.
                    const localBuf = new ArrayBuffer(30);
                    const localView = new DataView(localBuf);
                    localView.setUint32(0, 0x04034b50, true);
                    localView.setUint16(4, 20, true);
                    localView.setUint16(6, 0x0800, true);
                    localView.setUint16(8, 0, true);
                    localView.setUint16(10, horaDos, true);
                    localView.setUint16(12, fechaDos, true);
                    localView.setUint32(14, crc, true);
                    localView.setUint32(18, tamano, true);
                    localView.setUint32(22, tamano, true);
                    localView.setUint16(26, nombreBytes.byteLength, true);
                    localView.setUint16(28, 0, true);

                    partesLocales.push(new Uint8Array(localBuf), nombreBytes, datos);

                    // Entrada para el directorio central al final del ZIP (46 bytes).
                    const centralBuf = new ArrayBuffer(46);
                    const centralView = new DataView(centralBuf);
                    centralView.setUint32(0, 0x02014b50, true);
                    centralView.setUint16(4, 20, true);
                    centralView.setUint16(6, 20, true);
                    centralView.setUint16(8, 0x0800, true);
                    centralView.setUint16(10, 0, true);
                    centralView.setUint16(12, horaDos, true);
                    centralView.setUint16(14, fechaDos, true);
                    centralView.setUint32(16, crc, true);
                    centralView.setUint32(20, tamano, true);
                    centralView.setUint32(24, tamano, true);
                    centralView.setUint16(28, nombreBytes.byteLength, true);
                    centralView.setUint16(30, 0, true);
                    centralView.setUint16(32, 0, true);
                    centralView.setUint16(34, 0, true);
                    centralView.setUint16(36, 0, true);
                    centralView.setUint32(38, 0, true);
                    centralView.setUint32(42, offsetLocal, true);

                    partesCentrales.push(new Uint8Array(centralBuf), nombreBytes);

                    offsetLocal += 30 + nombreBytes.byteLength + tamano;
                    tamanoCentral += 46 + nombreBytes.byteLength;
                    total++;
                }

                // Cierre del directorio central (EOCD, 22 bytes).
                const eocdBuf = new ArrayBuffer(22);
                const eocdView = new DataView(eocdBuf);
                eocdView.setUint32(0, 0x06054b50, true);
                eocdView.setUint16(4, 0, true);
                eocdView.setUint16(6, 0, true);
                eocdView.setUint16(8, total, true);
                eocdView.setUint16(10, total, true);
                eocdView.setUint32(12, tamanoCentral, true);
                eocdView.setUint32(16, offsetLocal, true);
                eocdView.setUint16(20, 0, true);

                return new Blob(
                    [...partesLocales, ...partesCentrales, new Uint8Array(eocdBuf)],
                    { type: 'application/zip' }
                );
            }
        };
    }

    // Si dos archivos en la misma carpeta se llaman igual, les agrega (2), (3), etc. antes de la extensión.
    function rutaLibre(zip, baseRuta, nombreArchivo) {
        const construir = n => (baseRuta ? `${baseRuta}/${n}` : n);
        const candidato = construir(nombreArchivo);

        if (!zip.tiene(candidato)) return candidato;

        const i = nombreArchivo.lastIndexOf('.');
        const base = i > 0 ? nombreArchivo.slice(0, i) : nombreArchivo;
        const ext = i > 0 ? nombreArchivo.slice(i) : '';

        let k = 2;
        while (zip.tiene(construir(`${base} (${k})${ext}`))) {
            k++;
        }

        return construir(`${base} (${k})${ext}`);
    }

    function guardarZip(u) {
        if (!u.zipBlob) return;

        if (!u.zipUrl) {
            u.zipUrl = URL.createObjectURL(u.zipBlob);
        }

        const a = document.createElement('a');
        a.href = u.zipUrl;
        a.download = u.zipNombre;
        a.rel = 'noopener';
        a.style.display = 'none';
        a.addEventListener('click', e => e.stopPropagation());

        (document.body || document.documentElement).appendChild(a);
        a.click();

        setTimeout(() => a.remove(), 15000);
    }

    // --- Módulo 4: Interceptor de redirecciones, popups y freno a iframes Unity/SCORM ---

    // Freno a redirecciones fuera de /outline, bloqueo de descargas sueltas y corte de carga en iframes de Unity/SCORM.


    function esVisorInteractivoUnity() {
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

    function enVistaDocumentoPantallaCompleta() {
        return !!(
            esVisorInteractivoUnity() ||
            document.querySelector('document-panel, section.page-scorm-launch-frame, bb-scorm-launch-frame, learning-module-panel-view') ||
            /\/ultra\/courses\/[^/]+\/(?:document|scorm)\//i.test(location.pathname)
        );
    }

    function activarInterceptorIframes() {
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

    // --- Módulo 5: Cliente HTTP, firmas mágicas de archivos y accesos .url ---

    // Descarga de archivos, lectura de cabeceras binarias (magic bytes), armado de accesos .url y rastreo de visores HTML.


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
        const bin = atob(b64);
        const len = bin.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = bin.charCodeAt(i);
        }
        return bytes;
    }

    // Descarga mediante el Service Worker de la extensión (o GM_xmlhttpRequest en Tampermonkey) para saltar bloqueos CORS en servidores externos.
    function peticionExterna(url) {
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
                            bytes: clonarBytes(buffer),
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
            });
        }

        // Si el bundle corre en USER_SCRIPT o MAIN sin acceso directo a chrome.runtime, usa el puente DOM de content.js.
        if (document.documentElement?.dataset?.maximusBridge === '1') {
            return new Promise((resolve, reject) => {
                if (estado.cancelado) {
                    const err = new Error('Descarga detenida por el usuario');
                    err.esCancelacion = true;
                    return reject(err);
                }

                let finalizado = false;
                const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
                const eventoRespuesta = `maximus-bridge-res-${requestId}`;

                const limpiar = () => {
                    clearTimeout(timer);
                    estado.abortadoresActivos.delete(abortar);
                    window.removeEventListener(eventoRespuesta, alResponder);
                };

                const abortar = () => {
                    if (finalizado) return;
                    finalizado = true;
                    limpiar();
                    window.dispatchEvent(
                        new CustomEvent('maximus-bridge-abort', { detail: { requestId } })
                    );
                    const err = new Error('Descarga detenida por el usuario');
                    err.esCancelacion = true;
                    reject(err);
                };

                const alResponder = e => {
                    if (finalizado) return;
                    finalizado = true;
                    limpiar();

                    const respuesta = e.detail;
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

                estado.abortadoresActivos.add(abortar);

                const timer = setTimeout(() => {
                    if (finalizado) return;
                    finalizado = true;
                    limpiar();
                    window.dispatchEvent(
                        new CustomEvent('maximus-bridge-abort', { detail: { requestId } })
                    );
                    reject(new Error('Tiempo agotado'));
                }, CFG.TIMEOUT);

                window.addEventListener(eventoRespuesta, alResponder, { once: true });
                window.dispatchEvent(
                    new CustomEvent('maximus-bridge-fetch', {
                        detail: {
                            requestId,
                            url,
                            timeout: CFG.TIMEOUT,
                            maxBytes: CFG.MAX_MB * 1048576
                        }
                    })
                );
            });
        }

        return fetchLocal(url);
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

            const bytes = clonarBytes(await r.arrayBuffer());

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
    function analizar(res) {
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
            const urlExt = new URL(res.url).pathname
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

        const extUrl = new URL(res.url).pathname
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

    function archivoNombre(res, sugerido, tipo) {
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
                const u = new URL(res.url);
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

    async function pedirArchivo(url) {
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

                if (tipo.tipo === 'html' && !pagina) {
                    pagina = { res, tipo };
                }

                errores.push(`${nombre}: ${tipo.razon || tipo.tipo}`);
            } catch (e) {
                if (e.esCancelacion || estado.cancelado) throw e;
                errores.push(`${nombre}: ${e.message}`);
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

    async function recuperar(url, nombre, nivel = 0, visitados = new Set(), subCarpeta = '') {
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

        for (const item of links) {
            verificarCancelacion();
            try {
                const r = await recuperar(
                    item.url,
                    item.nombre === 'Archivo' ? nombre : item.nombre,
                    nivel + 1,
                    visitados,
                    subCarpeta
                );

                resultado.archivos.push(...r.archivos);
                resultado.errores.push(...r.errores);
            } catch (e) {
                if (e.esCancelacion || estado.cancelado) throw e;
                resultado.errores.push(e.message);
            }
        }

        return resultado;
    }

    // --- Módulo 6: Extractor por API REST interna y pública de Blackboard ---

    // Consulta directa a los endpoints REST de Blackboard (/learn/api/...) para sacar adjuntos sin abrir paneles en la interfaz.


    async function extraerDocumentoViaApiBlackboard(courseId, docId, nombreItem = 'Documento') {
        if (!courseId || !docId) return null;

        const fetchJson = async endpoint => {
            try {
                const r = await fetch(endpoint, {
                    credentials: 'include',
                    headers: { Accept: 'application/json' }
                });
                if (!r.ok) return null;
                return r.json();
            } catch {
                return null;
            }
        };

        try {
            const bloques = [];
            const urlsVistas = new Set();
            let contadorVideo = 1;
            let esScormInteractivo = false;

            const agregarUrlDetectada = (rawUrl, tituloSugerido = '', nombreArchivo = '') => {
                if (esUrlScormOInteractivo(rawUrl)) {
                    esScormInteractivo = true;
                    return;
                }
                const url = urlReal(rawUrl);
                if (!url || urlsVistas.has(url)) return;
                urlsVistas.add(url);

                const eid = limpiarPrefijoXid(
                    nombreArchivo ||
                    decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
                );

                const esVideo = /\.mp4(?:$|[?#])/i.test(url) || /\.mp4$/i.test(eid);
                let tituloBloque = texto(tituloSugerido);

                if (
                    !tituloBloque ||
                    /^xid-\d+/i.test(tituloBloque) ||
                    tituloBloque.toLowerCase() === eid.toLowerCase()
                ) {
                    if (esVideo) {
                        tituloBloque = contadorVideo === 1 ? 'Video de presentación' : `Video ${contadorVideo++}`;
                    } else {
                        tituloBloque = eid.replace(/\.[^.]+$/, '') || nombreItem;
                    }
                }

                bloques.push({
                    url,
                    nombre: eid || tituloBloque,
                    subCarpeta: tituloBloque
                });
            };

            const extraerDeItemApi = itemObj => {
                if (!itemObj) return;
                const handlerId = String(
                    itemObj.contentHandler?.id ||
                    Object.keys(itemObj.contentDetail || {})[0] ||
                    ''
                );

                if (/scorm/i.test(handlerId)) {
                    esScormInteractivo = true;
                    return;
                }

                const titulo = texto(itemObj.title || nombreItem);
                const extUrl =
                    itemObj.contentHandler?.url ||
                    itemObj.contentDetail?.['resource/x-bb-externallink']?.url ||
                    itemObj.links?.find(l => l.rel === 'alternate' && /^https?:/i.test(l.href || ''))?.href;

                if (extUrl) {
                    agregarUrlDetectada(extUrl, titulo);
                }

                const fileObj =
                    itemObj.contentHandler?.file ||
                    itemObj.contentDetail?.['resource/x-bb-file']?.file;

                if (fileObj) {
                    const fileUrl =
                        fileObj.permanentUrl ||
                        fileObj.viewUrl ||
                        (fileObj.xid ? `/bbcswebdav/xid-${String(fileObj.xid).replace(/^xid-/i, '')}` : '') ||
                        itemObj.links?.find(l => /download|file|bbcswebdav/i.test(l.href || ''))?.href;
                    agregarUrlDetectada(fileUrl, titulo, fileObj.fileName || '');
                }
            };

            // Los documentos Ultra guardan su contenido como HTML dentro de body.rawText; ahí van metidos los metadatos JSON en data-bbfile.
            const procesarHtmlCuerpo = (htmlStr, tituloPadre = '') => {
                if (!htmlStr) return '';
                const doc = new DOMParser().parseFromString(htmlStr, 'text/html');

                for (const el of doc.querySelectorAll(
                    'a[href], a[data-ally-file-preview-url], [data-bbfile], video[src], audio[src], source[src], iframe[src]'
                )) {
                    if (el.getAttribute('data-bbtype') === 'image') continue;

                    let metaFile = null;
                    try {
                        const rawMeta = el.getAttribute('data-bbfile');
                        if (rawMeta) metaFile = JSON.parse(rawMeta);
                    } catch {
                        // Ignorar JSON mal formado.
                    }

                    const raw =
                        el.getAttribute('data-ally-file-preview-url') ||
                        el.getAttribute('href') ||
                        el.getAttribute('src');

                    const etiqueta =
                        metaFile?.linkName ||
                        metaFile?.fileName ||
                        texto(el.textContent) ||
                        tituloPadre;

                    agregarUrlDetectada(raw, etiqueta, metaFile?.fileName || '');
                }

                return texto(doc.body?.innerText || doc.body?.textContent || '');
            };

            // Consultamos a la vez la API interna de Ultra y la pública v1 porque según el rol del alumno algunas propiedades solo vienen en una de las dos.
            const [nodoInterno, nodoPublico, datosInternos, datosPublicos, adjuntosPublicos] = await Promise.all([
                fetchJson(`/learn/api/v1/courses/${courseId}/contents/${docId}`),
                fetchJson(`/learn/api/public/v1/courses/${courseId}/contents/${docId}`),
                fetchJson(`/learn/api/v1/courses/${courseId}/contents/${docId}/children`),
                fetchJson(`/learn/api/public/v1/courses/${courseId}/contents/${docId}/children`),
                fetchJson(`/learn/api/public/v1/courses/${courseId}/contents/${docId}/attachments`)
            ]);

            extraerDeItemApi(nodoInterno);
            extraerDeItemApi(nodoPublico);

            if (esScormInteractivo) {
                return [{ omitidoInteractivo: true }];
            }

            if (adjuntosPublicos?.results?.length) {
                for (const att of adjuntosPublicos.results) {
                    const dlUrl = `/learn/api/public/v1/courses/${courseId}/contents/${docId}/attachments/${att.id}/download`;
                    agregarUrlDetectada(dlUrl, att.fileName, att.fileName);
                }
            }

            const listaHijos =
                datosInternos?.results ||
                datosPublicos?.results ||
                [];

            const textosAcumulados = [];

            for (const hijo of listaHijos) {
                const tituloHijo = texto(hijo.title || '');
                const handler = hijo.contentHandler?.id || '';

                extraerDeItemApi(hijo);

                if (hijo.id && /file|document|externallink/i.test(handler)) {
                    const subAtt = await fetchJson(
                        `/learn/api/public/v1/courses/${courseId}/contents/${hijo.id}/attachments`
                    );
                    if (subAtt?.results?.length) {
                        for (const att of subAtt.results) {
                            const dlUrl = `/learn/api/public/v1/courses/${courseId}/contents/${hijo.id}/attachments/${att.id}/download`;
                            agregarUrlDetectada(dlUrl, tituloHijo || att.fileName, att.fileName);
                        }
                    }
                }

                const cuerpoHtml =
                    hijo.body?.rawText ||
                    hijo.body ||
                    hijo.contentDetail?.['resource/x-bb-document']?.body?.rawText ||
                    '';

                if (typeof cuerpoHtml === 'string' && cuerpoHtml) {
                    const txt = procesarHtmlCuerpo(cuerpoHtml, tituloHijo);
                    if (txt && txt.length > 10) {
                        textosAcumulados.push(txt);
                    }
                }
            }

            if (bloques.length > 0) {
                return bloques;
            }

            if (textosAcumulados.length > 0) {
                return [{ textoPlano: textosAcumulados.join('\r\n\r\n') }];
            }
        } catch {
            // Si el servidor bloquea la API REST para este ítem, el llamador abre el visor DOM normal.
        }

        return null;
    }

    // --- Módulo 7: Escáner de unidades, apertura de carpetas y árbol del DOM ---

    // Lectura de la lista del curso (/outline), apertura de carpetas cerradas y armado del árbol de recursos por unidad.


    // Saca los bloques de archivo (videos, PDFs, enlaces de Ally) que vienen dentro de un document-panel de Blackboard Ultra.
    function extraerBloquesDeDocumentPanel(raizDoc = document) {
        const contenedor =
            raizDoc.matches?.('document-panel, .document-content-root, .bbml-editor')
                ? raizDoc
                : raizDoc.querySelector?.('document-panel, .document-content-root, .bbml-editor');

        if (!contenedor) return [];

        const bloques = [];
        const urlsVistas = new Set();
        let contadorVideo = 1;

        for (const region of contenedor.querySelectorAll('[role="region"][aria-label="Archivo"]')) {
            const allyEl = region.querySelector('a[data-ally-file-preview-url]');
            const videoEl = region.querySelector('video[src], audio[src], source[src]');
            const previewDiv = region.querySelector('[id^="file-preview-"]');
            const controlBtn = region.querySelector('[aria-controls^="file-preview-"]');
            const iframeEl = region.querySelector('iframe[src]');
            const spanTitulo = region.querySelector(
                '.js-file-viewer-attachment-meta span, [class*="fileText"]'
            );

            const rawUrl =
                allyEl?.getAttribute('data-ally-file-preview-url') ||
                videoEl?.getAttribute('src') ||
                previewDiv?.getAttribute('id')?.replace(/^file-preview-/i, '') ||
                controlBtn?.getAttribute('aria-controls')?.replace(/^file-preview-/i, '') ||
                iframeEl?.getAttribute('src');

            const url = urlReal(rawUrl);
            if (!url || urlsVistas.has(url)) continue;
            urlsVistas.add(url);

            const eid = limpiarPrefijoXid(
                allyEl?.getAttribute('data-ally-file-eid') ||
                decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
            );

            let tituloBloque = texto(spanTitulo?.textContent || '');

            if (!tituloBloque) {
                if (videoEl || /\.mp4(?:$|[?#])/i.test(url)) {
                    tituloBloque = contadorVideo === 1 ? 'Video de presentación' : `Video ${contadorVideo}`;
                    contadorVideo++;
                } else {
                    tituloBloque = eid.replace(/\.[^.]+$/, '') || 'Archivo adjunto';
                }
            }

            bloques.push({
                el: spanTitulo || videoEl || region,
                tarjeta: region,
                nombre: tituloBloque,
                nombreArchivoSugerido: eid || tituloBloque,
                carpetas: [seguro(tituloBloque)],
                ruta: [seguro(tituloBloque)],
                url,
                clic: false,
                omitido: false
            });
        }

        for (const el of contenedor.querySelectorAll(
            'a[data-ally-file-preview-url], video[src], audio[src], [id^="file-preview-"], [aria-controls^="file-preview-"], a[href*="bbcswebdav"], a[href$=".html"], a[href$=".htm"], a[target="_blank"][href^="http"]'
        )) {
            const rawUrl =
                el.getAttribute('data-ally-file-preview-url') ||
                el.getAttribute('src') ||
                el.getAttribute('id')?.replace(/^file-preview-/i, '') ||
                el.getAttribute('aria-controls')?.replace(/^file-preview-/i, '') ||
                el.getAttribute('href');

            const url = urlReal(rawUrl);
            if (!url || urlsVistas.has(url)) continue;
            urlsVistas.add(url);

            const eid = limpiarPrefijoXid(
                el.getAttribute('data-ally-file-eid') ||
                decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
            );

            const esVideo = el.tagName.toLowerCase() === 'video' || /\.mp4(?:$|[?#])/i.test(url);
            const regionPadre = el.closest('[role="region"]');
            const spanTexto = regionPadre?.querySelector('.js-file-viewer-attachment-meta span, [class*="fileText"]');

            const tituloBloque =
                texto(spanTexto?.textContent || el.textContent || '') ||
                (esVideo
                    ? contadorVideo === 1
                        ? 'Video de presentación'
                        : `Video ${contadorVideo++}`
                    : eid.replace(/\.[^.]+$/, '') || 'Documento adjunto');

            bloques.push({
                el,
                tarjeta: regionPadre || el,
                nombre: tituloBloque,
                nombreArchivoSugerido: eid || tituloBloque,
                carpetas: [seguro(tituloBloque)],
                ruta: [seguro(tituloBloque)],
                url,
                clic: false,
                omitido: false
            });
        }

        return bloques;
    }

    // El botón para bajar el curso entero solo se muestra cuando el examen final ya no tiene candado de condición.
    function examenFinalHabilitado() {
        const enlacesEval = document.querySelectorAll(
            'a[data-analytics-id*="gradebook.item.assessment"], a[href*="/assessment/"], a[aria-label^="Examen,"]'
        );
        for (const el of enlacesEval) {
            const nombre = tituloEl(el);
            const card = el.closest(TARJETAS);
            const bloqueado =
                el.matches('[class*="readOnly"],[class*="isRestricted"]') ||
                card?.querySelector('[data-analytics-id="components.common.conditional-release-info.buttonBase"]');

            if (!bloqueado && RE.itemExamen.test(nombre)) {
                return true;
            }
        }

        for (const u of estado.unidades.values()) {
            const card = u.raiz;
            const bloqueado =
                u.titulo.matches('[class*="readOnly"]') ||
                card?.querySelector('[data-analytics-id="components.common.conditional-release-info.buttonBase"]');

            if (!bloqueado && RE.moduloFinal.test(u.nombre)) {
                return true;
            }
        }

        return false;
    }

    function esModuloPrincipal(el, nombre) {
        if (!nombre || nombre.length > 180) {
            return false;
        }

        if (
            el.closest(
                'content-page-header, nav, .MuiBreadcrumbs-root, .MuiDrawer-root, document-panel, section.page-scorm-launch-frame, learning-module-panel-view, [data-analytics-id="content.navigation.drawer"]'
            )
        ) {
            return false;
        }

        const card = el.closest(TARJETAS);
        if (!card) {
            return false;
        }

        // Si la unidad tiene candado por fecha o nota previa, no se puede abrir todavía.
        if (
            el.matches('[class*="readOnly"]') ||
            card.querySelector('[data-analytics-id="components.common.conditional-release-info.buttonBase"]')
        ) {
            return false;
        }

        if (
            el.matches(
                'button[id^="learning-module-title-"], [data-analytics-id="course.learning.module.base.item.toggleLm.button"]'
            )
        ) {
            return true;
        }

        if (
            el.matches(
                'button[id^="folder-title-"], [data-analytics-id="content.item.folder.toggleFolder.button"]'
            )
        ) {
            return false;
        }

        if (!card.classList.contains('root') && card.parentElement?.closest(TARJETAS)) {
            return false;
        }

        if (RE.excluir.test(nombre)) {
            return false;
        }

        return RE.unidad.test(nombre);
    }

    function cabeceras() {
        if (enVistaDocumentoPantallaCompleta()) {
            return [];
        }

        const lista = [];
        const selector =
            'button[id^="learning-module-title-"],' +
            '[data-analytics-id="course.learning.module.base.item.toggleLm.button"],' +
            'h2,h3,h4,[role="heading"],' +
            '.content-title,.element-details .name,' +
            'a,button,span';

        for (const el of document.querySelectorAll(selector)) {
            if (
                !visible(el) ||
                el.closest('[data-maximus], document-panel, section.page-scorm-launch-frame, learning-module-panel-view, content-page-header, nav, .MuiBreadcrumbs-root')
            ) {
                continue;
            }

            const nombre = tituloEl(el);
            if (!esModuloPrincipal(el, nombre)) {
                continue;
            }

            const rect = el.getBoundingClientRect();
            if (rect.width < 10 || rect.height < 8) {
                continue;
            }

            const igual = lista.find(
                x =>
                    canon(x.nombre) === canon(nombre) &&
                    Math.abs(x.y - (rect.top + scrollY)) < 14
            );

            if (!igual) {
                lista.push({
                    el,
                    nombre,
                    y: rect.top + scrollY
                });
            } else if (igual.el.contains(el)) {
                Object.assign(igual, {
                    el,
                    nombre,
                    y: rect.top + scrollY
                });
            }
        }

        return lista.sort((a, b) => posicion(a.el, b.el));
    }

    function buscarRaiz(titulo, otros) {
        const tarjeta = titulo.closest(TARJETAS);
        if (tarjeta) return tarjeta;

        let mejor = null;

        for (let p = titulo.parentElement; p && p !== document.body; p = p.parentElement) {
            if (otros.some(x => x !== titulo && p.contains(x))) {
                break;
            }

            if (p.getBoundingClientRect().width < 280) {
                continue;
            }

            const contenido = p.querySelector(
                '[aria-expanded],.content-list-item,.outline-item,[class*="folder"],a[href]'
            );

            const imagen = [...p.querySelectorAll('img')].some(img => {
                const r = img.getBoundingClientRect();
                return (
                    r.width >= 35 &&
                    r.height >= 35 &&
                    r.left < titulo.getBoundingClientRect().left - 8
                );
            });

            if (contenido || imagen) {
                mejor = p;
            }

            if (
                p.matches(
                    'article,li,section,[class*="card"],[class*="content-item"],[class*="contentListItem"]'
                ) &&
                (contenido || imagen)
            ) {
                return p;
            }
        }

        return mejor || titulo.parentElement;
    }

    function anclaAncha(u) {
        const headerMod = u.raiz.querySelector('[class*="learningModuleItem"], [class*="itemContainer"]');
        if (headerMod && u.raiz.contains(headerMod) && headerMod.getBoundingClientRect().width >= 420) {
            return headerMod;
        }

        let mejor = u.raiz;

        const otros = [...estado.unidades.values()]
            .filter(x => x !== u)
            .map(x => x.titulo);

        for (let p = u.raiz; p && p !== document.body; p = p.parentElement) {
            if (otros.some(x => p.contains(x))) {
                break;
            }

            const r = p.getBoundingClientRect();
            if (r.width >= 420 && r.width >= u.titulo.getBoundingClientRect().width + 100) {
                mejor = p;
                break;
            }
        }

        return mejor;
    }

    function dentroDeUnidad(el, u) {
        if (!u.raiz.contains(el) || el.closest('[data-maximus]')) {
            return false;
        }

        for (const otra of estado.unidades.values()) {
            if (otra !== u && otra.raiz !== u.raiz && otra.raiz.contains(el)) {
                return false;
            }
        }

        return true;
    }

    async function abrirUnidad(u) {
        verificarCancelacion();

        if (u.contentId && !u.raiz?.isConnected) {
            const nuevaRaiz = document.querySelector(`.content-list-item[data-content-id="${u.contentId}"]`);
            if (nuevaRaiz) u.raiz = nuevaRaiz;
        }

        let control = u.titulo.matches('[aria-expanded]')
            ? u.titulo
            : u.titulo.closest('button[aria-expanded]');

        if (!control) {
            control = [
                ...u.raiz.querySelectorAll('button[aria-expanded],[role="button"][aria-expanded]')
            ].find(b => b.closest(TARJETAS) === u.raiz);
        }

        if (!control && u.titulo.matches('button')) {
            control = u.titulo;
        }

        // Blackboard Ultra tiene un typo en su propio código ("coures.outline.document.link"); buscamos las dos variantes por si lo arreglan.
        const hayContenidoDescargable = () =>
            [
                ...u.raiz.querySelectorAll(
                    'button[id^="folder-title-"],' +
                    '[data-analytics-id="content.item.course.outline.courseContent.link"],' +
                    '[data-analytics-id="content.item.coures.outline.document.link"],' +
                    '[data-analytics-id="content.item.courses.outline.document.link"],' +
                    'a[href*="/document/"]'
                )
            ].some(x => x !== u.titulo && dentroDeUnidad(x, u));

        if (
            control?.getAttribute('aria-expanded') === 'false' ||
            (!hayContenidoDescargable() && control)
        ) {
            if (control.getAttribute('aria-expanded') === 'false') {
                control.click();
                u.log.push('[UNIDAD] Abierta automáticamente');
            }

            await esperarHasta(() => hayContenidoDescargable(), CFG.ESPERA_CARGA);
        }

        await esperarHasta(hayContenidoDescargable, 4000);
        await dormir(350);
    }

    async function expandirCarpetas(u) {
        await abrirUnidad(u);

        const vistos = new WeakSet();

        for (let ronda = 0; ronda < 12; ronda++) {
            verificarCancelacion();

            const botones = [
                ...u.raiz.querySelectorAll(
                    'button[id^="folder-title-"][aria-expanded="false"],' +
                    'button[data-analytics-id="content.item.folder.toggleFolder.button"][aria-expanded="false"],' +
                    'button[aria-expanded="false"],[role="button"][aria-expanded="false"]'
                )
            ]
                .filter(b => b !== u.titulo && dentroDeUnidad(b, u) && !vistos.has(b))
                .filter(
                    b =>
                        !b.matches(
                            '.js-review-state-icon-button,[id^="content-item-overflow-menu-button-"]'
                        )
                )
                .filter(b => !RE.interactivo.test(tituloEl(b)));

            if (!botones.length) break;

            let abiertos = 0;

            for (const boton of botones) {
                verificarCancelacion();
                vistos.add(boton);

                if (!boton.isConnected || boton.getAttribute('aria-expanded') !== 'false') {
                    continue;
                }

                const cardCarpeta = boton.closest(TARJETAS);
                const hijosAntes = cardCarpeta ? cardCarpeta.querySelectorAll(TARJETAS).length : 0;

                try {
                    boton.click();
                    abiertos++;

                    await esperarHasta(
                        () =>
                            !boton.isConnected ||
                            (boton.getAttribute('aria-expanded') === 'true' &&
                                (!cardCarpeta ||
                                    (!cardCarpeta.querySelector('.ms-Spinner, [data-testid="skeleton-loader"]') &&
                                        cardCarpeta.querySelectorAll(TARJETAS).length > hijosAntes))),
                        2800
                    );
                } catch (e) {
                    u.log.push(`[CARPETA] ${e.message}`);
                }
            }

            if (!abiertos) break;
            await dormir(350);
        }
    }

    function nombreCard(card) {
        const directos = [
            ...card.querySelectorAll(
                'button[id^="folder-title-"],' +
                '[data-analytics-id="content.item.course.outline.courseContent.link"],' +
                '[data-analytics-id="content.item.coures.outline.document.link"],' +
                '[data-analytics-id="content.item.courses.outline.document.link"],' +
                '.ax-focusable-title,' +
                '.element-details .content-title,' +
                '.element-details .name,' +
                '.content-title,[role="heading"],' +
                'button[aria-expanded],a[href],button'
            )
        ].filter(el => el.closest(TARJETAS) === card);

        const primero = directos.find(
            el =>
                !el.matches(
                    'button[aria-label*="opciones" i],' +
                    'button[aria-label*="more" i],' +
                    'button.js-review-state-icon-button,' +
                    'button[id^="content-item-overflow-menu-button-"],' +
                    '[data-analytics-id*="loadMoreButton"]'
                )
        );

        return tituloEl(primero) || '';
    }

    function esCarpeta(card, nombre) {
        const botonCarpeta = [
            ...card.querySelectorAll(
                'button[id^="folder-title-"],' +
                '[data-analytics-id="content.item.folder.toggleFolder.button"]'
            )
        ].find(el => el.closest(TARJETAS) === card);

        if (botonCarpeta) return true;

        const esLinkContenido = [
            ...card.querySelectorAll(
                '[data-analytics-id="content.item.course.outline.courseContent.link"],' +
                '[data-analytics-id="content.item.coures.outline.document.link"],' +
                '[data-analytics-id="content.item.courses.outline.document.link"]'
            )
        ].some(el => el.closest(TARJETAS) === card);

        if (esLinkContenido) return false;

        const botonExpandible = [
            ...card.querySelectorAll('button[aria-expanded],[role="button"][aria-expanded]')
        ].find(
            el =>
                el.closest(TARJETAS) === card &&
                !el.matches('.js-review-state-icon-button,[id^="content-item-overflow-menu-button-"]')
        );

        return !!botonExpandible && RE.carpeta.test(nombre);
    }

    function esEvaluacionOnline(el) {
        if (!el) return false;
        const analytics = el.getAttribute('data-analytics-id') || '';
        const href = el.getAttribute('href') || '';
        const label = el.getAttribute('aria-label') || '';

        return (
            analytics.includes('gradebook.item.assessment') ||
            analytics.includes('forumLink') ||
            /\/ultra\/courses\/[^/]+\/(?:assessment|discussion)\//i.test(href) ||
            /^(?:examen|cuestionario|foro)\b/i.test(label)
        );
    }

    function esTarjetaScormOInteractiva(card, el, nombre, padres = []) {
        if (RE.interactivo.test(nombre) || padres.some(x => RE.interactivo.test(x))) {
            return true;
        }
        const href = el?.getAttribute('href') || '';
        const label = el?.getAttribute('aria-label') || '';
        const analytics = el?.getAttribute('data-analytics-id') || '';
        if (
            /\/scorm\//i.test(href) ||
            /\bscorm\b/i.test(label) ||
            /\bscorm\b/i.test(analytics) ||
            card?.querySelector('svg[aria-label*="SCORM" i], [aria-label^="Paquete SCORM" i], a[href*="/scorm/"]')
        ) {
            return true;
        }
        return false;
    }

    function elegirAccion(card) {
        const candidatos = [
            ...card.querySelectorAll(
                '[data-analytics-id="content.item.course.outline.courseContent.link"],' +
                '[data-analytics-id="content.item.coures.outline.document.link"],' +
                '[data-analytics-id="content.item.courses.outline.document.link"],' +
                'a[aria-label^="Enlace,"],' +
                'button[aria-label^="Enlace,"],' +
                'a[aria-label^="Documento de texto,"],' +
                'a.ax-focusable-title,button.ax-focusable-title,' +
                'a[href],button[href],' +
                '[role="link"],button'
            )
        ].filter(
            el =>
                el.closest(TARJETAS) === card &&
                !el.closest(
                    '[data-maximus],[role="menu"],.dropdown-menu,.content-item__review-state-icon'
                ) &&
                !el.matches(
                    '.js-review-state-icon-button,' +
                    '[id^="content-item-overflow-menu-button-"],' +
                    '[data-analytics-id*="loadMoreButton"]'
                ) &&
                !esEvaluacionOnline(el)
        );

        return (
            candidatos.find(el => {
                if (
                    el.matches(
                        'button[id^="folder-title-"],button[id^="learning-module-title-"],[data-analytics-id="content.item.folder.toggleFolder.button"]'
                    )
                ) {
                    return false;
                }

                const nombre = tituloEl(el);

                if (
                    !nombre ||
                    nombre.length > 190 ||
                    RE.unidad.test(nombre) ||
                    RE.excluir.test(nombre)
                ) {
                    return false;
                }

                return (
                    el.matches('a[href],button[href],[role="link"]') ||
                    !!el.getAttribute('data-analytics-id') ||
                    /^(?:(?:[usm]\d+\s*[|:]\s*)?(?:pdf|audio|actividad|material|instructivo|instrucciones|respuesta|documento|archivo|gu[ií]a|lectura|presentaci[oó]n|infograf[ií]a|video|resumen|informaci[oó]n))\b/i.test(
                        nombre
                    ) ||
                    /^(?:enlace|documento de texto),/i.test(el.getAttribute('aria-label') || '')
                );
            }) || null
        );
    }

    // Recorre las tarjetas de la unidad y reconstruye en qué carpeta va cada ítem usando el árbol del DOM o la sangría X en pantalla.
    function recursos(u) {
        const salida = [];
        const vistos = new Set();
        const stack = [];

        const cards = [...u.raiz.querySelectorAll(TARJETAS)].filter(
            c => c !== u.raiz && dentroDeUnidad(c, u)
        );

        const filas = [];

        for (const card of cards) {
            const nombre = nombreCard(card);
            if (!nombre || RE.unidad.test(nombre)) continue;

            const folder = esCarpeta(card, nombre);
            const el = folder ? null : elegirAccion(card);

            if (!folder && !el) continue;

            filas.push({
                card,
                nombre,
                folder,
                el,
                x: (el || card).getBoundingClientRect().left
            });
        }

        for (const f of filas) {
            while (stack.length && f.x <= stack.at(-1).x + 3) {
                stack.pop();
            }

            const ancestros = [];

            for (
                let p = f.card.parentElement?.closest(TARJETAS);
                p && p !== u.raiz && u.raiz.contains(p);
                p = p.parentElement?.closest(TARJETAS)
            ) {
                const n = nombreCard(p);
                if (n && esCarpeta(p, n)) {
                    ancestros.unshift(seguro(n));
                }
            }

            if (f.folder) {
                stack.push({ x: f.x, nombre: f.nombre });
                continue;
            }

            const padres = ancestros.length
                ? ancestros
                : stack.map(x => seguro(x.nombre));

            const linkDirecto = f.card.querySelector(
                'a[download], a[href*="bbcswebdav"], a[href*="isForcedDownload"], [data-download-url]'
            );

            const raw =
                linkDirecto?.getAttribute('href') ||
                linkDirecto?.getAttribute('data-download-url') ||
                f.el.getAttribute('href') ||
                f.el.getAttribute('data-href') ||
                f.el.getAttribute('data-download-url');

            const url = urlReal(raw);
            const contentId = f.card.getAttribute('data-content-id') || '';

            const id =
                contentId ||
                `${f.nombre}|${Math.round(f.el.getBoundingClientRect().top)}`;

            if (vistos.has(id)) continue;
            vistos.add(id);

            const hrefAttr = f.el.getAttribute('href') || '';
            const analyticsAttr = f.el.getAttribute('data-analytics-id') || '';
            const labelAttr = f.el.getAttribute('aria-label') || '';

            salida.push({
                contentId,
                tarjeta: f.card,
                el: f.el,
                nombre: f.nombre,
                carpetas: padres,
                ruta: [...padres, seguro(f.nombre)],
                url,
                esDocUltra:
                    /\/ultra\/courses\/[^/]+\/document\//i.test(hrefAttr) ||
                    analyticsAttr.includes('.outline.document.link') ||
                    /^documento de texto,/i.test(labelAttr),
                hrefOriginal: hrefAttr,
                clic: f.el.matches('button') || !url,
                omitido: esTarjetaScormOInteractiva(f.card, f.el, f.nombre, padres)
            });
        }

        const selector =
            'a[href],button[href],' +
            'button[aria-label^="Enlace,"],' +
            'button[data-analytics-id="content.item.course.outline.courseContent.link"],' +
            'a[data-analytics-id="content.item.coures.outline.document.link"],' +
            'a[data-analytics-id="content.item.courses.outline.document.link"],' +
            '[role="link"][data-href],' +
            '[data-download-url]';

        for (const el of u.raiz.querySelectorAll(selector)) {
            if (
                !dentroDeUnidad(el, u) ||
                el === u.titulo ||
                !visible(el) ||
                el.matches('.js-review-state-icon-button,[id^="content-item-overflow-menu-button-"]') ||
                el.closest('.content-item__review-state-icon') ||
                esEvaluacionOnline(el)
            ) {
                continue;
            }

            const card =
                el.closest(TARJETAS) ||
                el.closest('li,[role="listitem"],[class*="itemContainer"]') ||
                el.parentElement;

            if (!card) continue;

            const nombre = tituloEl(el).replace(/^(?:Enlace|Documento de texto),\s*/i, '');

            if (
                !nombre ||
                nombre.length > 180 ||
                RE.excluir.test(nombre) ||
                RE.unidad.test(nombre) ||
                esCarpeta(card, nombre)
            ) {
                continue;
            }

            if (el.closest('[role="menu"],.dropdown-menu')) continue;

            if (
                salida.some(
                    r =>
                        r.el === el ||
                        (r.tarjeta === card && canon(r.nombre) === canon(nombre))
                )
            ) {
                continue;
            }

            const url = urlReal(
                el.getAttribute('href') ||
                el.getAttribute('data-href') ||
                el.getAttribute('data-download-url')
            );

            const contentId = card.getAttribute('data-content-id') || '';
            const id =
                contentId ||
                `${nombre}:${Math.round(el.getBoundingClientRect().top)}`;

            if (vistos.has(id)) continue;
            vistos.add(id);

            const padres = [];

            for (
                let p = card.parentElement?.closest(TARJETAS);
                p && p !== u.raiz && u.raiz.contains(p);
                p = p.parentElement?.closest(TARJETAS)
            ) {
                const n = nombreCard(p);
                if (n && esCarpeta(p, n)) {
                    padres.unshift(seguro(n));
                }
            }

            const hrefAttr = el.getAttribute('href') || '';
            const analyticsAttr = el.getAttribute('data-analytics-id') || '';
            const labelAttr = el.getAttribute('aria-label') || '';

            salida.push({
                contentId,
                tarjeta: card,
                el,
                nombre,
                carpetas: padres,
                ruta: [...padres, seguro(nombre)],
                url,
                esDocUltra:
                    /\/ultra\/courses\/[^/]+\/document\//i.test(hrefAttr) ||
                    analyticsAttr.includes('.outline.document.link') ||
                    /^documento de texto,/i.test(labelAttr),
                hrefOriginal: hrefAttr,
                clic: el.matches('button') || !url,
                omitido: esTarjetaScormOInteractiva(card, el, nombre, padres)
            });
        }

        return salida.sort((a, b) => posicion(a.el, b.el));
    }

    // Cuando se cierra una vista de documento a pantalla completa, Blackboard vuelve a crear los nodos del DOM y hay que reencontrar la referencia.
    function reconectarElementoRecurso(r, u) {
        if (r.el?.isConnected && !enVistaDocumentoPantallaCompleta()) return r.el;

        if (r.contentId) {
            const card = document.querySelector(`.content-list-item[data-content-id="${r.contentId}"]`);
            if (card) {
                r.tarjeta = card;
                const accion = elegirAccion(card);
                if (accion) {
                    r.el = accion;
                    return accion;
                }
            }
        }

        if (u?.raiz && !u.raiz.isConnected && u.contentId) {
            const nuevaRaiz = document.querySelector(`.content-list-item[data-content-id="${u.contentId}"]`);
            if (nuevaRaiz) u.raiz = nuevaRaiz;
        }

        const contenedorBusqueda = u?.raiz?.isConnected ? u.raiz : document;
        for (const card of contenedorBusqueda.querySelectorAll(TARJETAS)) {
            if (u?.raiz && card === u.raiz) continue;
            const nCard = nombreCard(card).replace(/^(?:Enlace|Documento de texto),\s*/i, '');
            if (canon(nCard) === canon(r.nombre)) {
                const accion = elegirAccion(card);
                if (accion) {
                    r.tarjeta = card;
                    r.el = accion;
                    return accion;
                }
            }
        }

        if (u?.raiz?.isConnected) {
            const itemsActuales = recursos(u);
            const match = itemsActuales.find(x => canon(x.nombre) === canon(r.nombre));
            if (match?.el?.isConnected) {
                r.tarjeta = match.tarjeta;
                r.el = match.el;
                return match.el;
            }
        }

        return r.el?.isConnected ? r.el : null;
    }

    // --- Módulo 8: Hoja de estilos CSS, barra de progreso y botonera con logo ---

    // Estilos CSS, barra de progreso por bloques, colores de estado en filas y botonera con el logo de Transformer en Base64.


    function cambiarTextoBoton(boton, etiqueta) {
        if (!boton) return;
        let span = boton.querySelector('.maximus-boton-texto');
        if (!span) {
            boton.innerHTML = `<img class="maximus-logo" src="${LOGO_BASE64}" alt=""><span class="maximus-boton-texto"></span>`;
            span = boton.querySelector('.maximus-boton-texto');
        }
        span.textContent = etiqueta;
    }

    function obtenerTextoBoton(boton) {
        if (!boton) return '';
        const span = boton.querySelector('.maximus-boton-texto');
        return span ? span.textContent : boton.textContent;
    }

    async function copiarTextoPortapapeles(contenido) {
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

    function inyectarCss() {
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

    function progreso(u, n, total, mensaje) {
        if (!u?.pct || !u?.estado) return;
        u.pct.textContent = `${total ? Math.round((n / total) * 100) : 0}%`;
        u.estado.textContent = mensaje;
        u.estado.title = mensaje;
    }

    function crearPiezas(u, items) {
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

    function pieza(u, i, estadoPieza, nombre) {
        if (!u) return;
        if (u.estadosPiezas?.[i]) {
            u.estadosPiezas[i].estado = estadoPieza;
            u.estadosPiezas[i].nombre = nombre;
        }
        if (!u.piezas?.[i]) return;
        u.piezas[i].className = `maximus-pieza ${estadoPieza}`;
        u.piezas[i].title = `${i + 1}. ${nombre}: ${estadoPieza}`;
    }

    function filaRecurso(it) {
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

    function colorear(it, estadoFila, detalle) {
        if (it.contentId) {
            estado.estadoFilas.set(it.contentId, { estado: estadoFila, detalle });
        }

        const fila = filaRecurso(it);
        if (!fila) return;

        fila.classList.remove('maximus-fila-ok', 'maximus-fila-error', 'maximus-fila-omitido');
        fila.classList.add(`maximus-fila-${estadoFila}`);
        fila.title = detalle;
    }

    function restaurarColoresFilas() {
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

    function limpiarPanelesEnVistaDocumento() {
        document.querySelectorAll('.maximus-panel').forEach(p => p.remove());
    }

    // --- Módulo 9: Control del visor lateral, vista completa y cierre con la X ---

    // Lectura del visor lateral/pantalla completa, extracción de enlaces tras hacer clic y cierre automático con el botón X.


    let fnRehidratarDom = null;

    function registrarRehidratador(fn) {
        fnRehidratarDom = fn;
    }

    function visor() {
        const docPanelPage = document.querySelector('document-panel');
        const scormPage = document.querySelector(
            'section.page-scorm-launch-frame, bb-scorm-launch-frame, learning-module-panel-view'
        );

        const panel =
            (docPanelPage && visible(docPanelPage) ? docPanelPage : null) ||
            (scormPage && visible(scormPage) ? scormPage : null) ||
            document.querySelector('.bb-offcanvas-panel.active') ||
            document.querySelector('.ms-Panel.is-open, [class*="rootIsOpen_"]') ||
            document.querySelector('url-launch-frame')?.closest('.bb-offcanvas-panel, .ms-Panel');

        const esInteractivoUnity = esVisorInteractivoUnity();

        const esFullDocument =
            esInteractivoUnity ||
            panel?.tagName.toLowerCase() === 'document-panel' ||
            panel?.matches?.('section.page-scorm-launch-frame, bb-scorm-launch-frame, learning-module-panel-view') ||
            enVistaDocumentoPantallaCompleta();

        const iframe =
            panel?.querySelector(
                'iframe#scorm-launch-iframe, iframe#url-launch-iframe, iframe[src]:not([hidden]), iframe[data-maximus-src]'
            ) ||
            document.querySelector(
                '#scorm-launch-iframe, url-launch-frame #url-launch-iframe, #url-launch-iframe'
            );

        const srcIframe =
            iframe?.dataset?.maximusSrc ||
            (iframe?.getAttribute('src') !== 'about:blank' ? iframe?.getAttribute('src') : '') ||
            iframe?.getAttribute('ng-src') ||
            estado.ultimaUrlIframeInterceptada ||
            '';

        const bloquesDoc = panel && !esInteractivoUnity ? extraerBloquesDeDocumentPanel(panel) : [];

        const enlacesDescarga =
            panel && !esInteractivoUnity
                ? [
                      ...panel.querySelectorAll(
                          'a[data-ally-file-preview-url], a[download], a[href*="bbcswebdav"], a[href*="isForcedDownload"], a[href*="download"], a[href$=".html"], a[href$=".htm"], a[target="_blank"][href^="http"], button[data-download-url]'
                      )
                  ].filter(el =>
                      urlReal(
                          el.getAttribute('data-ally-file-preview-url') ||
                          el.getAttribute('href') ||
                          el.getAttribute('data-download-url')
                      )
                  )
                : [];

        const enlaceDescargaPanel = enlacesDescarga[0] || null;

        const mediaPanel =
            panel && !esInteractivoUnity
                ? panel.querySelector('audio[src], video[src], audio source[src], video source[src]')
                : null;

        const cuerpoDocumento =
            panel && !esInteractivoUnity
                ? panel.querySelector(
                      '.bb-editor-root, .ql-editor, .bbml-editor, [data-analytics-id*="document"], .content_9896f174'
                  )
                : null;

        const abierto =
            esInteractivoUnity ||
            enVistaDocumentoPantallaCompleta() ||
            (!!panel &&
                visible(panel) &&
                (esFullDocument ||
                    panel.classList.contains('active') ||
                    panel.classList.contains('is-open') ||
                    /rootIsOpen_/i.test(panel.className)));

        return {
            iframe,
            srcIframe,
            panel,
            esFullDocument,
            esInteractivoUnity,
            bloquesDoc,
            enlacesDescarga,
            enlaceDescargaPanel,
            mediaPanel,
            cuerpoDocumento,
            abierto
        };
    }

    // Busca primero la X de la esquina superior izquierda (course.content.header.exit) que usan tanto document-panel como el visor SCORM.
    function buscarBotonCerrarVisor(v) {
        const candidatos = [
            document.querySelector('button[data-analytics-id="course.content.header.exit"]'),
            document.querySelector('button[data-analytics-id="course.content.scorm.launchFrame.exit"]'),
            document.querySelector('button[data-analytics-id="document.panel.exit"]'),
            document.querySelector('content-page-header button[aria-label="Salir"], content-page-header button[aria-label="Close"]'),
            document.querySelector('bb-readonly-panel-header button[aria-label="Salir"]'),
            ...(v.panel
                ? v.panel.querySelectorAll(
                      'button[data-analytics-id="course.content.header.exit"],' +
                      'button[data-analytics-id="course.content.scorm.launchFrame.exit"],' +
                      'button.bb-close[data-close="bb-offcanvas"],' +
                      'button.ms-Panel-closeButton,' +
                      'button[class*="closeButton_"],' +
                      'button[analytics-id="bb-close.courseCore.course.webLinkLaunchFrame.title"],' +
                      'button[aria-label="Salir"],' +
                      'button[aria-label="Cerrar"],' +
                      'button[aria-label="Close"]'
                  )
                : []),
            document.querySelector('button.bb-close[data-close="bb-offcanvas"], button.ms-Panel-closeButton, button[class*="closeButton_"]'),
            document.querySelector('a[data-analytics-id="course.content.header.breadcrumbs.course.link"]')
        ].filter(Boolean);

        return candidatos.find(b => visible(b)) || candidatos[0] || null;
    }

    async function cerrarVisor(uLog, uActiva = null, pcActivo = null) {
        estado.ultimoInteractivoDetectado = false;
        const v = visor();
        if (!v.abierto && !enVistaDocumentoPantallaCompleta()) return true;

        const eraFullDocument = v.esFullDocument || enVistaDocumentoPantallaCompleta();

        // Vaciamos el iframe de SCORM antes de salir para que el navegador suelte el contexto WebGL de inmediato.
        const scormIframe = document.querySelector('iframe#scorm-launch-iframe, iframe[src*="scor-scormengine"]');
        if (scormIframe && scormIframe.getAttribute('src') !== 'about:blank') {
            scormIframe.setAttribute('src', 'about:blank');
        }

        const boton = buscarBotonCerrarVisor(v);

        if (boton) {
            boton.click();
        } else if (eraFullDocument) {
            history.back();
        } else {
            uLog?.log?.push('[VISOR] No se encontró la X de la esquina / Salir');
            return false;
        }

        let cerrado = await esperarHasta(
            () => {
                estado.ultimoInteractivoDetectado = false;
                return !visor().abierto && !enVistaDocumentoPantallaCompleta();
            },
            5000
        );

        if (!cerrado) {
            const linkOutline = document.querySelector(
                'a[data-analytics-id="course.content.header.breadcrumbs.course.link"], a[href*="/outline"]'
            );
            if (linkOutline) {
                linkOutline.click();
            } else if (eraFullDocument) {
                history.back();
            }
            cerrado = await esperarHasta(
                () => {
                    estado.ultimoInteractivoDetectado = false;
                    return !visor().abierto && !enVistaDocumentoPantallaCompleta();
                },
                5500
            );
        }

        if (eraFullDocument && !estado.cancelado && fnRehidratarDom) {
            await fnRehidratarDom(uActiva, pcActivo);
        } else if (eraFullDocument && estado.cancelado) {
            await esperarHasta(() => !!document.querySelector(TARJETAS), 6000);
        }

        return cerrado;
    }

    async function asegurarElementoEnDom(r, uActiva, uLog, pcActivo) {
        if (enVistaDocumentoPantallaCompleta() || visor().abierto) {
            await cerrarVisor(uLog, uActiva, pcActivo);
        }

        let el = reconectarElementoRecurso(r, uActiva);
        if (el?.isConnected) return el;

        if (uActiva && fnRehidratarDom) {
            await fnRehidratarDom(uActiva, pcActivo);
        }

        await esperarHasta(() => {
            el = reconectarElementoRecurso(r, uActiva);
            return !!el?.isConnected;
        }, 5500);

        return reconectarElementoRecurso(r, uActiva);
    }

    // Intenta sacar el recurso por API REST primero; si no alcanza, hace clic en el ítem del DOM y lee el visor que abre Blackboard.
    async function capturarClic(r, uLog, uActiva = null, pcActivo = null) {
        verificarCancelacion();

        const courseId = obtenerIdCursoActual();
        const docId =
            r.contentId ||
            r.hrefOriginal?.match(/\/(?:document|scorm\/overview)\/(_\d+_\d+)/i)?.[1] ||
            '';

        if (courseId && docId) {
            const viaApi = await extraerDocumentoViaApiBlackboard(courseId, docId, r.nombre);
            if (viaApi && viaApi.length > 0) {
                if (viaApi[0]?.omitidoInteractivo) {
                    return viaApi;
                }
                uLog?.log?.push(`[NINJA API] ${r.nombre} extraído sin cambiar de pantalla (${viaApi.length} elementos)`);
                return viaApi;
            }
        }

        if (
            r.url &&
            (esUrlExterna(r.url) || /\.html?(?:$|[?#])/i.test(r.url) || !esRutaSpaBlackboard(r.url))
        ) {
            return [{ url: r.url, nombre: r.nombre }];
        }

        await asegurarElementoEnDom(r, uActiva, uLog, pcActivo);

        if (!r.el?.isConnected) {
            throw new Error('El enlace ya no existe en el DOM');
        }

        if (esTarjetaScormOInteractiva(r.tarjeta, r.el, r.nombre, r.carpetas || [])) {
            return [{ omitidoInteractivo: true }];
        }

        const hrefDirectoEl = r.el.getAttribute('href') || '';
        if (hrefDirectoEl && esUrlScormOInteractivo(hrefDirectoEl)) {
            return [{ omitidoInteractivo: true }];
        }
        if (hrefDirectoEl && !esRutaSpaBlackboard(hrefDirectoEl)) {
            const urlDirecta = urlReal(hrefDirectoEl);
            if (urlDirecta) {
                return [{ url: urlDirecta, nombre: r.nombre }];
            }
        }

        if (!(await cerrarVisor(uLog, uActiva, pcActivo))) {
            throw new Error('No se pudo cerrar el visor anterior');
        }

        verificarCancelacion();
        await asegurarElementoEnDom(r, uActiva, uLog, pcActivo);

        const anterior = visor();
        const srcAntes = anterior.srcIframe || '';
        estado.ultimaUrlIframeInterceptada = '';
        estado.ultimoInteractivoDetectado = false;

        r.el.click();

        const valido = await esperarHasta(() => {
            if (esVisorInteractivoUnity()) return true;
            if (estado.ultimaUrlIframeInterceptada) return true;

            const v = visor();
            const src =
                v.enlaceDescargaPanel?.getAttribute('data-ally-file-preview-url') ||
                v.enlaceDescargaPanel?.getAttribute('href') ||
                v.enlaceDescargaPanel?.getAttribute('data-download-url') ||
                v.mediaPanel?.getAttribute('src') ||
                v.srcIframe;

            return !!(
                enVistaDocumentoPantallaCompleta() ||
                (v.abierto &&
                    (v.esFullDocument ||
                        v.bloquesDoc?.length ||
                        (src && (src !== srcAntes || !anterior.abierto)) ||
                        v.cuerpoDocumento))
            );
        }, CFG.ESPERA_VISOR);

        verificarCancelacion();

        // Si al abrir el ítem resultó ser un paquete de Unity o SCORM, pulsamos la X de inmediato y lo saltamos.
        if (esVisorInteractivoUnity() || visor().esInteractivoUnity || esUrlScormOInteractivo(visor().srcIframe)) {
            uLog?.log?.push(`[UNITY/SCORM] Detectado en "${r.nombre}" -> Presionando la X de la esquina para salir`);
            await cerrarVisor(uLog, uActiva, pcActivo);
            return [{ omitidoInteractivo: true }];
        }

        if (!valido && estado.ultimaUrlIframeInterceptada) {
            return [{ url: estado.ultimaUrlIframeInterceptada, nombre: r.nombre }];
        }

        if (!valido) {
            throw new Error('Blackboard no abrió el visor de descarga');
        }

        if (estado.ultimaUrlIframeInterceptada && !visor().abierto && !enVistaDocumentoPantallaCompleta()) {
            return [{ url: estado.ultimaUrlIframeInterceptada, nombre: r.nombre }];
        }

        if (visor().esFullDocument || enVistaDocumentoPantallaCompleta() || r.esDocUltra) {
            await esperarHasta(() => {
                if (esVisorInteractivoUnity()) return true;
                const docPanel = document.querySelector('document-panel') || visor().panel;
                if (!docPanel) return false;
                const cargando = docPanel.querySelector('[class*="progressContainer"], .ms-Spinner');
                if (cargando) return false;
                const bloques = extraerBloquesDeDocumentPanel(docPanel);
                if (bloques.length > 0) return true;
                const regionesArchivo = docPanel.querySelectorAll('[role="region"][aria-label="Archivo"]');
                if (regionesArchivo && regionesArchivo.length > 0) return false;
                const editor = docPanel.querySelector('.bbml-editor, .ql-editor');
                return !!(editor && texto(editor.textContent).length > 20);
            }, 8000);

            await dormir(350);
        } else {
            await esperarHasta(() => {
                if (esVisorInteractivoUnity()) return true;
                const v = visor();
                return !!(
                    v.bloquesDoc?.length ||
                    v.enlaceDescargaPanel ||
                    v.mediaPanel ||
                    v.srcIframe
                );
            }, 1800);
        }

        verificarCancelacion();

        if (esVisorInteractivoUnity() || visor().esInteractivoUnity || esUrlScormOInteractivo(visor().srcIframe)) {
            uLog?.log?.push(`[UNITY/SCORM] Detectado en "${r.nombre}" -> Presionando la X de la esquina para salir`);
            await cerrarVisor(uLog, uActiva, pcActivo);
            return [{ omitidoInteractivo: true }];
        }

        const v = visor();

        const bloquesExtraidos = extraerBloquesDeDocumentPanel(v.panel || document);
        if (bloquesExtraidos.length) {
            return bloquesExtraidos.map(b => ({
                url: b.url,
                nombre: b.nombreArchivoSugerido || b.nombre,
                subCarpeta: b.nombre
            }));
        }

        if (v.enlacesDescarga?.length) {
            const items = v.enlacesDescarga
                .map(el => ({
                    url: urlReal(
                        el.getAttribute('data-ally-file-preview-url') ||
                        el.getAttribute('href') ||
                        el.getAttribute('data-download-url')
                    ),
                    nombre: limpiarPrefijoXid(
                        el.getAttribute('data-ally-file-eid') ||
                        el.getAttribute('download') ||
                        r.nombre
                    )
                }))
                .filter(x => x.url);

            if (items.length) return items;
        }

        const directo =
            v.enlaceDescargaPanel?.getAttribute('data-ally-file-preview-url') ||
            v.enlaceDescargaPanel?.getAttribute('href') ||
            v.enlaceDescargaPanel?.getAttribute('data-download-url') ||
            v.mediaPanel?.getAttribute('src');

        if (directo && urlReal(directo)) {
            return [{ url: urlReal(directo), nombre: r.nombre }];
        }

        const urlIframe = urlReal(v.srcIframe);
        if (urlIframe) {
            return [{ url: urlIframe, nombre: r.nombre }];
        }

        try {
            const docIframe = v.iframe?.contentDocument;
            if (docIframe) {
                if (docIframe.querySelector('#unity-container, #unity-canvas, canvas[id*="unity" i]')) {
                    uLog?.log?.push(`[UNITY/SCORM] Canvas Unity detectado en "${r.nombre}" -> Presionando la X`);
                    await cerrarVisor(uLog, uActiva, pcActivo);
                    return [{ omitidoInteractivo: true }];
                }

                const internos = [
                    ...docIframe.querySelectorAll(
                        'a[download], a[href*="bbcswebdav"], audio[src], video[src], source[src], embed[src]'
                    )
                ]
                    .map(el => ({
                        url: urlReal(el.getAttribute('href') || el.getAttribute('src'), location.href),
                        nombre: r.nombre
                    }))
                    .filter(x => x.url);

                if (internos.length) {
                    return internos;
                }
            }
        } catch {
            // Iframe en otro dominio bloqueado por políticas del navegador.
        }

        const contenedorTexto = v.panel || document.querySelector('document-panel');
        if (contenedorTexto) {
            const parrafos = [...contenedorTexto.querySelectorAll('.ql-editor, .bbml-editor')]
                .map(ed => (ed.innerText || ed.textContent || '').trim())
                .filter(Boolean)
                .join('\r\n\r\n');

            const contenidoTxt =
                parrafos ||
                texto(v.cuerpoDocumento?.innerText || v.cuerpoDocumento?.textContent || '');
            if (contenidoTxt && contenidoTxt.length > 5) {
                return [{ textoPlano: contenidoTxt }];
            }
        }

        throw new Error('El visor no tiene archivo descargable');
    }

    // --- Módulo 10: Cola de descarga de unidades y curso completo ---

    // Cola de descarga por unidad y para el curso entero, armado del reporte final y control de parada.


    let fnAgendar = null;

    function registrarAgendador(fn) {
        fnAgendar = fn;
    }

    async function procesarRecursoItem(r, uLog, zip, carpetaBase, uActiva = null, pcActivo = null) {
        verificarCancelacion();

        const ruta = r.ruta.join(' / ');
        let resultado = { archivos: [], errores: [] };
        let fallo = '';

        if (r.url) {
            try {
                resultado = await recuperar(
                    r.url,
                    r.nombreArchivoSugerido || r.nombre,
                    0,
                    new Set(),
                    ''
                );
            } catch (e) {
                if (e.esCancelacion || estado.cancelado) throw e;
                fallo = e.message;
            }
        }

        const esEnlaceExternoDirecto = !!(r.url && esUrlExterna(r.url));

        if (!resultado.archivos.length && !esEnlaceExternoDirecto) {
            try {
                const capturados = await capturarClic(r, uLog, uActiva, pcActivo);

                if (visor().esFullDocument || enVistaDocumentoPantallaCompleta()) {
                    await cerrarVisor(uLog, uActiva, pcActivo);
                }

                if (capturados.some(c => c?.omitidoInteractivo)) {
                    return { omitidoInteractivo: true, guardados: [], errores: [] };
                }

                for (const itemCap of capturados) {
                    verificarCancelacion();

                    if (typeof itemCap === 'string') {
                        uLog.log.push(`[VISOR] ${ruta} -> ${itemCap}`);
                        const rec = await recuperar(itemCap, r.nombre);
                        resultado.archivos.push(...rec.archivos);
                        resultado.errores.push(...rec.errores);
                    } else if (itemCap?.url) {
                        const etiquetaSub = itemCap.subCarpeta || itemCap.nombre || r.nombre;
                        if (uActiva) {
                            progreso(uActiva, 0, 1, `Descargando (${r.nombre}): ${etiquetaSub}...`);
                        }
                        uLog.log.push(`[VISOR] ${ruta} (${etiquetaSub}) -> ${itemCap.url}`);
                        const rec = await recuperar(
                            itemCap.url,
                            itemCap.nombre || r.nombre,
                            0,
                            new Set(),
                            itemCap.subCarpeta || ''
                        );
                        resultado.archivos.push(...rec.archivos);
                        resultado.errores.push(...rec.errores);
                    } else if (itemCap?.textoPlano) {
                        resultado.archivos.push({
                            nombre: `${seguro(r.nombre)}.txt`,
                            bytes: new TextEncoder().encode(itemCap.textoPlano),
                            subCarpeta: ''
                        });
                    }
                }

                if (!resultado.archivos.length) {
                    fallo = [fallo, ...resultado.errores].filter(Boolean).join(' | ');
                } else {
                    resultado.errores = [];
                }
            } catch (e) {
                if (e.esCancelacion || estado.cancelado) throw e;
                fallo = [fallo, e.message].filter(Boolean).join(' | ');
            }
        }

        if (!resultado.archivos.length) {
            throw new Error(
                fallo || resultado.errores.join(' | ') || 'No se descargó ningún archivo'
            );
        }

        const guardados = [];
        for (const f of resultado.archivos) {
            const subExtra =
                f.subCarpeta && canon(f.subCarpeta) !== canon(r.ruta.at(-1) || '')
                    ? [seguro(f.subCarpeta)]
                    : [];

            const rutaBase = [carpetaBase, ...r.ruta, ...subExtra]
                .filter(Boolean)
                .join('/');

            const rutaFinal = rutaLibre(zip, rutaBase, f.nombre);
            zip.agregar(rutaFinal, f.bytes);
            guardados.push({
                rutaFinal,
                bytes: f.bytes,
                etiqueta: f.subCarpeta || r.nombre
            });
        }

        return { omitidoInteractivo: false, guardados, errores: resultado.errores };
    }

    async function ejecutar(u) {
        if (estado.ocupado) return;
        marcarOcupado(true);
        estado.cancelado = false;
        estado.tareaActiva = u;

        for (const otra of estado.unidades.values()) {
            if (otra !== u && otra.boton) otra.boton.disabled = true;
        }
        if (estado.panelCurso?.boton) estado.panelCurso.boton.disabled = true;

        u.boton.disabled = false;
        u.boton.classList.remove('listo');
        u.boton.classList.add('detener');
        cambiarTextoBoton(u.boton, 'Detener descarga');
        u.copiar.hidden = true;

        if (u.zipUrl) {
            URL.revokeObjectURL(u.zipUrl);
            u.zipUrl = null;
        }
        u.zipBlob = null;

        const cabeceraLog = [
            'Maximus Orden v3.2.0',
            `Unidad: ${u.nombre}`,
            `Fecha: ${new Date().toLocaleString('es-CL')}`,
            ''
        ];
        u.log = [...cabeceraLog];

        let ok = 0;
        let errores = 0;
        let omitidos = 0;

        try {
            progreso(u, 0, 1, 'Abriendo unidad y carpetas...');
            await expandirCarpetas(u);
            verificarCancelacion();

            const items = recursos(u);

            if (!items.length) {
                throw new Error('No se detectaron recursos en esta unidad');
            }

            crearPiezas(u, items);

            const zip = crearZipNativo();
            const carpetaRaiz = seguro(u.nombre);
            const archivosParaMapa = [];

            for (let i = 0; i < items.length; i++) {
                verificarCancelacion();

                const r = items[i];
                const ruta = r.ruta.join(' / ');

                pieza(u, i, 'procesando', r.nombre);
                progreso(u, i, items.length, `Descargando: ${r.nombre}`);

                if (r.omitido) {
                    omitidos++;
                    pieza(u, i, 'omitido', r.nombre);
                    colorear(r, 'omitido', 'Material interactivo / SCORM omitido');
                    u.log.push(`[OMITIDO] ${ruta}`);
                } else {
                    try {
                        const { omitidoInteractivo, guardados, errores: errParciales } = await procesarRecursoItem(
                            r,
                            u,
                            zip,
                            carpetaRaiz,
                            u,
                            null
                        );

                        if (omitidoInteractivo) {
                            omitidos++;
                            pieza(u, i, 'omitido', r.nombre);
                            colorear(r, 'omitido', 'Contenido interactivo Unity / SCORM cerrado automáticamente');
                            u.log.push(`[OMITIDO] ${ruta} (Contenido interactivo Unity / SCORM)`);
                        } else {
                            for (const g of guardados) {
                                ok++;
                                const comentario = describirArchivo(
                                    g.rutaFinal.split('/').pop(),
                                    g.bytes.byteLength,
                                    g.etiqueta
                                );
                                archivosParaMapa.push({ ruta: g.rutaFinal, comentario });
                                u.log.push(
                                    `[OK] ${g.rutaFinal} (${(g.bytes.byteLength / 1024).toFixed(1)} KB)`
                                );
                            }

                            if (errParciales.length) {
                                errores += errParciales.length;
                                pieza(u, i, 'error', r.nombre);
                                colorear(r, 'error', errParciales.join(' | '));
                                errParciales.forEach(e =>
                                    u.log.push(`[ERROR PARCIAL] ${ruta}: ${e}`)
                                );
                            } else {
                                pieza(u, i, 'ok', r.nombre);
                                colorear(r, 'ok', 'Archivo añadido al ZIP');
                            }
                        }
                    } catch (e) {
                        if (e.esCancelacion || estado.cancelado) throw e;
                        errores++;
                        pieza(u, i, 'error', r.nombre);
                        colorear(r, 'error', e.message);
                        u.log.push(`[ERROR] ${ruta}: ${e.message}`);
                    } finally {
                        if (visor().abierto || enVistaDocumentoPantallaCompleta()) {
                            await cerrarVisor(u, u, null);
                        }
                    }
                }

                progreso(
                    u,
                    i + 1,
                    items.length,
                    `OK: ${ok} · Errores: ${errores} · Omitidos: ${omitidos}`
                );

                await dormir(CFG.PAUSA);
            }

            verificarCancelacion();

            archivosParaMapa.push({
                ruta: `${carpetaRaiz}/_REPORTE.txt`,
                comentario: 'Mapa de estructura de archivos y registro de descarga'
            });

            const mapaAscii = generarMapaArbol(carpetaRaiz, archivosParaMapa);

            u.log = [
                ...cabeceraLog,
                'ESTRUCTURA DE ARCHIVOS:',
                mapaAscii,
                '',
                'DETALLE DE OPERACIONES:',
                ...u.log.slice(cabeceraLog.length),
                '',
                `Archivos: ${ok} | Errores: ${errores} | Omitidos: ${omitidos}`
            ];

            zip.agregar(`${carpetaRaiz}/_REPORTE.txt`, u.log.join('\r\n'));

            u.pct.textContent = '99%';
            u.estado.textContent = 'Empaquetando archivo .zip...';
            await dormir(20);

            const blob = zip.generarBlob();

            u.zipBlob = blob;
            u.zipNombre = `${carpetaRaiz}.zip`;

            guardarZip(u);

            u.pct.textContent = '100%';
            u.estado.textContent = `Descargado (${(blob.size / 1048576).toFixed(2)} MB) · ${ok} archivos · ${errores} errores · ${omitidos} omitidos`;
            cambiarTextoBoton(u.boton, 'Guardar .zip');
            u.boton.classList.remove('detener');
            u.boton.classList.add('listo');
            u.boton.title = 'Clic: volver a guardar el ZIP al instante. Mayús + clic: volver a escanear la unidad.';
        } catch (e) {
            if (e.esCancelacion || estado.cancelado) {
                u.log.push('[CANCELADO] Descarga detenida por el usuario');
                u.estado.textContent = `Descarga detenida (${ok} archivos procesados antes de detener).`;
                cambiarTextoBoton(u.boton, 'Descargar .zip');
                u.boton.classList.remove('detener', 'listo');
            } else {
                u.log.push(`[ERROR GENERAL] ${e.message}`);
                u.estado.textContent = `Error: ${e.message}`;
                cambiarTextoBoton(u.boton, 'Descargar .zip');
                u.boton.classList.remove('detener');
                console.error('[Maximus Orden]', e);
            }
        } finally {
            if (visor().abierto || enVistaDocumentoPantallaCompleta()) {
                await cerrarVisor(u, u, null);
            }

            for (const otra of estado.unidades.values()) {
                if (otra.boton) {
                    otra.boton.disabled = false;
                    otra.boton.classList.remove('detener');
                }
            }
            if (estado.panelCurso?.boton) {
                estado.panelCurso.boton.disabled = false;
                estado.panelCurso.boton.classList.remove('detener');
            }

            restaurarColoresFilas();
            u.copiar.hidden = false;
            u.boton.disabled = false;
            estado.tareaActiva = null;
            estado.cancelado = false;
            marcarOcupado(false);
            fnAgendar?.();
        }
    }

    async function ejecutarTodoElCurso(pc) {
        if (estado.ocupado) return;
        marcarOcupado(true);
        estado.cancelado = false;
        estado.tareaActiva = pc;

        pc.boton.disabled = false;
        pc.boton.classList.remove('listo');
        pc.boton.classList.add('detener');
        cambiarTextoBoton(pc.boton, 'Detener descarga');
        pc.copiar.hidden = true;

        for (const u of estado.unidades.values()) {
            if (u.boton) u.boton.disabled = true;
        }

        if (pc.zipUrl) {
            URL.revokeObjectURL(pc.zipUrl);
            pc.zipUrl = null;
        }
        pc.zipBlob = null;

        const nombreCurso = obtenerNombreCurso();
        pc.nombre = nombreCurso;

        const cabeceraLog = [
            'Maximus Orden v3.2.0 - CURSO COMPLETO',
            `Curso: ${nombreCurso}`,
            `Fecha: ${new Date().toLocaleString('es-CL')}`,
            ''
        ];
        pc.log = [...cabeceraLog];

        let ok = 0;
        let errores = 0;
        let omitidos = 0;

        try {
            const listaUnidades = [...estado.unidades.values()].sort((a, b) =>
                posicion(a.titulo, b.titulo)
            );

            if (!listaUnidades.length) {
                throw new Error('No se encontraron unidades habilitadas en el curso');
            }

            const colaGlobal = [];

            for (let idx = 0; idx < listaUnidades.length; idx++) {
                verificarCancelacion();

                const u = listaUnidades[idx];
                progreso(
                    pc,
                    idx,
                    listaUnidades.length,
                    `Abriendo (${idx + 1}/${listaUnidades.length}): ${u.nombre}...`
                );
                u.log = [];
                await expandirCarpetas(u);

                const itemsUnidad = recursos(u);
                if (itemsUnidad.length) {
                    crearPiezas(u, itemsUnidad);
                    itemsUnidad.forEach((item, localIdx) => {
                        colaGlobal.push({
                            u,
                            item,
                            localIdx,
                            totalUnidad: itemsUnidad.length,
                            nombre: `${u.nombre} / ${item.nombre}`
                        });
                    });
                }
            }

            if (!colaGlobal.length) {
                throw new Error('No se detectaron recursos descargables en el curso');
            }

            crearPiezas(pc, colaGlobal);

            const zip = crearZipNativo();
            const carpetaCurso = seguro(nombreCurso);
            const archivosParaMapa = [];

            for (let i = 0; i < colaGlobal.length; i++) {
                verificarCancelacion();

                const { u, item: r, localIdx, totalUnidad } = colaGlobal[i];
                const carpetaUnidad = `${carpetaCurso}/${seguro(u.nombre)}`;
                const rutaLog = `${seguro(u.nombre)} / ${r.ruta.join(' / ')}`;

                pieza(pc, i, 'procesando', `${u.nombre}: ${r.nombre}`);
                pieza(u, localIdx, 'procesando', r.nombre);

                progreso(
                    pc,
                    i,
                    colaGlobal.length,
                    `[${u.nombre}] Descargando: ${r.nombre}`
                );
                progreso(u, localIdx, totalUnidad, `Descargando: ${r.nombre}`);

                if (r.omitido) {
                    omitidos++;
                    pieza(pc, i, 'omitido', `${u.nombre}: ${r.nombre}`);
                    pieza(u, localIdx, 'omitido', r.nombre);
                    colorear(r, 'omitido', 'Material interactivo / SCORM omitido');
                    pc.log.push(`[OMITIDO] ${rutaLog}`);
                } else {
                    try {
                        const { omitidoInteractivo, guardados, errores: errParciales } = await procesarRecursoItem(
                            r,
                            pc,
                            zip,
                            carpetaUnidad,
                            u,
                            pc
                        );

                        if (omitidoInteractivo) {
                            omitidos++;
                            pieza(pc, i, 'omitido', `${u.nombre}: ${r.nombre}`);
                            pieza(u, localIdx, 'omitido', r.nombre);
                            colorear(r, 'omitido', 'Contenido interactivo Unity / SCORM cerrado automáticamente');
                            pc.log.push(`[OMITIDO] ${rutaLog} (Contenido interactivo Unity / SCORM)`);
                        } else {
                            for (const g of guardados) {
                                ok++;
                                const comentario = describirArchivo(
                                    g.rutaFinal.split('/').pop(),
                                    g.bytes.byteLength,
                                    g.etiqueta
                                );
                                archivosParaMapa.push({ ruta: g.rutaFinal, comentario });
                                pc.log.push(
                                    `[OK] ${g.rutaFinal} (${(g.bytes.byteLength / 1024).toFixed(1)} KB)`
                                );
                            }

                            if (errParciales.length) {
                                errores += errParciales.length;
                                pieza(pc, i, 'error', `${u.nombre}: ${r.nombre}`);
                                pieza(u, localIdx, 'error', r.nombre);
                                colorear(r, 'error', errParciales.join(' | '));
                                errParciales.forEach(e =>
                                    pc.log.push(`[ERROR PARCIAL] ${rutaLog}: ${e}`)
                                );
                            } else {
                                pieza(pc, i, 'ok', `${u.nombre}: ${r.nombre}`);
                                pieza(u, localIdx, 'ok', r.nombre);
                                colorear(r, 'ok', 'Archivo añadido al ZIP del curso');
                            }
                        }
                    } catch (e) {
                        if (e.esCancelacion || estado.cancelado) throw e;
                        errores++;
                        pieza(pc, i, 'error', `${u.nombre}: ${r.nombre}`);
                        pieza(u, localIdx, 'error', r.nombre);
                        colorear(r, 'error', e.message);
                        pc.log.push(`[ERROR] ${rutaLog}: ${e.message}`);
                    } finally {
                        if (visor().abierto || enVistaDocumentoPantallaCompleta()) {
                            await cerrarVisor(pc, u, pc);
                        }
                    }
                }

                progreso(
                    pc,
                    i + 1,
                    colaGlobal.length,
                    `Curso · OK: ${ok} · Errores: ${errores} · Omitidos: ${omitidos}`
                );
                progreso(
                    u,
                    localIdx + 1,
                    totalUnidad,
                    'Incluido en el ZIP del curso'
                );

                await dormir(CFG.PAUSA);
            }

            verificarCancelacion();

            archivosParaMapa.push({
                ruta: `${carpetaCurso}/_REPORTE_CURSO.txt`,
                comentario: 'Mapa de estructura de archivos y registro general del curso'
            });

            const mapaAscii = generarMapaArbol(carpetaCurso, archivosParaMapa);

            pc.log = [
                ...cabeceraLog,
                'ESTRUCTURA DE ARCHIVOS DEL CURSO:',
                mapaAscii,
                '',
                'DETALLE DE OPERACIONES:',
                ...pc.log.slice(cabeceraLog.length),
                '',
                `Total Archivos: ${ok} | Errores: ${errores} | Omitidos: ${omitidos}`
            ];

            zip.agregar(`${carpetaCurso}/_REPORTE_CURSO.txt`, pc.log.join('\r\n'));

            pc.pct.textContent = '99%';
            pc.estado.textContent = 'Empaquetando curso completo en .zip...';
            await dormir(20);

            const blob = zip.generarBlob();

            pc.zipBlob = blob;
            pc.zipNombre = `${carpetaCurso}.zip`;

            guardarZip(pc);

            pc.pct.textContent = '100%';
            pc.estado.textContent = `Curso descargado (${(blob.size / 1048576).toFixed(2)} MB) · ${ok} archivos · ${errores} errores · ${omitidos} omitidos`;
            cambiarTextoBoton(pc.boton, 'Guardar curso .zip');
            pc.boton.classList.remove('detener');
            pc.boton.classList.add('listo');
            pc.boton.title = 'Clic: volver a guardar el ZIP del curso al instante. Mayús + clic: volver a escanear todo el curso.';
        } catch (e) {
            if (e.esCancelacion || estado.cancelado) {
                pc.log.push('[CANCELADO] Descarga del curso detenida por el usuario');
                pc.estado.textContent = `Descarga detenida (${ok} archivos procesados antes de detener).`;
                cambiarTextoBoton(pc.boton, 'Descargar todo el curso');
                pc.boton.classList.remove('detener', 'listo');
            } else {
                pc.log.push(`[ERROR GENERAL] ${e.message}`);
                pc.estado.textContent = `Error: ${e.message}`;
                cambiarTextoBoton(pc.boton, 'Descargar todo el curso');
                pc.boton.classList.remove('detener');
                console.error('[Maximus Orden - Curso]', e);
            }
        } finally {
            if (visor().abierto || enVistaDocumentoPantallaCompleta()) {
                await cerrarVisor(pc, null, pc);
            }

            for (const u of estado.unidades.values()) {
                if (u.boton) {
                    u.boton.disabled = false;
                    u.boton.classList.remove('detener');
                }
            }

            restaurarColoresFilas();
            pc.copiar.hidden = false;
            pc.boton.disabled = false;
            pc.boton.classList.remove('detener');
            estado.tareaActiva = null;
            estado.cancelado = false;
            marcarOcupado(false);
            fnAgendar?.();
        }
    }

    // --- Módulo 11: Montaje de paneles y arranque del observador ---

    // Montaje de paneles en cada unidad, botón general del curso, reconexión tras vistas completas y arranque del observador.


    function montar(u) {
        const panel = document.createElement('div');
        panel.className = 'maximus-panel';
        panel.dataset.maximus = 'panel';

        panel.innerHTML = `
            <button class="maximus-boton" type="button">
                <img class="maximus-logo" src="${LOGO_BASE64}" alt="">
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

    function sincronizarBotonCurso() {
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
                <img class="maximus-logo" src="${LOGO_BASE64}" alt="">
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

    function descubrir() {
        if (!compatible()) {
            return;
        }

        if (enVistaDocumentoPantallaCompleta()) {
            limpiarPanelesEnVistaDocumento();
            return;
        }

        restaurarColoresFilas();

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
    }

    async function rehidratarDomCurso(uActiva = null, pcActivo = null) {
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
    }

    function agendar() {
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

    function iniciar() {
        if (!compatible()) return;

        // Si había una instancia previa corriendo tras actualizar desde GitHub, la limpia antes de volver a montar.
        if (window.__maximusObserver) {
            try {
                window.__maximusObserver.disconnect();
            } catch {
                // Ignorar si ya estaba desconectado.
            }
        }

        document.querySelectorAll('.maximus-panel').forEach(p => p.remove());
        estado.unidades.clear();
        estado.panelCurso = null;
        if (document.documentElement) {
            document.documentElement.dataset.maximusIniciado = '1';
        }

        registrarRehidratador(rehidratarDomCurso);
        registrarAgendador(agendar);

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
})();
