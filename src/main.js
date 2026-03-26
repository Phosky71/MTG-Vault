import { state } from './core/state.js';
import { applyTranslations, currentLang, setLanguage, t } from './i18n/index.js';
import { loadFromStorage, saveFolderCards } from './core/storage.js';
import { parseCSV } from './utils/parser.js';
import { showToast } from './utils/ui.js';
import {
    closeCardModal,
    createFolder,
    handleFilters,
    renderFolderSidebar,
    updateHeaderValue,
} from './views/collection.js';
import { addDeck, createBlankDeckAndOpen, renderDecks } from './views/decks.js';
import { updateDashboard } from './views/dashboard.js';
import { closeSFModal, initSearchView } from './views/search.js';
import { closeDeckBuilder } from './views/deckbuilder.js';
import { initWishlist, renderWishlist } from './views/wishlist.js';
import { saveBackup, startAutoBackup, downloadBackup, importBackupFromFile } from './core/backup.js';
import { exportToCSV, exportToJSON } from './utils/export.js';

// ── EXPORT BUTTONS ────────────────────────────────────────────
document.getElementById('btn-export-csv')?.addEventListener('click', () => exportToCSV());
document.getElementById('btn-export-json')?.addEventListener('click', () => exportToJSON());

// ── FLAG MODO WISHLIST ────────────────────────────────────────
let _wishlistSearchMode = false;

// ── NAV TABS ──────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const id = btn.getAttribute('data-target');
        document.querySelectorAll('.view-section')
            .forEach(s => s.classList.toggle('hidden', s.id !== id));

        if (id === 'view-dashboard') updateDashboard();
        if (id === 'view-wishlist')  renderWishlist();
    });
});

// ── IDIOMA ────────────────────────────────────────────────────
document.getElementById('lang-toggle').addEventListener('click', () => {
    const next = currentLang === 'es' ? 'en' : 'es';
    setLanguage(next);
    applyTranslations();
    renderFolderSidebar();
    handleFilters();
    renderDecks();
    renderWishlist();
    showToast(next === 'en' ? '🌐 English' : '🌐 Español', 'info');
});

// ── CARPETAS ──────────────────────────────────────────────────
document.getElementById('btn-new-folder').addEventListener('click', createFolder);

// ── CSV IMPORT ────────────────────────────────────────────────
document.getElementById('csv-upload').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    const folder = state.pendingImportFolder;
    state.pendingImportFolder = null;
    e.target.value = '';

    if (!folder) {
        showToast('Sin carpeta destino', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = async ev => {
        const cards = parseCSV(ev.target.result);
        if (!cards.length) {
            showToast(t('toast_import_empty'), 'warning');
            return;
        }

        const foilCount = cards.filter(c => c.isFoil).length;
        const totalVal  = cards.reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);
        const sets      = [...new Set(cards.map(c => c.set).filter(Boolean))];
        showToast(
            `📦 ${cards.length} cartas · ` +
            `${foilCount > 0 ? `✨${foilCount} foil · ` : ''}` +
            `${sets.slice(0, 3).join(', ')}${sets.length > 3 ? '…' : ''} · ` +
            `${totalVal.toFixed(2)} €`,
            'info', 5000
        );

        state.folders[folder] = [...(state.folders[folder] || []), ...cards];
        try {
            await saveFolderCards(folder, state.folders[folder]);
        } catch (err) {
            console.error('[MTGVault] Error guardando CSV en SQLite:', err);
            showToast('❌ Error al guardar las cartas', 'error');
            return;
        }

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
// addDeck es ahora async — el form handler también lo es
document.getElementById('deck-import-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name   = document.getElementById('deck-name-input').value.trim();
    const format = document.getElementById('deck-format-select').value;
    const url    = document.getElementById('deck-url-input')?.value.trim() ?? '';

    const idx = await addDeck(url, name, format);
    if (idx >= 0) {
        e.target.reset();
        import('./views/deckbuilder.js').then(({ openDeckBuilder }) => openDeckBuilder(idx));
    }
});

document.getElementById('format-filter').addEventListener('change', renderDecks);
document.getElementById('btn-new-deck')?.addEventListener('click', createBlankDeckAndOpen);

// ── BACKUP ────────────────────────────────────────────────────
document.getElementById('btn-backup-download')?.addEventListener('click', downloadBackup);

document.getElementById('btn-backup-import')?.addEventListener('click', () => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
    input.onchange = async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const ok = await importBackupFromFile(file);
            if (ok) {
                showToast('✅ Backup restaurado correctamente', 'success');
                renderFolderSidebar();
                handleFilters();
                renderDecks();
                updateDashboard();
                await initWishlist();
            }
        } catch {
            showToast('❌ Error al leer el fichero de backup', 'error');
        }
    };
    input.click();
});

// ── WISHLIST — abrir buscador ─────────────────────────────────
window.addEventListener('wl:open-search', () => {
    _wishlistSearchMode = true;
    document.querySelector('.nav-btn[data-target="view-search"]')?.click();
    setTimeout(() => {
        const input = document.getElementById('sf-search-input');
        if (input) { input.focus(); input.select(); }
    }, 50);
    showToast('💭 Busca una carta y pulsa 💭 para añadirla a la wishlist', 'info', 4000);
});

window.addEventListener('wl:close-search', () => { _wishlistSearchMode = false; });

export function isWishlistSearchMode()    { return _wishlistSearchMode; }
export function clearWishlistSearchMode() { _wishlistSearchMode = false; }

// ── MODALES ───────────────────────────────────────────────────
document.getElementById('modal-close').addEventListener('click', closeCardModal);
document.getElementById('card-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCardModal();
});

document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeCardModal();
    closeSFModal();
    closeDeckBuilder();
    _wishlistSearchMode = false;
});

// ── PWA ───────────────────────────────────────────────────────
let _deferredInstallPrompt = null;
const pwaToast = document.getElementById('pwa-toast');

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    setTimeout(() => pwaToast?.classList.add('show'), 3000);
});

document.getElementById('pwa-toast-install')?.addEventListener('click', async () => {
    if (!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    const { outcome } = await _deferredInstallPrompt.userChoice;
    _deferredInstallPrompt = null;
    pwaToast?.classList.remove('show');
    if (outcome === 'accepted') showToast('✅ MTG Vault instalada como app', 'success');
});

document.getElementById('pwa-toast-dismiss')?.addEventListener('click', () => {
    pwaToast?.classList.remove('show');
});

window.addEventListener('appinstalled', () => {
    showToast('🎉 App instalada correctamente', 'success');
    pwaToast?.classList.remove('show');
});

// ── SERVICE WORKER ────────────────────────────────────────────
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(() => console.log('[SW] Registrado'))
        .catch(e => console.warn('[SW] Error:', e));
}

// ── INIT ──────────────────────────────────────────────────────
(async function init() {
    // 1. Migración one-shot desde localStorage/IndexedDB → SQLite
    const { migrateToSQLite } = await import('./core/migrate.js');
    const wasMigrated = await migrateToSQLite();
    if (wasMigrated) showToast('✅ Datos migrados a base de datos local', 'success');

    // 2. Cargar estado desde SQLite
    await loadFromStorage();

    // 3. Backup JSON (capa de seguridad extra)
    saveBackup();
    startAutoBackup();
    window.addEventListener('beforeunload', () => saveBackup());

    // 4. Render inicial
    applyTranslations();
    renderFolderSidebar();
    handleFilters();
    renderDecks();
    updateHeaderValue();
    initSearchView();
    await initWishlist();
})();