import {state} from '../core/state.js';
import {t} from '../i18n/index.js';
import {saveToStorage} from '../core/storage.js';
import {showToast} from '../utils/ui.js';
import {exportDeckToTxt, exportToCSV, exportToJSON} from '../utils/export.js';
import {initDB} from "../core/db.js";
import {
    downloadBackup,
    importBackupFromFile,
    restoreBackupIfNeeded,
    saveBackup,
    startAutoBackup
} from "../core/backup.js";
import {renderDecks} from "./decks.js";
import {updateDashboard} from "./dashboard.js";

const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

document.addEventListener('DOMContentLoaded', async () => {
    await initDB();

    // ── Restaurar datos si localStorage está vacío ────────────
    const restored = restoreBackupIfNeeded();
    if (restored) {
        showToast('♻️ Datos restaurados desde backup automático', 'info');
    }

    // ── Guardar backup inicial y arrancar autoguardado ────────
    saveBackup();
    startAutoBackup();

    // ... resto del init que ya tenías ...
    renderFolderSidebar();
    handleFilters();
    renderDecks();
    // etc.

    // ── Botón backup manual (si existe en el HTML) ────────────
    document.getElementById('btn-backup-download')
        ?.addEventListener('click', downloadBackup);

    document.getElementById('btn-backup-import')
        ?.addEventListener('click', () => {
            const input = Object.assign(document.createElement('input'),
                {type: 'file', accept: '.json'});
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
                    }
                } catch {
                    showToast('❌ Error al leer el fichero de backup', 'error');
                }
            };
            input.click();
        });

    // ── Guardar backup al cerrar/recargar la pestaña ──────────
    window.addEventListener('beforeunload', () => {
        saveBackup();
    });
});

// ── HELPERS ───────────────────────────────────────────────────
export function getAllCards() {
    return Object.values(state.folders).flat();
}

function findCardFolder(card) {
    return Object.entries(state.folders)
        .find(([, cards]) => cards.includes(card))?.[0] ?? null;
}

function deleteCardFromState(card) {
    const folder = findCardFolder(card);
    if (folder === null) return false;
    state.folders[folder] = state.folders[folder].filter(c => c !== card);
    return true;
}

// ── HEADER ────────────────────────────────────────────────────
export function updateHeaderValue() {
    const total = getAllCards().reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);
    const el = document.getElementById('header-total-value');
    if (el) el.textContent = `${total.toFixed(2)} €`;
}

// ── SIDEBAR ───────────────────────────────────────────────────
export function renderFolderSidebar() {
    const list = document.getElementById('folder-list');
    Array.from(list.querySelectorAll('.folder-nav-item[data-folder]'))
        .forEach(el => {
            if (el.dataset.folder !== '') el.remove();
        });

    const allCount = getAllCards().reduce((s, c) => s + (c.quantity || 1), 0);
    const allCountEl = document.getElementById('folder-count-all');
    if (allCountEl) allCountEl.textContent = allCount;

    const allItem = list.querySelector('[data-folder=""]');
    if (allItem) {
        const nameEl = allItem.querySelector('[data-i18n="folder_all"]');
        if (nameEl) nameEl.textContent = t('folder_all');
        allItem.classList.toggle('active', state.activeFolderFilter === '');
        allItem.onclick = () => {
            state.activeFolderFilter = '';
            renderFolderSidebar();
            handleFilters();
        };
    }

    Object.keys(state.folders).sort().forEach(name => {
        const qty = state.folders[name].reduce((s, c) => s + (c.quantity || 1), 0);
        const li = document.createElement('li');
        li.className = `folder-nav-item${state.activeFolderFilter === name ? ' active' : ''}`;
        li.dataset.folder = name;
        li.innerHTML = `
            <span class="folder-nav-name">📁 ${esc(name)}</span>
            <span class="folder-nav-count">${qty}</span>
            <div class="folder-actions">
                <button class="folder-action-btn import-btn"     title="${t('import_csv')}">📥</button>
                <button class="folder-action-btn export-csv-btn" title="Exportar CSV">📤</button>
                <button class="folder-action-btn export-txt-btn" title="Exportar TXT">📄</button>
                <button class="folder-action-btn rename-btn"     title="${t('rename')}">✏️</button>
                <button class="folder-action-btn delete-btn"     title="${t('delete')}">🗑</button>
            </div>`;

        li.querySelector('.folder-nav-name').onclick = () => {
            state.activeFolderFilter = name;
            renderFolderSidebar();
            handleFilters();
        };
        li.querySelector('.import-btn').onclick = e => {
            e.stopPropagation();
            state.pendingImportFolder = name;
            document.getElementById('csv-upload').click();
        };
        li.querySelector('.export-csv-btn').onclick = e => {
            e.stopPropagation();
            exportToCSV(name);
        };
        li.querySelector('.export-txt-btn').onclick = e => {
            e.stopPropagation();
            exportDeckToTxt(name);
        };
        li.querySelector('.rename-btn').onclick = e => {
            e.stopPropagation();
            renameFolder(name);
        };
        li.querySelector('.delete-btn').onclick = e => {
            e.stopPropagation();
            deleteFolder(name);
        };
        list.appendChild(li);
    });

    _bindExportButtons();
    updateHeaderValue();
}

