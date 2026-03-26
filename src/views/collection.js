import {state} from '../core/state.js';
import {t} from '../i18n/index.js';
import {saveToStorage} from '../core/storage.js';
import {showToast} from '../utils/ui.js';

const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── HELPERS ───────────────────────────────────────────────────
export function getAllCards() {
    return Object.values(state.folders).flat();
}

function findCardFolder(card) {
    return Object.entries(state.folders)
        .find(([, cards]) => cards.includes(card))?.[0] ?? null;
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
      <span>📁</span>
      <span class="folder-nav-name">${esc(name)}</span>
      <span class="folder-nav-count">${qty}</span>
      <span class="folder-actions">
        <button class="folder-action-btn import-btn" title="${t('import_csv')}">⬆</button>
        <button class="folder-action-btn rename-btn" title="${t('rename')}">✏️</button>
        <button class="folder-action-btn delete-btn" title="${t('delete')}">🗑</button>
      </span>`;

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

    updateHeaderValue();
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
      <div class="empty-state">
        <div class="text-5xl mb-4">${isEmpty ? '📦' : '🔍'}</div>
        <h2 class="text-lg font-bold text-slate-400 mb-2">
          ${isEmpty ? t('empty_collection_title') : t('empty_no_match')}
        </h2>
        <p class="text-sm text-slate-500">${isEmpty ? t('empty_create_folder') : ''}</p>
      </div>`;
        document.getElementById('total-cards').textContent = '0';
        document.getElementById('total-value').textContent = '0.00 €';
        updateHeaderValue();
        return;
    }

    cards.forEach(card => {
        const qty = card.quantity || 1;
        totalVal += (card.price || 0) * qty;
        totalCount += qty;

        const el = buildCardElement(card);
        grid.appendChild(el);
    });

    document.getElementById('total-cards').textContent = totalCount;
    document.getElementById('total-value').textContent = totalVal.toFixed(2) + ' €';
    updateHeaderValue();
}

