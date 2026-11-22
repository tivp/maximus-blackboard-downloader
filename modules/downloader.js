// Cola de descarga por unidad y para el curso entero, armado del reporte final y control de parada.

import { CFG, estado, marcarOcupado, verificarCancelacion } from './config.js';
import {
    dormir,
    canon,
    seguro,
    posicion,
    esUrlExterna,
    obtenerNombreCurso
} from './utils.js';
import {
    crearZipNativo,
    rutaLibre,
    guardarZip,
    generarMapaArbol,
    describirArchivo
} from './zip.js';
import { recuperar } from './http.js';
import { enVistaDocumentoPantallaCompleta } from './interceptor.js';
import { expandirCarpetas, recursos } from './scanner.js';
import { visor, cerrarVisor, capturarClic } from './visor.js';
import {
    cambiarTextoBoton,
    progreso,
    crearPiezas,
    pieza,
    colorear,
    restaurarColoresFilas
} from './ui.js';

let fnAgendar = null;

export function registrarAgendador(fn) {
    fnAgendar = fn;
}

export async function procesarRecursoItem(r, uLog, zip, carpetaBase, uActiva = null, pcActivo = null) {
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
        const descargarCapturados = async capturados => {
            if (capturados.some(c => c?.omitidoInteractivo)) {
                return { omitidoInteractivo: true };
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

            return { omitidoInteractivo: false };
        };

        try {
            const capturados = await capturarClic(r, uLog, uActiva, pcActivo, false);

            if (visor().abierto || visor().esFullDocument || enVistaDocumentoPantallaCompleta()) {
                await cerrarVisor(uLog, uActiva, pcActivo);
            }

            const resCap = await descargarCapturados(capturados);
            if (resCap.omitidoInteractivo) {
                return { omitidoInteractivo: true, guardados: [], errores: [] };
            }

            const soloExternosApi =
                capturados.length > 0 && capturados.every(c => c?.url && esUrlExterna(c.url));

            if (!resultado.archivos.length && capturados.some(c => c?.viaApi) && !soloExternosApi) {
                const motivoApi = [...resultado.errores].filter(Boolean).join(' | ') || 'sin respuesta';
                uLog.log.push(`[NINJA API] Descarga directa falló en "${r.nombre}" (${motivoApi}), reintentando vía visor DOM...`);
                resultado.errores = [];

                const capturadosDom = await capturarClic(r, uLog, uActiva, pcActivo, true);

                if (visor().abierto || visor().esFullDocument || enVistaDocumentoPantallaCompleta()) {
                    await cerrarVisor(uLog, uActiva, pcActivo);
                }

                const resDom = await descargarCapturados(capturadosDom);
                if (resDom.omitidoInteractivo) {
                    return { omitidoInteractivo: true, guardados: [], errores: [] };
                }

                if (!resultado.archivos.length && !resultado.errores.length && motivoApi) {
                    resultado.errores.push(motivoApi);
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

export async function ejecutar(u) {
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

export async function ejecutarTodoElCurso(pc) {
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
