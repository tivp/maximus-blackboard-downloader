// Consulta directa a los endpoints REST de Blackboard (/learn/api/...) para sacar adjuntos sin abrir paneles en la interfaz.

import { RE, estado } from './config.js';
import { texto, canon, limpiarPrefijoXid, esUrlScormOInteractivo, urlReal, ejecutarPool } from './utils.js';

const RE_COLUMNA_TOTAL =
    /^(?:total|weighted\s+total|nota\s+final|promedio(?:\s+final)?|calificaci[oó]n\s+(?:total|final)|overall\s+grade)$/i;

async function fetchJsonApi(endpoint, timeoutMs = 8000) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
        const r = await fetch(endpoint, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            ...(ctrl ? { signal: ctrl.signal } : {})
        });
        if (!r?.ok) return null;
        return await r.json();
    } catch {
        return null;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

export function esColumnaEvaluacionValidaApi(col) {
    if (!col) return false;
    if (col.visible === false || col.availability?.available === 'No') return false;
    if (col.externalGrade === true) return false;
    if (col.calculationType && col.calculationType !== 'NON_CALCULATED') return false;
    if (col.formula) return false;
    const titulo = texto(col.effectiveColumnName || col.columnName || col.name || '');
    if (!titulo || RE.encuestaOSondeo.test(titulo)) return false;
    if (!col.contentId && RE_COLUMNA_TOTAL.test(titulo)) return false;
    return true;
}

export function esIntentoBorradorApi(att) {
    const st = String(att?.status || '').trim();
    return /^in_?progress$/i.test(st);
}

export function extraerIdsIntentoApi(grade) {
    if (!grade) return [];
    return [
        ...new Set(
            [
                grade.lastAttemptId,
                grade.firstAttemptId,
                grade.highestAttemptId,
                grade.lastAttempt?.id
            ].filter(id => typeof id === 'string' && id.trim())
        )
    ];
}

export function formatearNotaApi(col, grade) {
    if (col?.gradesReleased === false) return '';
    const dg = grade?.displayGrade;
    const rawScore =
        typeof grade?.effectiveScore === 'number' && Number.isFinite(grade.effectiveScore)
            ? grade.effectiveScore
            : typeof grade?.score === 'number' && Number.isFinite(grade.score)
              ? grade.score
              : typeof dg?.score === 'number' && Number.isFinite(dg.score)
                ? dg.score
                : null;
    const possible =
        typeof col?.score?.possible === 'number' && col.score.possible > 0
            ? col.score.possible
            : typeof col?.possible === 'number' && col.possible > 0
              ? col.possible
              : typeof dg?.possible === 'number' && dg.possible > 0
                ? dg.possible
                : null;
    const rawText = typeof dg?.grade === 'string' ? texto(dg.grade) : '';
    const textGrade = rawText && rawText !== '-' ? rawText : '';
    const fmtNum = n => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1))));

    if (rawScore !== null) {
        if (possible && rawScore <= possible) return `${fmtNum(rawScore)}/${fmtNum(possible)}`;
        return textGrade || fmtNum(rawScore);
    }
    return textGrade;
}

