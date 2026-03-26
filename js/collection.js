import { state }         from './state.js';
import { t }             from './i18n.js';
import { saveToStorage } from './storage.js';
import { showToast, openCardModal } from './ui.js';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function getAllCards() {
    return Object.values(state.folders).flat();
}

// ── SIDEBAR ────────────────────────────────────────────────────
export function renderFolderSidebar() {
    const list = document.getElementById('folder-list');

    // Eliminar items dinámicos, preservar "Todas"
    Array.from(list.querySelectorAll('.folder-nav-item[data-folder]'))
        .forEach(el => { if (el.dataset.folder !== '') el.remove(); });

    // Actualizar contador "Todas"
    const allCount = getAllCards().reduce((s, c) => s + (c.quantity || 1), 0);
    const allCountEl = document.getElementById('folder-count-all');
    if (allCountEl) allCountEl.textContent = allCount;

    // Estado activo de "Todas"
    const allItem = list.querySelector('[data-folder=""]');
    if (allItem) {
        const nameEl = allItem.querySelector('[data-i18n="folder_all"]');
        if (nameEl) nameEl.textContent = t('folder_all');
        allItem.classList.toggle('active', state.activeFolderFilter === '');
        allItem.onclick = () => { state.activeFolderFilter = ''; renderFolderSidebar(); handleFilters(); };
    }

    // Renderizar carpetas
    Object.keys(state.folders).sort().forEach(name => {
        const qty = state.folders[name].reduce((s, c) => s + (c.quantity || 1), 0);
        const li = document.createElement('li');
        li.className = `folder-nav-item${state.activeFolderFilter === name ? ' active' : ''}`;
        li.dataset.folder = name;
        li.innerHTML = `
      <span>📁</span>
      <span class="folder-nav-name">${esc(name)}</span>
      <span class="folder-nav-count">${qty}</span>
      <span class="folder-actions">
        <button class="folder-action-btn import-btn" title="Importar CSV">⬆</button>
        <button class="folder-action-btn rename-btn" title="Renombrar">✏️</button>
        <button class="folder-action-btn delete-btn" title="Eliminar">🗑</button>
      </span>`;

        li.querySelector('.folder-nav-name').onclick = () => {
            state.activeFolderFilter = name; renderFolderSidebar(); handleFilters();
        };
        li.querySelector('.import-btn').onclick = e => {
            e.stopPropagation();
            state.pendingImportFolder = name;
            document.getElementById('csv-upload').click();
        };
        li.querySelector('.rename-btn').onclick = e => {
            e.stopPropagation(); renameFolder(name);
        };
        li.querySelector('.delete-btn').onclick = e => {
            e.stopPropagation(); deleteFolder(name);
        };
        list.appendChild(li);
    });

    updateHeaderValue();
}

// ── CRUD CARPETAS ──────────────────────────────────────────────
export function createFolder() {
    const name = prompt(t('new_folder_prompt'));
    if (!name?.trim()) return;
    const trimmed = name.trim();
    if (state.folders[trimmed] !== undefined) {
        showToast(t('folder_exists'), 'warning'); return;
    }
    state.folders[trimmed] = [];
    saveToStorage();
    renderFolderSidebar();
    showToast(t('toast_folder_created', { name: trimmed }), 'success');
}

function deleteFolder(name) {
    if (!confirm(t('confirm_delete_folder', { name }))) return;
    delete state.folders[name];
    if (state.activeFolderFilter === name) state.activeFolderFilter = '';
    saveToStorage();
    renderFolderSidebar();
    handleFilters();
    showToast(t('toast_folder_deleted', { name }), 'info');
}

