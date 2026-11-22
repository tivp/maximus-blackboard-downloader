// Consulta directa a los endpoints REST de Blackboard (/learn/api/...) para sacar adjuntos sin abrir paneles en la interfaz.

import { RE, estado } from './config.js';
import { texto, limpiarPrefijoXid, esUrlScormOInteractivo, urlReal } from './utils.js';

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
        try {
            const r = await fetch(endpoint, {
                credentials: 'include',
                headers: { Accept: 'application/json' }
            });
            if (!r.ok) continue;
            const data = await r.json();
            if (Array.isArray(data?.results)) {
                estado.evaluacionesCacheApi.set(cacheKey, data.results);
                return data.results;
            }
        } catch {
            // Probar el siguiente endpoint disponible.
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
            let extUrl =
                itemObj.contentHandler?.url ||
                itemObj.contentHandler?.launchUrl ||
                itemObj.url ||
                itemObj.launchUrl ||
                itemObj.contentDetail?.['resource/x-bb-externallink']?.url ||
                itemObj.links?.find(l => l.rel === 'alternate' && /^https?:/i.test(l.href || ''))?.href ||
                '';

            if (!extUrl && itemObj.contentDetail && typeof itemObj.contentDetail === 'object') {
                for (const detalle of Object.values(itemObj.contentDetail)) {
                    if (detalle && typeof detalle === 'object') {
                        const cand = detalle.url || detalle.launchUrl;
                        if (cand && /^https?:/i.test(String(cand))) {
                            extUrl = cand;
                            break;
                        }
                    }
                }
            }

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

            if (Array.isArray(itemObj.attachments)) {
                for (const att of itemObj.attachments) {
                    const attUrl =
                        att.permanentUrl ||
                        att.viewUrl ||
                        att.downloadUrl ||
                        (att.xid ? `/bbcswebdav/xid-${String(att.xid).replace(/^xid-/i, '')}` : '');
                    if (attUrl) {
                        agregarUrlDetectada(attUrl, att.fileName || titulo, att.fileName || '');
                    }
                }
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
        const [nodoInterno, nodoPublico, datosInternos, datosPublicos, adjuntosInternos, adjuntosPublicos] = await Promise.all([
            fetchJson(`/learn/api/v1/courses/${courseId}/contents/${docId}`),
            fetchJson(`/learn/api/public/v1/courses/${courseId}/contents/${docId}`),
            fetchJson(`/learn/api/v1/courses/${courseId}/contents/${docId}/children`),
            fetchJson(`/learn/api/public/v1/courses/${courseId}/contents/${docId}/children`),
            fetchJson(`/learn/api/v1/courses/${courseId}/contents/${docId}/attachments`),
            fetchJson(`/learn/api/public/v1/courses/${courseId}/contents/${docId}/attachments`)
        ]);

        const textosAcumulados = [];

        extraerDeItemApi(nodoInterno);
        extraerDeItemApi(nodoPublico);

        for (const nodo of [nodoInterno, nodoPublico]) {
            const cuerpoNodo =
                nodo?.body?.rawText ||
                (typeof nodo?.body === 'string' ? nodo.body : '') ||
                nodo?.contentDetail?.['resource/x-bb-document']?.body?.rawText ||
                '';
            if (typeof cuerpoNodo === 'string' && cuerpoNodo) {
                const txt = procesarHtmlCuerpo(cuerpoNodo, nombreItem);
                if (txt && txt.length > 10 && !textosAcumulados.includes(txt)) {
                    textosAcumulados.push(txt);
                }
            }
        }

        if (esScormInteractivo) {
            return [{ omitidoInteractivo: true }];
        }

        const procesarAdjuntos = (listaInt, listaPub, contentIdObj) => {
            const porId = new Map();
            const sinId = [];
            for (const att of [...(listaPub || []), ...(listaInt || [])]) {
                if (!att) continue;
                if (att.id) {
                    const prev = porId.get(att.id) || {};
                    porId.set(att.id, {
                        ...prev,
                        ...att,
                        permanentUrl: att.permanentUrl || prev.permanentUrl,
                        viewUrl: att.viewUrl || prev.viewUrl,
                        downloadUrl: att.downloadUrl || prev.downloadUrl,
                        xid: att.xid || prev.xid,
                        fileName: att.fileName || prev.fileName
                    });
                } else {
                    sinId.push(att);
                }
            }
            return [...porId.values(), ...sinId].map(att => ({
                att,
                dlUrl:
                    att.permanentUrl ||
                    att.viewUrl ||
                    att.downloadUrl ||
                    (att.xid ? `/bbcswebdav/xid-${String(att.xid).replace(/^xid-/i, '')}` : '') ||
                    (att.id ? `/learn/api/public/v1/courses/${courseId}/contents/${contentIdObj}/attachments/${att.id}/download` : '')
            }));
        };

        for (const { att, dlUrl } of procesarAdjuntos(adjuntosInternos?.results, adjuntosPublicos?.results, docId)) {
            if (dlUrl) {
                agregarUrlDetectada(dlUrl, att.fileName, att.fileName);
            }
        }

        const listaHijos =
            datosInternos?.results ||
            datosPublicos?.results ||
            [];

        for (const hijo of listaHijos) {
            const tituloHijo = texto(hijo.title || '');
            const handler = hijo.contentHandler?.id || '';

            extraerDeItemApi(hijo);

            if (hijo.id && /file|document|externallink/i.test(handler)) {
                const subAttPub = await fetchJson(
                    `/learn/api/public/v1/courses/${courseId}/contents/${hijo.id}/attachments`
                );
                const subAttInt = !subAttPub?.results?.length
                    ? await fetchJson(`/learn/api/v1/courses/${courseId}/contents/${hijo.id}/attachments`)
                    : null;
                for (const { att, dlUrl } of procesarAdjuntos(subAttInt?.results, subAttPub?.results, hijo.id)) {
                    if (dlUrl) {
                        agregarUrlDetectada(dlUrl, tituloHijo || att.fileName, att.fileName);
                    }
                }
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