export function clasificarEvaluacionApi({
    col = null,
    grade = null,
    attempts = null,
    todoBucket = '',
    domEstado = null,
    now = Date.now()
} = {}) {
    const dueIso = col?.grading?.due || col?.dueDate || grade?.column?.dueDate || grade?.dueDate || null;
    const dueMs = dueIso && Number.isFinite(Date.parse(dueIso)) ? Date.parse(dueIso) : null;
    const attemptsLeft =
        typeof grade?.attemptsLeft === 'number' && Number.isFinite(grade.attemptsLeft)
            ? grade.attemptsLeft
            : null;
    const res = (completada, estadoLabel, estadoTipo, nota = '') => ({
        completada,
        estadoLabel,
        estadoTipo,
        dueMs,
        nota,
        attemptsLeft
    });

    if (grade?.isExempt || grade?.exempt) {
        return res(true, 'Eximida', 'completada');
    }

    const listaIntentos = Array.isArray(attempts)
        ? attempts
        : grade?.lastAttempt?.status
          ? [grade.lastAttempt]
          : [];
    const drafts = listaIntentos.filter(esIntentoBorradorApi);
    const handedIn = listaIntentos.filter(a => a?.status && !esIntentoBorradorApi(a));
    const intentosVerificados = Array.isArray(attempts);

    const nota = formatearNotaApi(col, grade);
    const soloBorradorSinEnvio = intentosVerificados && drafts.length > 0 && handedIn.length === 0;
    const sinIntentosVerificados = intentosVerificados && listaIntentos.length === 0;

    if (nota && !soloBorradorSinEnvio) {
        return res(true, `Calificada · ${nota}`, 'completada', nota);
    }
    if (!nota && col?.gradesReleased !== false && grade?.status === 'Graded' && handedIn.length > 0) {
        return res(true, 'Calificada', 'completada');
    }

    if (handedIn.length > 0) {
        return res(true, 'Entregada', 'entregada');
    }
    if (!intentosVerificados && !drafts.length) {
        const st = String(grade?.status || grade?.submissionStatus || '');
        if (/^(?:needs_?grading|submitted|completed)$/i.test(st)) {
            return res(true, 'Entregada', 'entregada');
        }
    }

    if (drafts.length > 0 || /^draft_saved/i.test(String(grade?.submissionStatus || ''))) {
        const vencida = todoBucket === 'overdue' || (Number.isFinite(dueMs) && dueMs < now);
        return res(
            false,
            vencida ? 'Vencida (borrador)' : 'Borrador',
            vencida ? 'vencida' : 'iniciada'
        );
    }

    if (domEstado?.completada && !sinIntentosVerificados) {
        return res(true, 'Completada', 'completada');
    }

    if (domEstado?.estadoTipo === 'bloqueada') {
        return res(false, 'Bloqueada', 'bloqueada');
    }
    if (todoBucket === 'overdue' || (Number.isFinite(dueMs) && dueMs < now)) {
        return res(false, 'Vencida', 'vencida');
    }
    if (todoBucket === 'dueToday' || (Number.isFinite(dueMs) && dueMs - now <= 24 * 3600e3)) {
        return res(false, 'Vence hoy', 'hoy');
    }
    if (Number.isFinite(dueMs) && dueMs - now <= 72 * 3600e3) {
        return res(false, 'Próxima', 'proxima');
    }
    if (domEstado?.estadoTipo === 'iniciada') {
        return res(false, 'Iniciado', 'iniciada');
    }
    return res(false, 'Sin iniciar', 'sin-iniciar');
}

export async function obtenerUsuarioActualApi() {
    if (estado.usuarioActualId) return estado.usuarioActualId;

    const ctxId =
        typeof window !== 'undefined' && typeof window.__initialContext?.user?.id === 'string'
            ? window.__initialContext.user.id.trim()
            : '';
    if (ctxId) {
        estado.usuarioActualId = ctxId;
        return ctxId;
    }

    for (const endpoint of ['/learn/api/public/v1/users/me', '/learn/api/v1/users/me']) {
        const data = await fetchJsonApi(endpoint);
        if (typeof data?.id === 'string' && data.id.trim()) {
            estado.usuarioActualId = data.id.trim();
            return estado.usuarioActualId;
        }
    }
    return '';
}

