// Cola de descarga por unidad y para el curso entero, armado del reporte final y control de parada.

import { CFG, estado, marcarOcupado, verificarCancelacion } from './config.js';
import {
    dormir,
    canon,
    seguro,
    posicion,
    esUrlExterna,
    esRutaSpaBlackboard,
    obtenerNombreCurso,
    ejecutarPool
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

export async function procesarRecursoItem(
    r,
    uLog,
    zip,
    carpetaBase,
    uActiva = null,
    pcActivo = null,
    opts = {}
) {
    verificarCancelacion();

    const ruta = r.ruta.join(' / ');
    const agregarLog = linea => {
        if (opts.logs) opts.logs.push(linea);
        else uLog?.log?.push(linea);
    };
    const receptorLogVisor = { log: { push: linea => agregarLog(linea) } };

    let resultado = { archivos: [], errores: [] };
    let fallo = '';

    if (r.url && !r.esDocUltra && !esRutaSpaBlackboard(r.url)) {
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
            const capturados = await capturarClic(r, receptorLogVisor, uActiva, pcActivo);

            if (capturados.some(c => c?.omitidoInteractivo)) {
                return { omitidoInteractivo: true, guardados: [], errores: [] };
            }

            const bloques = await ejecutarPool(
                capturados,
                Math.min(CFG.CONCURRENCIA, capturados.length),
                async itemCap => {
                    verificarCancelacion();

                    if (typeof itemCap === 'string') {
                        agregarLog(`[VISOR] ${ruta} -> ${itemCap}`);
                        return recuperar(itemCap, r.nombre);
                    }
                    if (itemCap?.url) {
                        const etiquetaSub = itemCap.subCarpeta || itemCap.nombre || r.nombre;
                        if (uActiva && !opts.silenciarProgreso) {
                            progreso(uActiva, 0, 1, `Descargando (${r.nombre}): ${etiquetaSub}...`);
                        }
                        agregarLog(`[VISOR] ${ruta} (${etiquetaSub}) -> ${itemCap.url}`);
                        return recuperar(
                            itemCap.url,
                            itemCap.nombre || r.nombre,
                            0,
                            new Set(),
                            itemCap.subCarpeta || ''
                        );
                    }
                    if (itemCap?.textoPlano) {
                        return {
                            archivos: [
                                {
                                    nombre: `${seguro(r.nombre)}.txt`,
                                    bytes: new TextEncoder().encode(itemCap.textoPlano),
                                    subCarpeta: ''
                                }
                            ],
                            errores: []
                        };
                    }
                    return { archivos: [], errores: [] };
                }
            );

            verificarCancelacion();
            for (const rec of bloques) {
                if (!rec) continue;
                resultado.archivos.push(...rec.archivos);
                resultado.errores.push(...rec.errores);
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
        const logsPorItem = items.map(() => []);
        const mapaPorItem = items.map(() => []);
        let completados = 0;

        await ejecutarPool(items, CFG.CONCURRENCIA, async (r, i) => {
            verificarCancelacion();

            const ruta = r.ruta.join(' / ');
            const logsItem = logsPorItem[i];
            const mapaItem = mapaPorItem[i];

            pieza(u, i, 'procesando', r.nombre);

            if (r.omitido) {
                omitidos++;
                pieza(u, i, 'omitido', r.nombre);
                colorear(r, 'omitido', 'Material interactivo / SCORM omitido');
                logsItem.push(`[OMITIDO] ${ruta}`);
            } else {
                try {
                    const { omitidoInteractivo, guardados, errores: errParciales } = await procesarRecursoItem(
                        r,
                        u,
                        zip,
                        carpetaRaiz,
                        u,
                        null,
                        { logs: logsItem, silenciarProgreso: true }
                    );

                    if (omitidoInteractivo) {
                        omitidos++;
                        pieza(u, i, 'omitido', r.nombre);
                        colorear(r, 'omitido', 'Contenido interactivo Unity / SCORM cerrado automáticamente');
                        logsItem.push(`[OMITIDO] ${ruta} (Contenido interactivo Unity / SCORM)`);
                    } else {
                        for (const g of guardados) {
                            ok++;
                            const comentario = describirArchivo(
                                g.rutaFinal.split('/').pop(),
                                g.bytes.byteLength,
                                g.etiqueta
                            );
                            mapaItem.push({ ruta: g.rutaFinal, comentario });
                            logsItem.push(
                                `[OK] ${g.rutaFinal} (${(g.bytes.byteLength / 1024).toFixed(1)} KB)`
                            );
                        }

                        if (errParciales.length) {
                            errores += errParciales.length;
                            pieza(u, i, 'error', r.nombre);
                            colorear(r, 'error', errParciales.join(' | '));
                            errParciales.forEach(e =>
                                logsItem.push(`[ERROR PARCIAL] ${ruta}: ${e}`)
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
                    logsItem.push(`[ERROR] ${ruta}: ${e.message}`);
                }
            }

            completados++;
            progreso(
                u,
                completados,
                items.length,
                `Descargando (${completados}/${items.length}) · OK: ${ok} · Errores: ${errores}`
            );
        });

        verificarCancelacion();

        for (const logsItem of logsPorItem) u.log.push(...logsItem);
        const archivosParaMapa = mapaPorItem.flat();

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
        await dormir(10);

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

        let unidadesAbiertas = 0;
        progreso(pc, 0, listaUnidades.length, `Abriendo ${listaUnidades.length} unidades...`);

        const itemsPorUnidad = await ejecutarPool(
            listaUnidades,
            CFG.CONCURRENCIA_UNIDADES,
            async u => {
                verificarCancelacion();
                u.log = [];
                await expandirCarpetas(u);
                verificarCancelacion();
                const itemsUnidad = recursos(u);
                unidadesAbiertas++;
                progreso(
                    pc,
                    unidadesAbiertas,
                    listaUnidades.length,
                    `Escaneadas (${unidadesAbiertas}/${listaUnidades.length}): ${u.nombre}`
                );
                return itemsUnidad;
            }
        );

        verificarCancelacion();

        const colaGlobal = [];
        listaUnidades.forEach((u, idx) => {
            const itemsUnidad = itemsPorUnidad[idx] || [];
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
        });

        if (!colaGlobal.length) {
            throw new Error('No se detectaron recursos descargables en el curso');
        }

        crearPiezas(pc, colaGlobal);

        const zip = crearZipNativo();
        const carpetaCurso = seguro(nombreCurso);
        const logsPorItem = colaGlobal.map(() => []);
        const mapaPorItem = colaGlobal.map(() => []);
        const completadosPorUnidad = new Map();
        let completadosGlobal = 0;

        await ejecutarPool(
            colaGlobal,
            CFG.CONCURRENCIA,
            async ({ u, item: r, localIdx, totalUnidad }, i) => {
                verificarCancelacion();

                const carpetaUnidad = `${carpetaCurso}/${seguro(u.nombre)}`;
                const rutaLog = `${seguro(u.nombre)} / ${r.ruta.join(' / ')}`;
                const logsItem = logsPorItem[i];
                const mapaItem = mapaPorItem[i];

                pieza(pc, i, 'procesando', `${u.nombre}: ${r.nombre}`);
                pieza(u, localIdx, 'procesando', r.nombre);

                if (r.omitido) {
                    omitidos++;
                    pieza(pc, i, 'omitido', `${u.nombre}: ${r.nombre}`);
                    pieza(u, localIdx, 'omitido', r.nombre);
                    colorear(r, 'omitido', 'Material interactivo / SCORM omitido');
                    logsItem.push(`[OMITIDO] ${rutaLog}`);
                } else {
                    try {
                        const { omitidoInteractivo, guardados, errores: errParciales } = await procesarRecursoItem(
                            r,
                            pc,
                            zip,
                            carpetaUnidad,
                            u,
                            pc,
                            { logs: logsItem, silenciarProgreso: true }
                        );

                        if (omitidoInteractivo) {
                            omitidos++;
                            pieza(pc, i, 'omitido', `${u.nombre}: ${r.nombre}`);
                            pieza(u, localIdx, 'omitido', r.nombre);
                            colorear(r, 'omitido', 'Contenido interactivo Unity / SCORM cerrado automáticamente');
                            logsItem.push(`[OMITIDO] ${rutaLog} (Contenido interactivo Unity / SCORM)`);
                        } else {
                            for (const g of guardados) {
                                ok++;
                                const comentario = describirArchivo(
                                    g.rutaFinal.split('/').pop(),
                                    g.bytes.byteLength,
                                    g.etiqueta
                                );
                                mapaItem.push({ ruta: g.rutaFinal, comentario });
                                logsItem.push(
                                    `[OK] ${g.rutaFinal} (${(g.bytes.byteLength / 1024).toFixed(1)} KB)`
                                );
                            }

                            if (errParciales.length) {
                                errores += errParciales.length;
                                pieza(pc, i, 'error', `${u.nombre}: ${r.nombre}`);
                                pieza(u, localIdx, 'error', r.nombre);
                                colorear(r, 'error', errParciales.join(' | '));
                                errParciales.forEach(e =>
                                    logsItem.push(`[ERROR PARCIAL] ${rutaLog}: ${e}`)
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
                        logsItem.push(`[ERROR] ${rutaLog}: ${e.message}`);
                    }
                }

                completadosGlobal++;
                const compU = (completadosPorUnidad.get(u) || 0) + 1;
                completadosPorUnidad.set(u, compU);

                progreso(
                    pc,
                    completadosGlobal,
                    colaGlobal.length,
                    `Curso (${completadosGlobal}/${colaGlobal.length}) · OK: ${ok} · Errores: ${errores}`
                );
                progreso(
                    u,
                    compU,
                    totalUnidad,
                    compU >= totalUnidad ? 'Incluido en el ZIP del curso' : `Incluido (${compU}/${totalUnidad})`
                );
            }
        );

        verificarCancelacion();

        for (const logsItem of logsPorItem) pc.log.push(...logsItem);
        const archivosParaMapa = mapaPorItem.flat();

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
        await dormir(10);

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