function _bindExportButtons() {
    const buttons = {
        'btn-export-csv': () => exportToCSV(state.activeFolderFilter || null),
        'btn-export-txt': () => exportDeckToTxt(state.activeFolderFilter || null),
        'btn-export-json': () => exportToJSON(),
    };

    Object.entries(buttons).forEach(([id, handler]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const fresh = el.cloneNode(true);
        el.replaceWith(fresh);
        fresh.addEventListener('click', handler);
    });
}

// ── CRUD CARPETAS ─────────────────────────────────────────────
export function createFolder() {
    const name = prompt(t('new_folder_prompt'));
    if (!name?.trim()) return;
    const trimmed = name.trim();
    if (state.folders[trimmed] !== undefined) {
        showToast(t('folder_exists'), 'warning');
        return;
    }
    state.folders[trimmed] = [];
    saveToStorage();
    renderFolderSidebar();
    showToast(t('toast_folder_created', {name: trimmed}), 'success');
}

function deleteFolder(name) {
    if (!confirm(t('confirm_delete_folder', {name}))) return;
    delete state.folders[name];
    if (state.activeFolderFilter === name) state.activeFolderFilter = '';
    saveToStorage();
    renderFolderSidebar();
    handleFilters();
    showToast(t('toast_folder_deleted', {name}), 'info');
}

function renameFolder(oldName) {
    const newName = prompt(t('rename_folder_prompt', {name: oldName}), oldName);
    if (!newName?.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    if (state.folders[trimmed] !== undefined) {
        showToast(t('folder_exists'), 'warning');
        return;
    }
    state.folders[trimmed] = state.folders[oldName];
    delete state.folders[oldName];
    if (state.activeFolderFilter === oldName) state.activeFolderFilter = trimmed;
    saveToStorage();
    renderFolderSidebar();
    handleFilters();
    showToast(t('toast_folder_renamed', {name: trimmed}), 'success');
}

// ── FILTROS ───────────────────────────────────────────────────
export function handleFilters() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const sort = document.getElementById('sort-filter').value;
    const color = document.getElementById('color-filter').value;

    let cards = state.activeFolderFilter
        ? (state.folders[state.activeFolderFilter] || [])
        : getAllCards();

    if (query) cards = cards.filter(c =>
        c.name.toLowerCase().includes(query) ||
        (c.set && c.set.toLowerCase().includes(query))
    );
    if (color) cards = cards.filter(c =>
        (c.colors || '').toUpperCase().includes(color)
    );
    if (sort === 'price-desc') cards = [...cards].sort((a, b) => b.price - a.price);
    if (sort === 'price-asc') cards = [...cards].sort((a, b) => a.price - b.price);
    if (sort === 'name-asc') cards = [...cards].sort((a, b) => a.name.localeCompare(b.name));

    renderCards(cards);
}