// ── BUILD CARD ELEMENT ────────────────────────────────────────
function buildCardElement(card) {
    const qty = card.quantity || 1;
    const price = card.price || 0;
    const total = price > 0 ? `${(price * qty).toFixed(2)} €` : t('price_na');
    const cmHref = card.cardmarketUrl
        || `https://www.cardmarket.com/es/Magic/Products/Search?searchString=${encodeURIComponent(card.name)}`;

    const CONDITION_COLOR = {
        NM: 'text-emerald-400', LP: 'text-sky-400',
        MP: 'text-yellow-400', HP: 'text-orange-400', DMG: 'text-red-400'
    };

    const el = document.createElement('div');
    el.className = 'mtg-card-item group';

    el.innerHTML = `
    <!-- Imagen + overlay acciones -->
    <div class="card-image-wrapper cursor-pointer" data-action="view">
      ${card.imageUrl
        ? `<img src="${esc(card.imageUrl)}" alt="${esc(card.name)}" loading="lazy">`
        : `<div class="card-placeholder">🃏</div>`}
      ${card.isFoil ? `<span class="foil-badge">${t('foil_label')}</span>` : ''}
      ${qty > 1 ? `<span class="qty-badge">×${qty}</span>` : ''}

      <!-- Overlay con acciones (aparece al hover) -->
      <div class="card-img-overlay">
        <button class="card-overlay-btn" data-action="edit">
          ✏️ ${t('edit')}
        </button>
        <button class="card-overlay-btn danger" data-action="delete">
          🗑️ ${t('delete')}
        </button>
      </div>
    </div>

    <!-- Info -->
    <div class="flex flex-col flex-1 min-h-0">

      <!-- Nombre + set -->
      <div class="flex items-start justify-between gap-1 mb-1">
        <span class="text-sm font-semibold leading-snug line-clamp-2">${esc(card.name)}</span>
        ${card.set ? `<span class="text-[10px] font-bold uppercase tracking-wide bg-white/8 px-1.5 py-0.5 rounded flex-shrink-0 text-slate-300">${esc(card.set)}</span>` : ''}
      </div>

      <!-- Condición -->
      ${card.condition ? `
        <span class="text-[10px] font-semibold ${CONDITION_COLOR[card.condition] ?? 'text-slate-400'} mb-1">
          ● ${esc(card.condition)}
        </span>` : ''}

      <!-- Controles de cantidad -->
      <div class="qty-controls">
        <button class="qty-btn" data-action="minus" title="−" ${qty <= 1 ? 'disabled' : ''}>−</button>
        <span class="qty-display">${qty}</span>
        <button class="qty-btn" data-action="plus" title="+">+</button>
      </div>

      <!-- Precio total -->
      <div class="mt-auto pt-1.5">
        <div class="text-base font-extrabold text-emerald-400 tabular-nums card-price-total">
          ${total}
        </div>
        ${price > 0 && qty > 1
        ? `<div class="text-[10px] text-slate-400">${price.toFixed(2)}€ × ${qty} · ${t('price_source')}</div>`
        : `<div class="text-[10px] text-slate-400">${card.isFoil ? t('foil_label') + ' · ' : ''}${t('price_source')}</div>`}
      </div>

      <!-- Link Cardmarket -->
      <a class="mt-2 block text-center text-xs font-semibold text-white
                bg-sky-500 hover:bg-sky-600 transition-colors py-1.5 rounded-md"
         href="${esc(cmHref)}" target="_blank" rel="noopener"
         onclick="event.stopPropagation()">
        ${t('price_source')} ↗
      </a>
    </div>`;

    // ── Event listeners ───────────────────────────────────────
    // Ver detalle al hacer click en la imagen
    el.querySelector('[data-action="view"]').addEventListener('click', () => {
        openCardModal(card);
    });

    // Editar
    el.querySelector('[data-action="edit"]').addEventListener('click', e => {
        e.stopPropagation();
        openEditCardModal(card, el);
    });

    // Eliminar
    el.querySelector('[data-action="delete"]').addEventListener('click', e => {
        e.stopPropagation();
        deleteCard(card, el);
    });

    // Cantidad −
    el.querySelector('[data-action="minus"]').addEventListener('click', e => {
        e.stopPropagation();
        updateCardQty(card, el, -1);
    });

    // Cantidad +
    el.querySelector('[data-action="plus"]').addEventListener('click', e => {
        e.stopPropagation();
        updateCardQty(card, el, +1);
    });

    return el;
}

// ── CRUD CARTAS ───────────────────────────────────────────────

/** Actualiza cantidad sin re-render completo */
function updateCardQty(card, cardEl, delta) {
    const current = card.quantity || 1;
    const next = Math.max(1, Math.min(99, current + delta));
    if (next === current) return;

    card.quantity = next;

    // Actualizar DOM directamente (sin re-render)
    const qtyDisplay = cardEl.querySelector('.qty-display');
    const qtyBadge = cardEl.querySelector('.qty-badge');
    const priceTotal = cardEl.querySelector('.card-price-total');
    const minusBtn = cardEl.querySelector('[data-action="minus"]');

    if (qtyDisplay) qtyDisplay.textContent = next;
    if (qtyBadge) {
        qtyBadge.textContent = `×${next}`;
        qtyBadge.style.display = next > 1 ? '' : 'none';
    }
    if (priceTotal && card.price > 0) {
        priceTotal.textContent = `${(card.price * next).toFixed(2)} €`;
    }
    if (minusBtn) minusBtn.disabled = next <= 1;

    saveToStorage();
    renderFolderSidebar(); // actualiza contadores sidebar
    updateHeaderValue();
}