export async function sincronizarEvaluacionesCursoApi(courseId, forzar = false) {
    if (!courseId) return null;

    const cache = estado.evaluacionesApiPorCurso;
    if (!forzar && cache && cache.courseId === courseId && Date.now() - cache.consultadoEn < 60000) {
        return cache;
    }

    const uid = await obtenerUsuarioActualApi();
    const ahora = new Date();
    const hasta = new Date(ahora.getTime() + 60 * 864e5);

    const obtenerColumnas = async () => {
        const rutas = [
            `/learn/api/v1/courses/${courseId}/gradebook/columns?includeInvisible=false&limit=200`,
            `/learn/api/public/v2/courses/${courseId}/gradebook/columns?limit=200`,
            `/learn/api/public/v1/courses/${courseId}/gradebook/columns?limit=200`
        ];
        for (const ruta of rutas) {
            const data = await fetchJsonApi(ruta);
            if (Array.isArray(data?.results)) return data.results;
        }
        return null;
    };

    const [columnasRaw, gradesData, todoData] = await Promise.all([
        obtenerColumnas(),
        uid
            ? fetchJsonApi(
                  `/learn/api/v1/courses/${courseId}/gradebook/grades?limit=200&userId=${encodeURIComponent(uid)}&expand=lastAttempt,attemptsLeft,submissionStatus,hasAttemptOrGradeFeedback,column`
              )
            : Promise.resolve(null),
        fetchJsonApi(
            `/learn/api/v1/calendars/todo/studentItems?since=${encodeURIComponent(ahora.toISOString())}&until=${encodeURIComponent(hasta.toISOString())}`
        )
    ]);

    const todoPorColId = new Map();
    const todoPorContentId = new Map();
    const todosCurso = [];
    const bucketsTodo = [
        ['overdueItems', 'overdue'],
        ['dueTodayItems', 'dueToday'],
        ['futureDueItems', 'upcoming']
    ];

    if (todoData && typeof todoData === 'object') {
        for (const [prop, bucket] of bucketsTodo) {
            for (const item of Array.isArray(todoData[prop]) ? todoData[prop] : []) {
                const cId = item?.column?.courseId || item?.courseId || '';
                if (cId !== courseId) continue;
                const colId = typeof item?.column?.id === 'string' ? item.column.id : '';
                const contentId = typeof item?.column?.contentId === 'string' ? item.column.contentId : '';
                const titulo = texto(
                    item?.title || item?.column?.effectiveColumnName || item?.column?.columnName || ''
                );
                if (!titulo || RE.encuestaOSondeo.test(titulo)) continue;
                const info = {
                    bucket,
                    dueDate: item?.dueDate || item?.column?.dueDate || null,
                    title: titulo,
                    contentId,
                    columnId: colId
                };
                todosCurso.push(info);
                if (colId && !todoPorColId.has(colId)) todoPorColId.set(colId, info);
                if (contentId && !todoPorContentId.has(contentId)) todoPorContentId.set(contentId, info);
            }
        }
    }

    const gradesIniciales = Array.isArray(gradesData?.results) ? gradesData.results : null;

    if (!columnasRaw && !gradesIniciales && !todosCurso.length) {
        const vacio = {
            courseId,
            consultadoEn: Date.now(),
            disponible: false,
            porContentId: new Map(),
            porTitulo: new Map(),
            lista: []
        };
        estado.evaluacionesApiPorCurso = vacio;
        return vacio;
    }

    const columnasValidas = [];
    const colIdsVistos = new Set();
    const contentIdsVistos = new Set();

    const registrarColumna = col => {
        if (!esColumnaEvaluacionValidaApi(col)) return;
        const colId = col.id || '';
        if (colId && colIdsVistos.has(colId)) return;
        if (colId) colIdsVistos.add(colId);
        if (col.contentId) contentIdsVistos.add(col.contentId);
        columnasValidas.push(col);
    };

    for (const col of columnasRaw || []) {
        registrarColumna(col);
    }

    for (const g of gradesIniciales || []) {
        if (g?.column) registrarColumna(g.column);
    }

    for (const t of todosCurso) {
        if (t.columnId && colIdsVistos.has(t.columnId)) continue;
        if (t.contentId && contentIdsVistos.has(t.contentId)) continue;
        registrarColumna({
            id: t.columnId || `todo:${t.contentId || canon(t.title)}`,
            contentId: t.contentId || '',
            columnName: t.title,
            dueDate: t.dueDate
        });
    }

    let listaGrades = gradesIniciales;
    if (uid && columnasValidas.length && (!listaGrades || !listaGrades.length)) {
        const extraidas = await ejecutarPool(
            columnasValidas.filter(c => c.id && !String(c.id).startsWith('todo:')),
            Math.min(4, columnasValidas.length),
            async col => {
                const rutas = [
                    `/learn/api/public/v2/courses/${courseId}/gradebook/columns/${col.id}/users/${encodeURIComponent(uid)}`,
                    `/learn/api/public/v1/courses/${courseId}/gradebook/columns/${col.id}/users/${encodeURIComponent(uid)}`
                ];
                for (const ruta of rutas) {
                    const data = await fetchJsonApi(ruta);
                    const gObj = Array.isArray(data?.results) ? data.results[0] : data;
                    if (gObj && typeof gObj === 'object' && (gObj.userId || gObj.columnId || gObj.status || gObj.displayGrade)) {
                        return { ...gObj, columnId: gObj.columnId || col.id };
                    }
                }
                return null;
            }
        );
        const validas = extraidas.filter(Boolean);
        if (validas.length) listaGrades = validas;
    }

    const porColumnaId = new Map();
    for (const g of listaGrades || []) {
        const colId = g?.columnId || g?.column?.id || '';
        if (colId && !porColumnaId.has(colId)) {
            porColumnaId.set(colId, g);
        }
    }

    const registrosBase = columnasValidas.map(col => {
        const colId = col.id || '';
        const contentId = col.contentId || '';
        const grade = porColumnaId.get(colId) || null;
        const todo =
            (colId && todoPorColId.get(colId)) ||
            (contentId && todoPorContentId.get(contentId)) ||
            null;
        return {
            col,
            colId,
            contentId,
            grade,
            todoBucket: todo?.bucket || '',
            todo
        };
    });

    const porVerificar = registrosBase.filter(reg => {
        const { col, colId, grade, todoBucket } = reg;
        if (!colId || String(colId).startsWith('todo:')) return false;
        const ids = extraerIdsIntentoApi(grade);
        const subSt = String(grade?.submissionStatus || '');
        const st = String(grade?.status || '');
        return Boolean(
            ids.length > 1 ||
            (ids.length === 1 && !grade?.lastAttempt?.status) ||
            /^draft_saved|in_?progress$/i.test(subSt) ||
            /^needs_?grading$/i.test(st) ||
            (st === 'Graded' && !formatearNotaApi(col, grade)) ||
            ((todoBucket === 'overdue' || todoBucket === 'dueToday') && (ids.length > 0 || Boolean(grade)))
        );
    });

    const intentosPorCol = new Map();
    if (porVerificar.length) {
        const resultadosInt = await ejecutarPool(
            porVerificar,
            Math.min(4, porVerificar.length),
            async reg => {
                const { colId, grade } = reg;
                const ids = extraerIdsIntentoApi(grade);
                let intentos = null;

                if (ids.length) {
                    const lecturas = await Promise.all(
                        ids.map(attId =>
                            fetchJsonApi(`/learn/api/v1/courses/${courseId}/gradebook/attempts/${attId}`)
                        )
                    );
                    const validos = lecturas.filter(a => a && typeof a === 'object');
                    if (validos.length) intentos = validos;
                }

                if (!intentos && uid) {
                    for (const ver of ['v2', 'v1']) {
                        const data = await fetchJsonApi(
                            `/learn/api/public/${ver}/courses/${courseId}/gradebook/columns/${colId}/attempts?userId=${encodeURIComponent(uid)}`
                        );
                        if (Array.isArray(data?.results)) {
                            intentos = data.results;
                            break;
                        }
                    }
                }

                return { colId, intentos };
            }
        );

        for (const r of resultadosInt) {
            if (r?.colId) intentosPorCol.set(r.colId, r.intentos ?? null);
        }
    }

    const porContentId = new Map();
    const porTitulo = new Map();
    const lista = [];

    for (const reg of registrosBase) {
        const { col, colId, contentId, grade, todoBucket, todo } = reg;
        const colMerged = !col.grading?.due && !col.dueDate && todo?.dueDate
            ? { ...col, dueDate: todo.dueDate }
            : col;
        const attempts = intentosPorCol.has(colId) ? intentosPorCol.get(colId) : null;
        const titulo = texto(
            colMerged.effectiveColumnName || colMerged.columnName || colMerged.name || todo?.title || ''
        );
        if (!titulo) continue;

        const clasificacion = clasificarEvaluacionApi({
            col: colMerged,
            grade,
            attempts,
            todoBucket
        });

        const entrada = {
            columnId: colId,
            contentId,
            titulo,
            col: colMerged,
            grade,
            attempts,
            todoBucket,
            dueMs: clasificacion.dueMs,
            clasificacion
        };

        lista.push(entrada);
        if (contentId && !porContentId.has(contentId)) {
            porContentId.set(contentId, entrada);
        }
        const claveTitulo = canon(titulo);
        if (claveTitulo && !porTitulo.has(claveTitulo)) {
            porTitulo.set(claveTitulo, entrada);
        }
    }

    const resultado = {
        courseId,
        consultadoEn: Date.now(),
        disponible: true,
        porContentId,
        porTitulo,
        lista
    };
    estado.evaluacionesApiPorCurso = resultado;
    return resultado;
}