// ── RENDER CARDS ──────────────────────────────────────────────
export function renderCards(cards) {
    const grid = document.getElementById('card-grid');
    grid.innerHTML = '';
    let totalVal = 0, totalCount = 0;

    if (!cards?.length) {
        const isEmpty = getAllCards().length === 0;
        grid.innerHTML = `
            <div class="empty-state col-span-full">
                <div class="text-4xl mb-3">${isEmpty ? '📦' : '🔍'}</div>
                <p class="font-semibold text-slate-300">
                    ${isEmpty ? t('empty_collection_title') : t('empty_no_match')}
                </p>
                ${isEmpty ? `<p class="text-sm text-slate-500 mt-1">${t('empty_create_folder')}</p>` : ''}
            </div>`;
        document.getElementById('total-cards').textContent = '0';
        document.getElementById('total-value').textContent = '0.00 €';
        return;
    }

    cards.forEach(card => {
        const qty = card.quantity || 1;
        totalVal += (card.price || 0) * qty;
        totalCount += qty;

        const el = document.createElement('div');
        el.className = 'mtg-card-item';
        const eur = card.price > 0 ? `${(card.price * qty).toFixed(2)} €` : '—';
        const eurUnit = card.price > 0 && qty > 1 ? ` (${card.price.toFixed(2)} €/u)` : '';
        const foilBadge = card.isFoil
            ? `<span class="foil-badge">${t('foil_label')}</span>` : '';

        el.innerHTML = `
            <div class="card-image-wrapper${card.isFoil ? ' is-foil' : ''}">
                <img src="${esc(card.imageUrl || card.image || '')}"
                     alt="${esc(card.name)}" loading="lazy"
                     onerror="this.src='https://cards.scryfall.io/large/back/0/a/0a0aeeab-af58-8c7d-4636-9e82-8c27447861f7.jpg'">
                ${foilBadge}
            </div>
            <div class="card-details">
                <div class="card-header">
                    <h2 class="card-title">
                        ${esc(card.name)}
                        ${qty > 1 ? `<span class="card-qty">x${qty}</span>` : ''}
                    </h2>
                    <span class="card-set">${esc(card.set || '')}</span>
                </div>
                <div class="card-price">
                    ${eur}
                    <span class="price-label">${eurUnit}</span>
                </div>
            </div>`;

        el.addEventListener('click', () => openCardModal(card));
        grid.appendChild(el);
    });

    document.getElementById('total-cards').textContent = totalCount;
    document.getElementById('total-value').textContent = `${totalVal.toFixed(2)} €`;
}