/** Elimina una carta de su carpeta */
function deleteCard(card, cardEl) {
    const folderName = findCardFolder(card);
    if (!folderName) return;
    if (!confirm(t('confirm_delete_card', {name: card.name}))) return;

    state.folders[folderName] = state.folders[folderName].filter(c => c !== card);

    // Animación de salida antes de eliminar del DOM
    cardEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    cardEl.style.opacity = '0';
    cardEl.style.transform = 'scale(0.9)';
    setTimeout(() => {
        cardEl.remove();
        // Si el grid quedó vacío, re-render para mostrar empty state
        if (!document.getElementById('card-grid').children.length) handleFilters();
    }, 250);

    saveToStorage();
    renderFolderSidebar();
    updateHeaderValue();
    showToast(t('toast_card_deleted', {name: card.name}), 'info');
}

/** Abre modal de edición */
function openEditCardModal(card) {
    const modal = document.getElementById('card-modal');
    const body = document.getElementById('modal-body');
    const folderName = findCardFolder(card);

    const CONDITIONS = [
        {val: 'NM', label: 'NM — Near Mint', color: 'text-emerald-400'},
        {val: 'LP', label: 'LP — Lightly Played', color: 'text-sky-400'},
        {val: 'MP', label: 'MP — Moderately Played', color: 'text-yellow-400'},
        {val: 'HP', label: 'HP — Heavily Played', color: 'text-orange-400'},
        {val: 'DMG', label: 'DMG — Damaged', color: 'text-red-400'},
    ];

    body.innerHTML = `
    <!-- Cabecera -->
    <div class="flex items-start gap-4 mb-5">
      ${card.imageUrl
        ? `<img src="${esc(card.imageUrl)}" alt="${esc(card.name)}"
               class="w-16 rounded-lg shadow-lg flex-shrink-0 object-cover"
               style="aspect-ratio:2.5/3.5">`
        : '<div class="w-16 aspect-[2.5/3.5] bg-slate-700 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl opacity-30">🃏</div>'}
      <div>
        <h2 class="text-xl font-extrabold leading-tight">${esc(card.name)}</h2>
        <p class="text-sm text-slate-400 mt-0.5">${t('editing_card')}</p>
      </div>
    </div>

    <form id="edit-card-form" class="flex flex-col gap-4">

      <!-- Fila 1: Carpeta + Cantidad -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
            ${t('modal_folder')}
          </label>
          <select id="edit-folder" class="input-glass w-full">
            ${Object.keys(state.folders).map(n =>
        `<option value="${esc(n)}" ${n === folderName ? 'selected' : ''}>${esc(n)}</option>`
    ).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
            ${t('modal_quantity')}
          </label>
          <div class="flex items-center gap-2">
            <button type="button" id="modal-qty-minus"
              class="w-9 h-9 rounded-lg bg-white/8 hover:bg-white/15 transition-colors font-bold text-lg flex-shrink-0 flex items-center justify-center">−</button>
            <input type="number" id="edit-qty"
              value="${card.quantity || 1}" min="1" max="99"
              class="input-glass flex-1 text-center font-bold">
            <button type="button" id="modal-qty-plus"
              class="w-9 h-9 rounded-lg bg-white/8 hover:bg-white/15 transition-colors font-bold text-lg flex-shrink-0 flex items-center justify-center">+</button>
          </div>
        </div>
      </div>

      <!-- Fila 2: Condición + Precio -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
            ${t('modal_condition')}
          </label>
          <select id="edit-condition" class="input-glass w-full">
            ${CONDITIONS.map(c =>
        `<option value="${c.val}" ${card.condition === c.val ? 'selected' : ''}>${c.label}</option>`
    ).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
            ${t('modal_price_unit')} (€)
          </label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-sm">€</span>
            <input type="number" id="edit-price"
              value="${card.price > 0 ? card.price.toFixed(2) : ''}"
              min="0" step="0.01" placeholder="0.00"
              class="input-glass w-full pl-7">
          </div>
        </div>
      </div>

      <!-- Foil toggle -->
      <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-white/4 hover:bg-white/7 transition-colors border border-white/8">
        <div class="relative flex-shrink-0">
          <input type="checkbox" id="edit-foil" ${card.isFoil ? 'checked' : ''} class="sr-only peer">
          <div class="w-10 h-5 bg-slate-600 peer-checked:bg-sky-500 rounded-full transition-colors"></div>
          <div class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow"></div>
        </div>
        <div>
          <span class="text-sm font-semibold">✨ Foil</span>
          <p class="text-xs text-slate-400">${t('foil_price_note')}</p>
        </div>
      </label>

      <!-- Notas opcionales -->
      <div>
        <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
          ${t('notes')} <span class="text-slate-600 font-normal normal-case">(${t('optional')})</span>
        </label>
        <textarea id="edit-notes" rows="2"
          class="input-glass w-full resize-none"
          placeholder="${t('notes_placeholder')}">${esc(card.notes ?? '')}</textarea>
      </div>

      <!-- Botones -->
      <div class="flex gap-3 pt-1">
        <button type="button" id="edit-cancel"
          class="flex-1 py-2.5 rounded-lg text-sm font-semibold
                 bg-white/8 hover:bg-white/15 transition-colors">
          ${t('cancel')}
        </button>
        <button type="submit"
          class="flex-1 btn-primary">
          💾 ${t('save_changes')}
        </button>
      </div>

    </form>`;

    // Mostrar modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    document.getElementById('edit-foil').addEventListener('change', e => {
        const priceInput = document.getElementById('edit-price');
        if (e.target.checked && card.priceFoil > 0) {
            priceInput.value = card.priceFoil.toFixed(2);
        } else if (!e.target.checked && card.priceNormal > 0) {
            priceInput.value = card.priceNormal.toFixed(2);
        }
    });

    // Botones +/- del modal
    const qtyInput = document.getElementById('edit-qty');
    document.getElementById('modal-qty-minus').addEventListener('click', () => {
        const v = parseInt(qtyInput.value, 10);
        if (v > 1) qtyInput.value = v - 1;
    });
    document.getElementById('modal-qty-plus').addEventListener('click', () => {
        const v = parseInt(qtyInput.value, 10);
        if (v < 99) qtyInput.value = v + 1;
    });

    document.getElementById('edit-cancel').addEventListener('click', closeCardModal);

    // Submit
    document.getElementById('edit-card-form').addEventListener('submit', e => {
        e.preventDefault();

        const newFolder = document.getElementById('edit-folder').value;
        const newQty = Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1));
        const newCondition = document.getElementById('edit-condition').value;
        const newPrice = parseFloat(document.getElementById('edit-price').value) || 0;
        const newFoil = document.getElementById('edit-foil').checked;
        const newNotes = document.getElementById('edit-notes').value.trim();

        // Mover de carpeta si cambió
        if (newFolder !== folderName && state.folders[newFolder]) {
            state.folders[folderName] = state.folders[folderName].filter(c => c !== card);
            state.folders[newFolder].push(card);
        }

        // Actualizar propiedades (por referencia)
        card.quantity = newQty;
        card.condition = newCondition;
        card.price = newPrice;
        card.isFoil = newFoil;
        card.notes = newNotes || undefined;

        saveToStorage();
        closeCardModal();
        renderFolderSidebar();
        handleFilters();
        showToast(t('toast_card_updated', {name: card.name}), 'success');
    });
}

