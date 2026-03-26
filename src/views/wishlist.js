import {t} from '../i18n/index.js';
import {deleteWishlistItem, getWishlist, saveWishlistItem} from '../core/db.js';
import * as SF from '../api/scryfall.js';

// ── Estado local ──────────────────────────────────────────────
let _items = [];        // WishlistItem[]
let _filter = 'all';     // 'all' | 'high' | 'medium' | 'low'
let _search = '';        // búsqueda por nombre

// ── Modelo ────────────────────────────────────────────────────
/**
 * @typedef {{
 *   id:           string,
 *   name:         string,
 *   scryfallId:   string,
 *   imageUrl:     string,
 *   set:          string,
 *   setName:      string,
 *   type_line:    string,
 *   mana_cost:    string,
 *   quantity:     number,
 *   targetPrice:  number,
 *   currentPrice: number,
 *   priority:     'high'|'medium'|'low',
 *   notes:        string,
 *   addedAt:      string,
 * }} WishlistItem
 */

const PRIORITY = {
    high: {label: t('priority_high'), icon: '🔴', cls: 'priority-high'},
    medium: {label: t('priority_medium'), icon: '🟡', cls: 'priority-medium'},
    low: {label: t('priority_low'), icon: '🟢', cls: 'priority-low'},
};