// ── MODAL EDICIÓN ─────────────────────────────────────────────
export function openCardModal(card) {
    const modal = document.getElementById('card-modal');
    const body = document.getElementById('modal-body');

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    const prices = {
        eur: card.priceNormal ?? card.price ?? 0,
        eur_foil: card.priceFoil ?? 0,
    };
    const folderName = findCardFolder(card) ?? '';

    body.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-5">

        <!-- Imagen -->
        <div class="flex-shrink-0 mx-auto sm:mx-0">
            <img src="${esc(card.imageUrl || card.image || '')}"
                 alt="${esc(card.name)}"
                 class="w-44 rounded-xl shadow-xl"
                 onerror="this.src='https://cards.scryfall.io/large/back/0/a/0a0aeeab-af58-8c7d-4636-9e82-8c27447861f7.jpg'">
        </div>

        <!-- Info + edición -->
        <div class="flex-1 min-w-0">
            <h2 class="text-lg font-extrabold mb-1">${esc(card.name)}</h2>
            <p class="text-xs text-slate-400 mb-4">
                ${esc(card.set || '')}
                ${card.condition ? ` · ${esc(card.condition)}` : ''}
                ${folderName ? ` · 📁 ${esc(folderName)}` : ''}
            </p>

            <!-- Precios -->
            <div class="grid grid-cols-2 gap-2 mb-4 text-sm">
                <div class="glass-card p-2 text-center">
                    <p class="text-[10px] text-slate-500 uppercase mb-0.5">Normal</p>
                    <p class="font-bold text-emerald-400">
                        ${prices.eur > 0 ? prices.eur.toFixed(2) + ' €' : t('price_na')}
                    </p>
                </div>
                <div class="glass-card p-2 text-center">
                    <p class="text-[10px] text-slate-500 uppercase mb-0.5">Foil ✨</p>
                    <p class="font-bold text-violet-400">
                        ${prices.eur_foil > 0 ? prices.eur_foil.toFixed(2) + ' €' : t('price_na')}
                    </p>
                </div>
            </div>

            <!-- Formulario -->
            <div class="flex flex-col gap-3">
                <div class="flex gap-3">
                    <label class="flex-1">
                        <span class="text-xs text-slate-400">${t('modal_quantity')}</span>
                        <input id="modal-qty" type="number" min="1" value="${card.quantity || 1}"
                               class="input-glass w-full mt-1">
                    </label>
                    <label class="flex-1">
                        <span class="text-xs text-slate-400">${t('modal_condition')}</span>
                        <select id="modal-condition" class="input-glass w-full mt-1">
                            ${['NM', 'LP', 'MP', 'HP', 'DMG'].map(c =>
        `<option value="${c}"${card.condition === c ? ' selected' : ''}>${c}</option>`
    ).join('')}
                        </select>
                    </label>
                </div>

                <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" id="modal-foil" class="accent-sky-400"
                           ${card.isFoil ? 'checked' : ''}>
                    <span class="text-sm">${t('foil_label')}</span>
                    <span class="text-xs text-slate-500">${t('foil_price_note')}</span>
                </label>

                <label>
                    <span class="text-xs text-slate-400">
                        ${t('notes')} <span class="opacity-50">${t('optional')}</span>
                    </span>
                    <textarea id="modal-notes" rows="2"
                              class="input-glass w-full mt-1 resize-none"
                              placeholder="${t('notes_placeholder')}">${esc(card.notes || '')}</textarea>
                </label>
            </div>

            <!-- Botones acción -->
            <div class="flex gap-2 mt-5 pt-4 border-t border-white/10">
                <button id="modal-save" class="btn-primary flex-1">
                    💾 ${t('save_changes')}
                </button>
                <button id="modal-delete"
                        class="px-4 py-2.5 rounded-lg text-sm font-semibold
                               bg-red-400/10 border border-red-400/20 text-red-400
                               hover:bg-red-400/20 transition-colors">
                    🗑 ${t('delete')}
                </button>
            </div>

            ${card.cardmarketUrl || card.cardmarket_url ? `
                <a href="${esc(card.cardmarketUrl || card.cardmarket_url)}"
                   target="_blank" rel="noopener"
                   class="block text-center text-xs text-sky-400 hover:underline mt-3">
                    ${t('modal_view_cardmarket')} ↗
                </a>` : ''}
        </div>
    </div>`;

    // ── Guardar ───────────────────────────────────────────────
    document.getElementById('modal-save').addEventListener('click', () => {
        const newFoil = document.getElementById('modal-foil').checked;
        card.quantity = Math.max(1, parseInt(document.getElementById('modal-qty').value, 10) || 1);
        card.condition = document.getElementById('modal-condition').value;
        card.notes = document.getElementById('modal-notes').value.trim();
        card.isFoil = newFoil;

        if (newFoil && card.priceFoil > 0) card.price = card.priceFoil;
        else if (!newFoil && card.priceNormal > 0) card.price = card.priceNormal;

        saveToStorage();
        closeCardModal();
        handleFilters();
        updateHeaderValue();
        renderFolderSidebar();
        showToast(t('toast_card_updated', {name: card.name}), 'success');
    });

    // ── Eliminar ──────────────────────────────────────────────
    document.getElementById('modal-delete').addEventListener('click', () => {
        if (!confirm(t('confirm_delete_card', {name: card.name}))) return;
        const deleted = deleteCardFromState(card);
        if (!deleted) {
            showToast('Error: carta no encontrada', 'error');
            return;
        }
        saveToStorage();
        closeCardModal();
        handleFilters();
        updateHeaderValue();
        renderFolderSidebar();
        showToast(t('toast_card_deleted', {name: card.name}), 'info');
    });
}

export function closeCardModal() {
    const modal = document.getElementById('card-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}
