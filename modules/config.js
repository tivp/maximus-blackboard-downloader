// Ajustes base, selectores y estado compartido entre los módulos.

export const CFG = Object.freeze({
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
export const LOGO_BASE64 =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjIyMCAxOTAgNTUyIDU0MiI+PHBvbHlnb24gcG9pbnRzPSIzNzAuNyw1MDYuOSAzNzAuMyw1MDYuNyAzMzEuNSw0NzguNyAzMzEuMyw0NTMuNyAyNzguMyw0MTUuMSAyOTMsNjA3LjIgMzcwLjcsNjczIi8+PHBvbHlnb24gcG9pbnRzPSI1NDYsNDc5IDU0Niw2MDcuNiA0NDYuMSw2MDcuNiA0NDYuMSw0NzguNCAzOTAuNyw1MDcuMSAzOTAuNyw2ODkuOSA0MTUuNiw3MTEgNDQ1LjksNjM4LjkgNTQ1LjMsNjM4LjkgNTc1LjgsNzExIDYwMC44LDY4NyA2MDAuOCw1MDcuNCIvPjxwb2x5Z29uIHBvaW50cz0iNDMxLjUsNzIxLjcgNTU5LjUsNzIxLjcgNTMzLjksNjU3IDQ1Ny41LDY1NyIvPjxwb2x5Z29uIHBvaW50cz0iNjIwLjYsNjczLjcgNjIwLjYsNTA2LjIgNjU5LjksNDc4LjQgNjU5LjksNDU0LjQgNzEyLjUsNDE2LjEgNjk4LjEsNjA3LjIiLz48cG9seWdvbiBwb2ludHM9IjQ2Mi42LDU4OC45IDQ2Mi42LDQ2MC42IDQ0Ny43LDM2NS45IDQ5NS44LDQwMC4zIDU0Mi42LDM2NS45IDUyOS4xLDQ2MS40IDUyOS4xLDU4OC45Ii8+PHBhdGggZD0iTTQyNy45LDM1NC4xbC0xMDEtNjYuM2wtMTEuNS01Mi43bC04My43LTYuM2wzNC42LDE1Nmw4MC40LDU4LjdsOTguMiwxNS41TDQyNy45LDM1NC4xeiBNMjc2LjMsMjgzLjdsMTE3LjgsNzguNWwyLjUsMTYuNmwtMTE2LjItNzcuM0wyNzYuMywyODMuN3ogTTI4OS4xLDM0N2wtNC4xLTE3LjhsMTE3LjgsNzguNWwyLjUsMTYuNkwyODkuMSwzNDd6Ii8+PHBhdGggZD0iTTU0Ni42LDQ1OS4xbDk4LjItMTUuNWw4MC40LTU4LjdsMzQuNi0xNTZsLTgzLjcsNi4zbC0xMS41LDUyLjdsLTEwMSw2Ni4zTDU0Ni42LDQ1OS4xeiBNNzExLDMwMS41bC0xMTYuMiw3Ny4zbDIuNS0xNi42bDExNy44LTc4LjVMNzExLDMwMS41eiBNNTg2LjEsNDI0LjJsMi41LTE2LjZsMTE3LjgtNzguNWwtNC4xLDE3LjhMNTg2LjEsNDI0LjJ6Ii8+PHBhdGggZD0iTTQ5NS4yLDIwMS4zYy05NiwwLTE1OS4xLDMzLjQtMTU5LjEsMzMuNGw4LjYsNDMuM2wxNTAuNSw5OS40bDE1MS4zLTk5LjFsOC42LTQyLjhDNjU1LjEsMjM1LjQsNTkxLjIsMjAxLjMsNDk1LjIsMjAxLjN6IE00OTYsMzE3LjFsLTg2LjktNTcuOWgxNzIuN0w0OTYsMzE3LjF6Ii8+PC9zdmc+';

// Filtros para distinguir unidades, carpetas, archivos y material que no se descarga (foros, encuestas, SCORM).
export const RE = {
    unidad: /^(?:(?:unidad|semana|m[oó]dulo)\s*(?:\d+|[ivxlcdm]+)(?:\s*(?:[|:\-–—]|\s+)\s*\S.*)?|informaci[oó]n\s+general|evaluaci[oó]n\s+final|examen\s+final)$/i,
    moduloFinal: /^(?:evaluaci[oó]n\s+final|examen(?:\s+final)?)$/i,
    itemExamen: /\b(?:examen(?:\s+final)?|[usm]\d+\s*[|:]\s*examen)\b/i,
    archivo: /\.(?:pdf|docx?|xlsx?|pptx?|odt|ods|odp|txt|rtf|csv|tsv|json|xml|html?|url|zip|rar|7z|gz|tar|mp3|m4a|wav|ogg|flac|aac|mp4|mov|webm|avi|mkv|png|jpe?g|gif|webp|svg|epub|sql|py|ipynb)(?:$|[?#])/i,
    descarga: /bbcswebdav|xythos|\/attachments?\/|\/download(?:[/?#]|$)|filedownload|xid-\d+|[?&](?:download|filename|attachment|isForcedDownload|file)=/i,
    interactivo: /\b(?:material(?:es)?|contenido|recurso(?:s)?)\s+interactiv[oa]s?\b|\b(?:scorm|h5p|unity|webgl)\b/i,
    excluir: /^(?:(?:[usm]\d+\s*[|:]\s*)?(?:foro(?:\s+de\s+discusi[oó]n)?|evaluaci[oó]n(?:\s+diagn[oó]stica)?|examen|sondeo.*|encuesta.*)|foro de discusi[oó]n|consultas sobre la asignatura|asistente virtual|sondeo de conocimientos.*)$/i,
    carpeta: /^(?:(?:[usm]\d+\s*[|:]\s*)?(?:material de estudio|material en otros formatos|actividades|evaluaci[oó]n(?: de la (?:unidad|semana))?.*|recursos(?:\s+de\s+aprendizaje.*)?|material complementario))$/i,
    carpetaEvaluacion: /^(?:(?:[usm]\d+\s*[|:\-–—]\s*)?(?:evaluaci[oó]n(?:es)?(?:\s+(?:de\s+la\s+(?:unidad|semana)|sumativa|formativa|diagn[oó]stica|parcial|final|semanal|n?°?\s*\d+|[ivx]+))?|ex[aá]men(?:es)?(?:\s+final)?|pruebas?(?:\s+y\s+evaluaciones)?))$/i,
    itemEvaluacionTitulo: /^(?:[usm]\d+\s*[|:\-–—]\s*)?(?:evaluaci[oó]n(?:\s+(?:diagn[oó]stica|formativa|sumativa|parcial|final|semanal|de\s+la\s+(?:unidad|semana)|n?°?\s*\d+|[ivx]+))?|prueba(?:\s+(?:n?°?\s*)?\d+|\s+[ivx]+)?|examen(?:\s+final)?|certamen(?:\s+\d+)?|solemne(?:\s+\d+)?|cuestionario(?:\s+(?:evaluado|\d+))?|control(?:\s+\d+)?)\b/i,
    encuestaOSondeo: /\b(?:encuesta|sondeo)\b/i
};

export const TARJETAS = '.content-list-item[data-content-id],.element-card.outline-item';

// Estado global de ejecución. Se guarda en un único objeto para que los módulos lean y escriban sin referencias sueltas.
export const estado = {
    unidades: new Map(),
    estadoFilas: new Map(),
    panelCurso: null,
    ocupado: false,
    cancelado: false,
    tareaActiva: null,
    pendiente: false,
    ultimaUrlIframeInterceptada: '',
    ultimoInteractivoDetectado: false,
    abortadoresActivos: new Set(),
    evaluacionesCursoId: '',
    evaluacionesEnCurso: false,
    evaluacionesReintentar: false,
    evaluacionesColapsadasUsuario: new Set(),
    evaluacionesModulosSinEval: new Set(),
    evaluacionesCarpetasConEval: new Set(),
    evaluacionesCacheApi: new Map(),
    evaluacionesBotonesAutoAbiertos: new WeakSet()
};

// Sincroniza el atributo en <html> para que page-hook.js sepa cuándo hay una descarga en curso.
export function marcarOcupado(valor) {
    estado.ocupado = Boolean(valor);
    if (document.documentElement) {
        if (estado.ocupado) {
            document.documentElement.dataset.maximusOcupado = '1';
        } else {
            delete document.documentElement.dataset.maximusOcupado;
        }
    }
}

export function cancelarDescargaActiva() {
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

export function verificarCancelacion() {
    if (estado.cancelado) {
        const err = new Error('Descarga detenida por el usuario');
        err.esCancelacion = true;
        throw err;
    }
}
