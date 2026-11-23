// Armado de archivos .zip en binario puro (STORE sin compresión para no trabar la CPU con videos) y árbol de texto para _REPORTE.txt.

import { canon, clonarBytes } from './utils.js';

export function generarMapaArbol(raizNombre, listaArchivos) {
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

export function describirArchivo(nombreArchivo, bytesLength, etiquetaItem = '') {
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

export function crearZipNativo() {
    const archivos = new Map();
    const encoder = new TextEncoder();

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
                    ? encoder.encode(contenido)
                    : contenido instanceof Uint8Array
                      ? contenido
                      : contenido instanceof ArrayBuffer
                        ? new Uint8Array(contenido)
                        : ArrayBuffer.isView(contenido)
                          ? new Uint8Array(contenido.buffer, contenido.byteOffset, contenido.byteLength)
                          : clonarBytes(contenido);

            const nombreBytes = encoder.encode(limpia);
            const crc = calcularCrc32(bytes);

            archivos.set(limpia.toLowerCase(), {
                ruta: limpia,
                nombreBytes,
                bytes,
                crc
            });
        },
        generarBlob() {
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
                const { nombreBytes, bytes: datos, crc } = item;
                const tamano = datos.byteLength >>> 0;

                // Cabecera local combinada con el nombre UTF-8 (bit 0x0800 para tildes y eñes).
                const localBuf = new ArrayBuffer(30 + nombreBytes.byteLength);
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
                new Uint8Array(localBuf, 30).set(nombreBytes);

                partesLocales.push(new Uint8Array(localBuf), datos);

                // Entrada para el directorio central al final del ZIP (46 bytes + nombre).
                const centralBuf = new ArrayBuffer(46 + nombreBytes.byteLength);
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
                new Uint8Array(centralBuf, 46).set(nombreBytes);

                partesCentrales.push(new Uint8Array(centralBuf));

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
export function rutaLibre(zip, baseRuta, nombreArchivo) {
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

export function guardarZip(u) {
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