function esItemEvaluacionApi(item) {
    if (!item) return false;
    const titulo = texto(item.title || '');
    const handler = String(
        item.contentHandler?.id ||
        Object.keys(item.contentDetail || {})[0] ||
        ''
    );

    if (/asmt|assessment|assignment|test-link|quiz|exam|turnitin/i.test(handler)) {
        return true;
    }

    if (
        item.gradebookColumnId ||
        item.hasGradebookColumns ||
        item.assessmentId ||
        item.isGradable ||
        item.contentHandler?.gradeColumnId ||
        item.contentDetail?.['resource/x-bb-asmt-test-link'] ||
        item.contentDetail?.['resource/x-bb-assignment']
    ) {
        return true;
    }

    return Boolean(titulo && RE.itemEvaluacionTitulo.test(titulo) && !RE.encuestaOSondeo.test(titulo));
}

export async function consultarHijosContenidoApi(courseId, contentId) {
    if (!courseId || !contentId) return null;

    const cacheKey = `${courseId}:${contentId}`;
    if (estado.evaluacionesCacheApi.has(cacheKey)) {
        return estado.evaluacionesCacheApi.get(cacheKey);
    }

    const endpoints = [
        `/learn/api/v1/courses/${courseId}/contents/${contentId}/children?limit=100`,
        `/learn/api/public/v1/courses/${courseId}/contents/${contentId}/children?limit=100`
    ];

    for (const endpoint of endpoints) {
        const controlador = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controlador ? setTimeout(() => controlador.abort(), 8000) : null;
        try {
            const r = await fetch(endpoint, {
                credentials: 'include',
                headers: { Accept: 'application/json' },
                ...(controlador ? { signal: controlador.signal } : {})
            });
            if (!r.ok) continue;
            const data = await r.json();
            if (Array.isArray(data?.results)) {
                estado.evaluacionesCacheApi.set(cacheKey, data.results);
                return data.results;
            }
        } catch {
            // Probar el siguiente endpoint disponible.
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    estado.evaluacionesCacheApi.set(cacheKey, null);
    return null;
}

export async function inspeccionarEvaluacionesEnContenedorApi(courseId, contentId, profundidad = 0) {
    if (!courseId || !contentId) {
        return { resultado: 'desconocido', carpetasEvaluacionIds: [] };
    }

    const hijos = await consultarHijosContenidoApi(courseId, contentId);
    if (!hijos) {
        return { resultado: 'desconocido', carpetasEvaluacionIds: [] };
    }

    let encontrado = false;
    const carpetasEvaluacionIds = [];
    const subcarpetasPorRevisar = [];

    for (const item of hijos) {
        if (item?.availability?.available === 'No') continue;

        const titulo = texto(item?.title || '');
        const handler = String(
            item?.contentHandler?.id ||
            Object.keys(item?.contentDetail || {})[0] ||
            ''
        );
        const esContenedor =
            /folder|learning-module/i.test(handler) ||
            Boolean(item?.hasChildren || item?.isFolder);

        if (esContenedor) {
            if (RE.carpetaEvaluacion.test(titulo) || RE.moduloFinal.test(titulo)) {
                encontrado = true;
                if (item.id) carpetasEvaluacionIds.push(item.id);
            } else if (profundidad < 1 && item?.id) {
                subcarpetasPorRevisar.push(item.id);
            }
        } else if (esItemEvaluacionApi(item)) {
            encontrado = true;
        }
    }

    if (profundidad < 1 && subcarpetasPorRevisar.length) {
        const subResultados = await Promise.all(
            subcarpetasPorRevisar.map(subId =>
                inspeccionarEvaluacionesEnContenedorApi(courseId, subId, profundidad + 1).then(res => ({
                    subId,
                    res
                }))
            )
        );

        for (const { subId, res } of subResultados) {
            if (res.resultado === 'si') {
                encontrado = true;
                carpetasEvaluacionIds.push(subId, ...res.carpetasEvaluacionIds);
            }
        }
    }

    return {
        resultado: encontrado ? 'si' : 'no',
        carpetasEvaluacionIds
    };
}

export async function extraerDocumentoViaApiBlackboard(courseId, docId, nombreItem = 'Documento') {
    if (!courseId || !docId) return null;

    const fetchJson = async endpoint => {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
        try {
            const r = await fetch(endpoint, {
                credentials: 'include',
                headers: { Accept: 'application/json' },
                ...(ctrl ? { signal: ctrl.signal } : {})
            });
            if (!r.ok) return null;
            return await r.json();
        } catch {
            return null;
        } finally {
            if (timer) clearTimeout(timer);
        }
    };

    try {
        const bloques = [];
        const urlsVistas = new Set();
        const textosAcumulados = [];
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

        const procesarNodoRaiz = nodo => {
            if (!nodo) return;
            extraerDeItemApi(nodo);
            const cuerpoNodo =
                nodo?.body?.rawText ||
                nodo?.contentDetail?.['resource/x-bb-document']?.body?.rawText ||
                '';
            if (typeof cuerpoNodo === 'string' && cuerpoNodo) {
                const txt = procesarHtmlCuerpo(cuerpoNodo, nombreItem);
                if (txt && txt.length > 10 && !textosAcumulados.includes(txt)) {
                    textosAcumulados.push(txt);
                }
            }
        };

        const procesarListaHijos = async listaHijos => {
            if (!Array.isArray(listaHijos) || !listaHijos.length) return;

            const hijosConAdjuntos = [];
            for (const hijo of listaHijos) {
                const tituloHijo = texto(hijo.title || '');
                const handler = String(hijo.contentHandler?.id || '');

                extraerDeItemApi(hijo);

                if (hijo.id && /file|document/i.test(handler) && !/externallink|folder|asmt/i.test(handler)) {
                    hijosConAdjuntos.push({ hijo, tituloHijo });
                }

                const cuerpoHtml =
                    hijo.body?.rawText ||
                    (typeof hijo.body === 'string' ? hijo.body : '') ||
                    hijo.contentDetail?.['resource/x-bb-document']?.body?.rawText ||
                    '';

                if (typeof cuerpoHtml === 'string' && cuerpoHtml) {
                    const txt = procesarHtmlCuerpo(cuerpoHtml, tituloHijo);
                    if (txt && txt.length > 10 && !textosAcumulados.includes(txt)) {
                        textosAcumulados.push(txt);
                    }
                }
            }

            if (hijosConAdjuntos.length) {
                const respuestas = await ejecutarPool(hijosConAdjuntos, Math.min(4, hijosConAdjuntos.length), item =>
                    fetchJson(`/learn/api/public/v1/courses/${courseId}/contents/${item.hijo.id}/attachments`).then(
                        subAtt => ({ item, subAtt })
                    )
                );
                for (const entrada of respuestas) {
                    if (!entrada?.subAtt?.results?.length) continue;
                    for (const att of entrada.subAtt.results) {
                        const dlUrl = `/learn/api/public/v1/courses/${courseId}/contents/${entrada.item.hijo.id}/attachments/${att.id}/download`;
                        agregarUrlDetectada(dlUrl, entrada.item.tituloHijo || att.fileName, att.fileName);
                    }
                }
            }
        };

        // Fase 1 rápida: 3 consultas en paralelo en lugar de 5; solo caemos a /public/ si v1 no trajo contenido.
        const [nodoInterno, datosInternos, adjuntosPublicos] = await Promise.all([
            fetchJson(`/learn/api/v1/courses/${courseId}/contents/${docId}`),
            fetchJson(`/learn/api/v1/courses/${courseId}/contents/${docId}/children`),
            fetchJson(`/learn/api/public/v1/courses/${courseId}/contents/${docId}/attachments`)
        ]);

        procesarNodoRaiz(nodoInterno);
        if (esScormInteractivo) {
            return [{ omitidoInteractivo: true }];
        }

        if (adjuntosPublicos?.results?.length) {
            for (const att of adjuntosPublicos.results) {
                const dlUrl = `/learn/api/public/v1/courses/${courseId}/contents/${docId}/attachments/${att.id}/download`;
                agregarUrlDetectada(dlUrl, att.fileName, att.fileName);
            }
        }

        await procesarListaHijos(datosInternos?.results);
        if (esScormInteractivo) {
            return [{ omitidoInteractivo: true }];
        }

        // Fase 2 de respaldo por roles que exponen solo /learn/api/public/v1/.
        if (!bloques.length && !textosAcumulados.length) {
            const [nodoPublico, datosPublicos] = await Promise.all([
                fetchJson(`/learn/api/public/v1/courses/${courseId}/contents/${docId}`),
                datosInternos?.results?.length
                    ? null
                    : fetchJson(`/learn/api/public/v1/courses/${courseId}/contents/${docId}/children`)
            ]);

            procesarNodoRaiz(nodoPublico);
            if (esScormInteractivo) {
                return [{ omitidoInteractivo: true }];
            }
            await procesarListaHijos(datosPublicos?.results);
            if (esScormInteractivo) {
                return [{ omitidoInteractivo: true }];
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
