import { state }            from './state.js';
import { t, applyTranslations, setLanguage, currentLang } from './i18n.js';
import { loadFromStorage, saveToStorage } from './storage.js';
import { parseCSV }         from './parser.js';
import { showToast, closeModal } from './ui.js';
import {
    renderFolderSidebar, handleFilters,
    updateHeaderValue, createFolder
} from './collection.js';
import { renderDecks, addDeck } from './decks.js';
import { updateDashboard }      from './dashboard.js';
import { initSearchView, closeSFModal } from './search-view.js';
import { initDB }               from './db.js';

// ── NAV TABS ──────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        document.querySelectorAll('.view-section').forEach(s => {
            s.classList.toggle('hidden', s.id !== targetId);
        });
        if (targetId === 'view-dashboard') updateDashboard();
    });
});

// ── LANGUAGE TOGGLE ───────────────────────────────────────────
document.getElementById('lang-toggle').addEventListener('click', () => {
    const next = currentLang === 'es' ? 'en' : 'es';
    setLanguage(next);
    applyTranslations();
    renderFolderSidebar();
    handleFilters();
    renderDecks();
    showToast(next === 'en' ? '🌐 English' : '🌐 Español', 'info');
});

// ── NUEVA CARPETA ─────────────────────────────────────────────
document.getElementById('btn-new-folder').addEventListener('click', createFolder);

// ── IMPORTAR CSV ──────────────────────────────────────────────
document.getElementById('csv-upload').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const folder = state.pendingImportFolder;
    state.pendingImportFolder = null;
    e.target.value = '';
    if (!folder) { showToast('Sin carpeta destino', 'warning'); return; }

    const reader = new FileReader();
    reader.onload = ev => {
        const cards = parseCSV(ev.target.result);
        if (!cards.length) { showToast(t('toast_import_empty'), 'warning'); return; }
        state.folders[folder] = [...(state.folders[folder] || []), ...cards];
        saveToStorage();
        renderFolderSidebar();
        handleFilters();
        showToast(t('toast_import_success', { n: cards.length, folder }), 'success');
    };
    reader.onerror = () => showToast(t('toast_import_error'), 'error');
    reader.readAsText(file, 'UTF-8');
});

// ── FILTROS COLECCIÓN ─────────────────────────────────────────
document.getElementById('search-input').addEventListener('input', handleFilters);
document.getElementById('sort-filter').addEventListener('change', handleFilters);
document.getElementById('color-filter').addEventListener('change', handleFilters);

// ── MAZOS ─────────────────────────────────────────────────────
document.getElementById('deck-import-form').addEventListener('submit', e => {
    e.preventDefault();
    const url    = document.getElementById('deck-url-input').value.trim();
    const name   = document.getElementById('deck-name-input').value.trim();
    const format = document.getElementById('deck-format-select').value;
    if (addDeck(url, name, format)) e.target.reset();
});
document.getElementById('format-filter').addEventListener('change', renderDecks);

// ── MODAL COLECCIÓN ────────────────────────────────────────────
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('card-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
});

// ── MODAL SCRYFALL ─────────────────────────────────────────────
document.getElementById('sf-modal-close').addEventListener('click', closeSFModal);
document.getElementById('sf-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSFModal();
});

// ── ESC cierra cualquier modal abierto ─────────────────────────
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeModal();
    closeSFModal();
});

// ── INIT ──────────────────────────────────────────────────────
(async function init() {
    await initDB();          // IndexedDB lista antes que todo
    loadFromStorage();
    applyTranslations();
    renderFolderSidebar();
    handleFilters();
    renderDecks();
    updateHeaderValue();
    initSearchView();        // Activa listeners del buscador Scryfall
})();