// ── INIT ──────────────────────────────────────────────────────
export async function initWishlist() {
    _items = await getWishlist();
    _bindTopBar();
    renderWishlist();
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────
export function renderWishlist() {
    const filtered = _filtered();
    const total = _total();
    const inPrice = _items.filter(_isInPrice).length;

    // Stats
    document.getElementById('wl-total-val').textContent = `${total.toFixed(2)} €`;
    document.getElementById('wl-count').textContent = _items.length;
    document.getElementById('wl-in-price').textContent = inPrice;

    // Lista
    const list = document.getElementById('wl-list');
    if (!list) return;

    if (!filtered.length) {
        list.innerHTML = `
      <div class="wl-empty">
        <span class="text-3xl">💭</span>
        <p>${_items.length ? t('wl_no_results') : t('wl_empty')}</p>
      </div>`;
        return;
    }

    list.innerHTML = '';
    filtered.forEach(item => list.appendChild(_buildCard(item)));
}

// ── CONSTRUCCIÓN DE TARJETA ───────────────────────────────────
function _buildCard(item) {
    const inPrice = _isInPrice(item);
    const diff = item.currentPrice > 0
        ? item.currentPrice - item.targetPrice
        : null;
    const pct = (item.currentPrice > 0 && item.targetPrice > 0)
        ? ((item.currentPrice / item.targetPrice - 1) * 100)
        : null;
    const p = PRIORITY[item.priority] ?? PRIORITY.medium;
    const totalEst = (item.targetPrice || 0) * (item.quantity || 1);
    const totalCurr = (item.currentPrice || 0) * (item.quantity || 1);

    const el = document.createElement('div');
    el.className = `wl-card${inPrice ? ' wl-card--deal' : ''}`;
    el.dataset.id = item.id;

    el.innerHTML = `
    <!-- Imagen -->
    <div class="wl-card-img">
      ${item.imageUrl
        ? `<img src="${_esc(item.imageUrl)}" alt="${_esc(item.name)}" loading="lazy">`
        : '<div class="wl-img-placeholder">🃏</div>'}
      ${inPrice ? '<div class="wl-deal-badge">🎯 EN PRECIO</div>' : ''}
    </div>

    <!-- Cuerpo -->
    <div class="wl-card-body">

      <!-- Cabecera -->
      <div class="wl-card-header">
        <div class="min-w-0">
          <div class="wl-card-name">${_esc(item.name)}</div>
          <div class="wl-card-meta">
            ${item.set ? `<span class="wl-set-badge">${_esc(item.set)}</span>` : ''}
            <span class="text-slate-500 text-[10px]">${_esc(item.type_line ?? '')}</span>
          </div>
        </div>
        <!-- Prioridad selector -->
        <select class="wl-priority-sel ${p.cls}" data-field="priority">
          ${Object.entries(PRIORITY).map(([k, v]) =>
        `<option value="${k}" ${item.priority === k ? 'selected' : ''}>
               ${v.icon} ${v.label}
             </option>`
    ).join('')}
        </select>
      </div>

      <!-- Precios -->
      <div class="wl-prices">

        <!-- Precio objetivo -->
        <div class="wl-price-block">
          <label class="wl-price-label">${t('wl_target_price')}</label>
          <div class="wl-price-input-wrap">
            <input type="number" class="wl-price-input" data-field="targetPrice"
              min="0" step="0.01"
              value="${item.targetPrice > 0 ? item.targetPrice.toFixed(2) : ''}">
            <span class="wl-currency">€</span>
          </div>
        </div>

        <!-- Precio actual -->
        <div class="wl-price-block">
          <label class="wl-price-label">${t('wl_current_price')}</label>
          <div class="wl-current-price ${inPrice ? 'text-emerald-400' : 'text-slate-300'}">
            ${item.currentPrice > 0
        ? `${item.currentPrice.toFixed(2)} €`
        : `<span class="text-slate-600">—</span>`}
          </div>
          ${diff !== null && pct !== null ? `
          <div class="wl-diff ${diff <= 0 ? 'text-emerald-400' : 'text-red-400'}">
            ${diff <= 0 ? '▼' : '▲'} ${Math.abs(diff).toFixed(2)} €
            (${pct > 0 ? '+' : ''}${pct.toFixed(0)}%)
          </div>` : ''}
        </div>

        <!-- Cantidad -->
        <div class="wl-price-block">
          <label class="wl-price-label">${t('quantity')}</label>
          <input type="number" class="wl-qty-input" data-field="quantity"
            min="1" step="1" value="${item.quantity ?? 1}">
        </div>

        <!-- Total estimado -->
        <div class="wl-price-block">
          <label class="wl-price-label">${t('wl_total_est')}</label>
          <div class="text-xs font-bold text-slate-300 tabular-nums">
            ${totalEst > 0 ? `${totalEst.toFixed(2)} €` : '—'}
            ${totalCurr > 0 && totalCurr !== totalEst
        ? `<span class="text-[10px] ${inPrice ? 'text-emerald-500' : 'text-slate-500'}">
                   / ${totalCurr.toFixed(2)} €
                 </span>`
        : ''}
          </div>
        </div>

      </div>

      <!-- Notas -->
      <input type="text" class="wl-notes-input" data-field="notes"
        placeholder="${t('wl_notes_placeholder')}"
        value="${_esc(item.notes ?? '')}">

    </div>

    <!-- Acciones -->
    <div class="wl-card-actions">
      <button class="wl-btn-refresh" title="${t('wl_refresh_price')}">🔄</button>
      <button class="wl-btn-delete"  title="${t('wl_delete')}">🗑️</button>
    </div>`;

    // ── Eventos ────────────────────────────────────────────────

    // Cambio en campos editables (debounce 600ms)
    let _saveTimer;
    el.querySelectorAll('[data-field]').forEach(input => {
        input.addEventListener('change', () => {
            clearTimeout(_saveTimer);
            _saveTimer = setTimeout(() => _saveField(item.id, input), 600);
        });
        input.addEventListener('input', () => {
            clearTimeout(_saveTimer);
            _saveTimer = setTimeout(() => _saveField(item.id, input), 600);
        });
    });

    // Refrescar precio individual
    el.querySelector('.wl-btn-refresh')?.addEventListener('click', async () => {
        const btn = el.querySelector('.wl-btn-refresh');
        btn.textContent = '⏳';
        btn.disabled = true;
        await _refreshItemPrice(item.id);
        btn.textContent = '🔄';
        btn.disabled = false;
    });

    // Eliminar
    el.querySelector('.wl-btn-delete')?.addEventListener('click', () => {
        _deleteItem(item.id);
    });

    return el;
}

// ── GUARDAR CAMPO EDITADO ─────────────────────────────────────
async function _saveField(id, input) {
    const item = _items.find(i => i.id === id);
    if (!item) return;

    const field = input.dataset.field;
    let val = input.value;

    if (field === 'targetPrice') val = parseFloat(val) || 0;
    if (field === 'quantity') val = Math.max(1, parseInt(val, 10) || 1);

    item[field] = val;
    await saveWishlistItem(item);
    renderWishlist();
}

// ── REFRESCAR PRECIO INDIVIDUAL ───────────────────────────────
async function _refreshItemPrice(id) {
    const item = _items.find(i => i.id === id);
    if (!item) return;

    try {
        let card;
        if (item.scryfallId) {
            card = await SF.fetchById(item.scryfallId);
        } else {
            const res = await SF.search(`!"${item.name}"`, 1);
            card = res?.data?.[0] ?? null;
        }
        if (!card) return;

        const prices = SF.getPrices(card);
        item.currentPrice = item.isFoil ? (prices.eur_foil || prices.eur || 0) : (prices.eur || 0);
        item.imageUrl = SF.getImageUri(card, 'small') || item.imageUrl;

        await saveWishlistItem(item);
        renderWishlist();
    } catch (e) {
        console.warn('[Wishlist] Error refreshing price:', e);
    }
}

// ── REFRESCAR TODOS LOS PRECIOS ───────────────────────────────
export async function refreshAllPrices() {
    const btn = document.getElementById('wl-btn-refresh-all');
    if (btn) {
        btn.disabled = true;
        btn.textContent = `⏳ ${t('wl_refreshing')}`;
    }

    // En tandas de 5 para no saturar la API
    const BATCH = 5;
    for (let i = 0; i < _items.length; i += BATCH) {
        await Promise.allSettled(
            _items.slice(i, i + BATCH).map(item => _refreshItemPrice(item.id))
        );
        // Pausa entre tandas para respetar el rate limit de Scryfall
        if (i + BATCH < _items.length) await _sleep(200);
    }

    if (btn) {
        btn.disabled = false;
        btn.textContent = `🔄 ${t('wl_refresh_all')}`;
    }
    renderWishlist();
}

// ── AÑADIR CARTA (llamado desde búsqueda externa) ─────────────
export async function addToWishlist(card) {
    // Evitar duplicados por scryfallId o nombre
    const exists = _items.find(i =>
        (card.id && i.scryfallId === card.id) ||
        i.name.toLowerCase() === (card.name ?? '').toLowerCase()
    );
    if (exists) {
        _openEditModal(exists.id);
        return;
    }

    const prices = SF.getPrices(card);

    const item = {
        id: crypto.randomUUID(),
        name: card.name ?? '',
        scryfallId: card.id ?? '',
        imageUrl: SF.getImageUri(card, 'small') ?? '',
        set: (card.set ?? '').toUpperCase(),
        setName: card.set_name ?? '',
        type_line: card.type_line ?? '',
        mana_cost: card.mana_cost ?? '',
        quantity: 1,
        targetPrice: 0,
        currentPrice: prices.eur ?? 0,
        priority: 'medium',
        notes: '',
        addedAt: new Date().toISOString(),
    };

    _items.push(item);
    await saveWishlistItem(item);
    renderWishlist();
    _scrollToCard(item.id);
}

// ── ELIMINAR ──────────────────────────────────────────────────
async function _deleteItem(id) {
    _items = _items.filter(i => i.id !== id);
    await deleteWishlistItem(id);
    renderWishlist();
}

// ── MODAL DE EDICIÓN (precio objetivo) ───────────────────────
function _openEditModal(id) {
    const item = _items.find(i => i.id === id);
    if (!item) return;
    // Enfocar el input de precio objetivo del item
    const el = document.querySelector(`.wl-card[data-id="${id}"]`);
    const input = el?.querySelector('[data-field="targetPrice"]');
    if (input) {
        input.focus();
        input.select();
    }
}

// ── BARRA SUPERIOR (filtros + búsqueda) ──────────────────────
function _bindTopBar() {
    // Filtros de prioridad
    document.querySelectorAll('.wl-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _filter = btn.dataset.priority ?? 'all';
            document.querySelectorAll('.wl-filter-btn').forEach(b =>
                b.classList.toggle('active', b === btn)
            );
            renderWishlist();
        });
    });

    // Búsqueda interna
    document.getElementById('wl-search-input')?.addEventListener('input', e => {
        _search = e.target.value.toLowerCase().trim();
        renderWishlist();
    });

    // Botón refrescar todos
    document.getElementById('wl-btn-refresh-all')?.addEventListener('click', refreshAllPrices);

    // Botón añadir carta (abre el panel de búsqueda global con flag)
    document.getElementById('wl-btn-add')?.addEventListener('click', () => {
        // Reutiliza el buscador global que ya tienes,
        // pero en modo "añadir a wishlist" — ajusta según tu implementación
        window.dispatchEvent(new CustomEvent('wl:open-search'));
    });
}

// ── HELPERS ───────────────────────────────────────────────────
function _filtered() {
    return _items.filter(item => {
        const matchPriority = _filter === 'all' || item.priority === _filter;
        const matchSearch = !_search || item.name.toLowerCase().includes(_search);
        return matchPriority && matchSearch;
    }).sort(_sortItems);
}

function _sortItems(a, b) {
    // Primero los que están en precio, luego por prioridad
    const inA = _isInPrice(a) ? 0 : 1;
    const inB = _isInPrice(b) ? 0 : 1;
    if (inA !== inB) return inA - inB;

    const PRIO = {high: 0, medium: 1, low: 2};
    return (PRIO[a.priority] ?? 1) - (PRIO[b.priority] ?? 1);
}

function _isInPrice(item) {
    return item.currentPrice > 0
        && item.targetPrice > 0
        && item.currentPrice <= item.targetPrice;
}

function _total() {
    return _items.reduce((s, i) => s + (i.targetPrice || 0) * (i.quantity || 1), 0);
}

function _scrollToCard(id) {
    setTimeout(() => {
        document.querySelector(`.wl-card[data-id="${id}"]`)
            ?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, 100);
}

function _esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
