import { state } from './state.js';

const KEY_FOLDERS = 'mtg_vault_folders';
const KEY_DECKS   = 'mtg_vault_decks';

export function saveToStorage() {
    try {
        localStorage.setItem(KEY_FOLDERS, JSON.stringify(state.folders));
        localStorage.setItem(KEY_DECKS,   JSON.stringify(state.decks));
    } catch (e) {
        console.warn('[MTGVault] Error guardando:', e);
    }
}

export function loadFromStorage() {
    try {
        const rawFolders = localStorage.getItem(KEY_FOLDERS);
        const rawDecks   = localStorage.getItem(KEY_DECKS);
        if (rawFolders) state.folders = JSON.parse(rawFolders);
        if (rawDecks)   state.decks   = JSON.parse(rawDecks);
    } catch (e) {
        console.warn('[MTGVault] Error cargando:', e);
        state.folders = {};
        state.decks   = [];
    }
}
