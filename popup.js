import { LOGO_BASE64 } from './modules/config.js';

const img = document.getElementById('logo-transformer');
if (img) {
    img.src = LOGO_BASE64;
}

const btnActualizar = document.getElementById('btn-actualizar-scripts');
const estadoEl = document.getElementById('estado-actualizacion');
const btnPermiso = document.getElementById('btn-permiso-userscripts');

let extensionIdActual = '';

function mostrarEstado(texto, tipo = '') {
    estadoEl.textContent = texto;
    estadoEl.className = tipo ? `estado-sync ${tipo}` : 'estado-sync';
}

function pintarEstadoGuardado(respuesta) {
    if (!respuesta || !respuesta.ok) {
        mostrarEstado(respuesta?.error || 'Usando versión local v3.2.0');
        return;
    }

    extensionIdActual = respuesta.extensionId || chrome.runtime.id;
    btnPermiso.hidden = Boolean(respuesta.userScriptsActivo);

    if (respuesta.cache) {
        const c = respuesta.cache;
        const avisoPermiso = respuesta.userScriptsActivo
            ? ''
            : ' · Activa "Permitir scripts de usuario" para aplicar los cambios en vivo';
        mostrarEstado(
            `Sincronizado #${c.shaCorto} (${c.mensajeCommit}) · ${c.actualizadoEn}${avisoPermiso}`,
            respuesta.userScriptsActivo ? 'ok' : ''
        );
    } else {
        mostrarEstado('Usando módulos locales v3.2.0. Pulsa el botón para traer la última versión de GitHub.');
    }
}

chrome.runtime.sendMessage({ action: 'MAXIMUS_GET_STATUS' }, respuesta => {
    if (chrome.runtime.lastError) {
        mostrarEstado('Usando versión local v3.2.0');
        return;
    }
    pintarEstadoGuardado(respuesta);
});

btnActualizar.addEventListener('click', () => {
    btnActualizar.disabled = true;
    const textoOriginal = btnActualizar.textContent;
    btnActualizar.textContent = 'Actualizando desde GitHub...';
    mostrarEstado('Descargando módulos desde GitHub...');

    chrome.runtime.sendMessage({ action: 'MAXIMUS_UPDATE_SCRIPTS' }, respuesta => {
        btnActualizar.disabled = false;
        btnActualizar.textContent = textoOriginal;

        if (chrome.runtime.lastError) {
            mostrarEstado(`Error: ${chrome.runtime.lastError.message}`, 'error');
            return;
        }

        if (!respuesta || !respuesta.ok) {
            mostrarEstado(`Error: ${respuesta?.error || 'No se pudo actualizar'}`, 'error');
            return;
        }

        btnPermiso.hidden = Boolean(respuesta.userScriptsActivo);

        const c = respuesta.cache;
        const extraTabs = respuesta.pestanasActualizadas
            ? ` · ${respuesta.pestanasActualizadas} pestaña(s) recargadas`
            : '';

        if (respuesta.userScriptsActivo) {
            mostrarEstado(
                `¡Actualizado! Commit #${c.shaCorto} (${c.mensajeCommit}) · ${c.actualizadoEn}${extraTabs}`,
                'ok'
            );
        } else {
            mostrarEstado(
                `Descargado #${c.shaCorto}, pero falta activar "Permitir scripts de usuario" en los detalles de la extensión.`,
                'error'
            );
        }
    });
});

btnPermiso.addEventListener('click', () => {
    const id = extensionIdActual || chrome.runtime.id;
    chrome.tabs.create({ url: `chrome://extensions/?id=${id}` });
});