function renameFolder(oldName) {
    const newName = prompt(t('rename_folder_prompt', { name: oldName }), oldName);
    if (!newName?.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    if (state.folders[trimmed] !== undefined) {
        showToast(t('folder_exists'), 'warning'); return;
    }
    state.folders[trimmed] = state.folders[oldName];
    delete state.folders[oldName];
    if (state.activeFolderFilter === oldName) state.activeFolderFilter = trimmed;
    saveToStorage();
    renderFolderSidebar();
    handleFilters();
    showToast(t('toast_folder_renamed', { name: trimmed }), 'success');
}

// ── FILTROS & RENDER ───────────────────────────────────────────
export function handleFilters() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const sort  = document.getElementById('sort-filter').value;
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
    if (sort === 'price-asc')  cards = [...cards].sort((a, b) => a.price - b.price);
    if (sort === 'name-asc')   cards = [...cards].sort((a, b) => a.name.localeCompare(b.name));

    renderCards(cards);
}

export function renderCards(cards) {
    const grid = document.getElementById('card-grid');
    grid.innerHTML = '';
    let totalVal = 0, totalCount = 0;

    if (!cards?.length) {
        const isEmpty = getAllCards().length === 0;
        grid.innerHTML = `
      <div class="empty-state">
        <div class="text-5xl mb-4">${isEmpty ? '📦' : '🔍'}</div>
        <h2 class="text-lg font-bold text-slate-400 mb-2">
          ${isEmpty ? t('empty_collection_title') : t('empty_no_match')}
        </h2>
        <p class="text-sm text-slate-500">${isEmpty ? t('empty_create_folder') : ''}</p>
      </div>`;
        document.getElementById('total-cards').textContent = '0';
        document.getElementById('total-value').textContent = '0.00 €';
        return;
    }

    cards.forEach(card => {
        const qty = card.quantity || 1;
        totalVal   += (card.price || 0) * qty;
        totalCount += qty;

        const cmHref = card.cardmarketUrl
            || `https://www.cardmarket.com/es/Magic/Products/Search?searchString=${encodeURIComponent(card.name)}`;
        const priceDisplay = card.price > 0 ? `${(card.price * qty).toFixed(2)} €` : t('price_na');
        const priceLabel   = (card.isFoil ? `${t('foil_label')} · ` : '') +
            (qty > 1 ? `${card.price.toFixed(2)}€/u · ` : '') + t('price_source');

        const el = document.createElement('div');
        el.className = 'mtg-card-item';
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', card.name);
        el.innerHTML = `
      <div class="card-image-wrapper">
        ${card.imageUrl
            ? `<img src="${esc(card.imageUrl)}" alt="${esc(card.name)}" loading="lazy">`
            : `<div class="card-placeholder">🃏</div>`}
        ${card.isFoil ? `<span class="foil-badge">${t('foil_label')}</span>` : ''}
        ${qty > 1    ? `<span class="qty-badge">×${qty}</span>` : ''}
      </div>
      <div class="flex flex-col flex-1">
        <div class="flex items-start justify-between gap-1 mb-1">
          <span class="text-sm font-semibold leading-snug line-clamp-2">${esc(card.name)}</span>
          ${card.set ? `<span class="text-[10px] font-bold uppercase tracking-wide bg-white/8 px-1.5 py-0.5 rounded flex-shrink-0 text-slate-300">${esc(card.set)}</span>` : ''}
        </div>
        <div class="mt-auto pt-2">
          <div class="text-base font-extrabold text-emerald-400 tabular-nums">${priceDisplay}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">${priceLabel}</div>
        </div>
        <a class="cardmarket-link mt-2 block text-center text-xs font-semibold text-white bg-sky-500 hover:bg-sky-600 transition-colors py-1.5 rounded-md"
           href="${esc(cmHref)}" target="_blank" rel="noopener"
           onclick="event.stopPropagation()">
          ${t('price_source')} ↗
        </a>
      </div>`;

        el.addEventListener('click', () => openCardModal(card));
        el.addEventListener('keydown', e => { if (e.key === 'Enter') openCardModal(card); });
        grid.appendChild(el);
    });

    document.getElementById('total-cards').textContent = totalCount;
    document.getElementById('total-value').textContent  = totalVal.toFixed(2) + ' €';
    updateHeaderValue();
}

export function updateHeaderValue() {
    const val = getAllCards().reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);
    document.getElementById('header-total-value').textContent = val.toFixed(2) + ' €';
}
