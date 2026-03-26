import { state }       from './state.js';
import { saveToStorage, loadFromStorage } from './storage.js';
import { showToast }   from '../utils/ui.js';

const BACKUP_KEY     = 'mtg_vault_backup';
const CHECKSUM_KEY   = 'mtg_vault_checksum';
const INTERVAL_MS    = 5 * 60 * 1000; // autoguardado cada 5 min

// ── HELPERS ───────────────────────────────────────────────────
function _serialize() {
    return JSON.stringify({
        version:    '1.0',
        savedAt:    new Date().toISOString(),
        folders:    state.folders,
        decks:      state.decks ?? [],
    });
}

function _checksum(str) {
    // Checksum rápido: longitud + suma de char codes muestreados
    let h = str.length;
    for (let i = 0; i < str.length; i += 100) h += str.charCodeAt(i);
    return h;
}

function _isEmpty() {
    const noFolders = Object.keys(state.folders).length === 0;
    const noDecks   = (state.decks ?? []).length === 0;
    return noFolders && noDecks;
}

// ── GUARDAR BACKUP ────────────────────────────────────────────
export function saveBackup() {
    try {
        const data = _serialize();
        localStorage.setItem(BACKUP_KEY,   data);
        localStorage.setItem(CHECKSUM_KEY, String(_checksum(data)));
    } catch (e) {
        console.warn('[Backup] Error al guardar backup:', e);
    }
}

// ── CARGAR BACKUP ─────────────────────────────────────────────
/**
 * Restaura el backup SOLO si localStorage principal está vacío.
 * @returns {boolean} true si se restauró
 */
export function restoreBackupIfNeeded() {
    // Si hay datos en localStorage principal, no hacer nada
    loadFromStorage();
    if (!_isEmpty()) return false;

    // Sin datos — intentar restaurar desde backup
    try {
        const raw      = localStorage.getItem(BACKUP_KEY);
        const checksum = localStorage.getItem(CHECKSUM_KEY);

        if (!raw) return false;

        // Verificar integridad
        if (checksum && _checksum(raw) !== parseInt(checksum, 10)) {
            console.warn('[Backup] Checksum no coincide, backup posiblemente corrupto');
            return false;
        }

        const parsed = JSON.parse(raw);
        if (!parsed?.folders) return false;

        state.folders = parsed.folders ?? {};
        state.decks   = parsed.decks   ?? [];

        // Sincronizar localStorage principal con lo restaurado
        saveToStorage();

        const totalCards = Object.values(state.folders).flat().length;
        const totalDecks = state.decks.length;
        console.info(`[Backup] Restaurado: ${totalCards} cartas, ${totalDecks} mazos`);
        return true;

    } catch (e) {
        console.warn('[Backup] Error al restaurar backup:', e);
        return false;
    }
}

// ── AUTOGUARDADO PERIÓDICO ────────────────────────────────────
let _autoSaveTimer = null;

export function startAutoBackup() {
    if (_autoSaveTimer) return; // ya iniciado
    _autoSaveTimer = setInterval(() => {
        if (!_isEmpty()) {
            saveBackup();
            console.debug('[Backup] Autoguardado OK');
        }
    }, INTERVAL_MS);
}

export function stopAutoBackup() {
    clearInterval(_autoSaveTimer);
    _autoSaveTimer = null;
}

// ── EXPORTAR BACKUP MANUAL (descarga fichero) ─────────────────
export function downloadBackup() {
    try {
        const data = _serialize();
        const blob = new Blob([data], { type: 'application/json;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const date = new Date().toISOString().slice(0, 10);
        const a    = Object.assign(document.createElement('a'),
            { href: url, download: `mtgvault_backup_${date}.json` });
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);

        const totalCards = Object.values(state.folders).flat().length;
        showToast(`💾 Backup descargado — ${totalCards} cartas, ${state.decks?.length ?? 0} mazos`, 'success');
    } catch (e) {
        showToast('❌ Error al descargar el backup', 'error');
    }
}

// ── IMPORTAR BACKUP DESDE FICHERO ─────────────────────────────
export function importBackupFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (!parsed?.folders) throw new Error('Formato inválido');

                const totalCards = Object.values(parsed.folders).flat().length;
                const totalDecks = (parsed.decks ?? []).length;

                if (!confirm(
                    `¿Restaurar backup?\n\n` +
                    `📦 ${totalCards} cartas en ${Object.keys(parsed.folders).length} carpetas\n` +
                    `🃏 ${totalDecks} mazos\n\n` +
                    `Esto sobrescribirá los datos actuales.`
                )) return resolve(false);

                state.folders = parsed.folders ?? {};
                state.decks   = parsed.decks   ?? [];
                saveToStorage();
                saveBackup();
                resolve(true);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}