/** Abre modal de detalle (solo lectura) */
export function openCardModal(card) {
    const modal = document.getElementById('card-modal');
    const body = document.getElementById('modal-body');
    const qty = card.quantity || 1;
    const total = ((card.price || 0) * qty).toFixed(2);
    const cmHref = card.cardmarketUrl
        || `https://www.cardmarket.com/es/Magic/Products/Search?searchString=${encodeURIComponent(card.name)}`;
    const folderName = findCardFolder(card) ?? '—';

    const CONDITION_COLOR = {
        NM: 'text-emerald-400',
        LP: 'text-sky-400',
        MP: 'text-yellow-400',
        HP: 'text-orange-400',
        DMG: 'text-red-400'
    };

    const rows = [
        card.set && [t('modal_set'), `<strong>${esc(card.set)}</strong>`],
        card.condition && [t('modal_condition'), `<strong class="${CONDITION_COLOR[card.condition] ?? ''}">${esc(card.condition)}</strong>`],
        [t('modal_quantity'), `<strong>${qty}</strong>`],
        [t('modal_price_unit'), card.price > 0
            ? `<strong class="text-emerald-400">${card.price.toFixed(2)} €</strong>`
            : `<span class="text-slate-500">${t('price_na')}</span>`],
        [t('modal_total'), card.price > 0
            ? `<strong class="text-emerald-400">${total} €</strong>`
            : `<span class="text-slate-500">${t('price_na')}</span>`],
        [t('modal_folder'), `<strong>${esc(folderName)}</strong>`],
        card.notes && [t('notes'), `<span class="text-slate-300 italic">${esc(card.notes)}</span>`],
    ].filter(Boolean);

    body.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-5">
      <div class="flex-shrink-0 mx-auto sm:mx-0 w-44">
        ${card.imageUrl
        ? `<img src="${esc(card.imageUrl)}" alt="${esc(card.name)}" class="w-full rounded-xl shadow-2xl">`
        : `<div class="w-44 aspect-[2.5/3.5] bg-slate-700 rounded-xl flex items-center justify-center text-5xl opacity-20">🃏</div>`}
      </div>
      <div class="flex-1 flex flex-col gap-3 min-w-0">
        <div>
          <h2 class="text-xl font-extrabold leading-tight">${esc(card.name)}</h2>
          ${card.isFoil ? `<span class="foil-badge relative static inline-block mt-1">${t('foil_label')}</span>` : ''}
        </div>
        <table class="w-full text-sm">
          <tbody>
            ${rows.map(([label, val]) => `
              <tr class="border-b border-white/5">
                <td class="py-1.5 text-slate-400 pr-4 w-2/5">${label}</td>
                <td class="py-1.5">${val}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div class="flex gap-2 mt-auto pt-2">
          <button id="modal-edit-btn"
            class="flex-1 py-2 rounded-lg text-sm font-semibold bg-sky-400/15 text-sky-400 border border-sky-400/30 hover:bg-sky-400/25 transition-colors">
            ✏️ ${t('edit')}
          </button>
          <button id="modal-delete-btn"
            class="py-2 px-4 rounded-lg text-sm font-semibold bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/25 transition-colors">
            🗑️
          </button>
          <a href="${esc(cmHref)}" target="_blank" rel="noopener"
             class="flex-1 btn-primary text-sm text-center block py-2">
            ${t('price_source')} ↗
          </a>
        </div>
      </div>
    </div>`;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Botón editar desde modal de detalle
    document.getElementById('modal-edit-btn').addEventListener('click', () => {
        closeCardModal();
        setTimeout(() => openEditCardModal(card), 50);
    });

    // Botón eliminar desde modal de detalle
    document.getElementById('modal-delete-btn').addEventListener('click', () => {
        closeCardModal();
        setTimeout(() => {
            if (confirm(t('confirm_delete_card', {name: card.name}))) {
                const folderN = findCardFolder(card);
                if (!folderN) return;
                state.folders[folderN] = state.folders[folderN].filter(c => c !== card);
                saveToStorage();
                renderFolderSidebar();
                handleFilters();
                updateHeaderValue();
                showToast(t('toast_card_deleted', {name: card.name}), 'info');
            }
        }, 100);
    });
}

export function closeCardModal() {
    const modal = document.getElementById('card-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ── HEADER VALUE ──────────────────────────────────────────────
export function updateHeaderValue() {
    const val = getAllCards()
        .reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);
    const el = document.getElementById('header-total-value');
    if (el) el.textContent = val.toFixed(2) + ' €';
}
