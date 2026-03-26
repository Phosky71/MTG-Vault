import {state} from '../core/state.js';
import {t} from '../i18n/index.js';
import {saveToStorage} from '../core/storage.js';
import {showToast} from '../utils/ui.js';
import {renderFolderSidebar, updateHeaderValue} from './collection.js';
import * as SF from '../api/scryfall.js';
import {cacheCards, cacheRulings, cacheSearch, getCachedRulings, getCachedSearch} from '../core/db.js';
import { addToWishlist } from './wishlist.js';

const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── ESTADO LOCAL ──────────────────────────────────────────────
let _query = '';
let _page = 1;
let _hasMore = false;
let _loading = false;
let _timer = null;

// ── INIT ──────────────────────────────────────────────────────
export function initSearchView() {
    // Búsqueda libre — debounce 380ms
    document.getElementById('sf-search-input')
        .addEventListener('input', e => {
            clearTimeout(_timer);
            const q = e.target.value.trim();
            _timer = setTimeout(() => {
                if (q.length >= 2) doSearch(q, 1);
                else if (!q) renderEmpty();
            }, 380);
        });

    // Filtros que re-ejecutan la búsqueda actual
    ['sf-type-input'].forEach(id =>
        document.getElementById(id).addEventListener('input', () => {
            clearTimeout(_timer);
            _timer = setTimeout(() => {
                if (_query) doSearch(_query, 1);
            }, 380);
        })
    );
    ['sf-format-select', 'sf-sort-select'].forEach(id =>
        document.getElementById(id).addEventListener('change', () => {
            if (_query) doSearch(_query, 1);
        })
    );

    // Botones de color
    document.querySelectorAll('.sf-color-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            btn.classList.toggle('sf-color-active');
            if (_query) doSearch(_query, 1);
        })
    );

    // Rango de precio — debounce 600ms (el usuario termina de escribir)
    ['sf-price-min', 'sf-price-max'].forEach(id =>
        document.getElementById(id).addEventListener('input', () => {
            clearTimeout(_timer);
            _timer = setTimeout(() => {
                if (_query) doSearch(_query, 1);
            }, 600);
        })
    );

    // Limpiar todos los filtros
    document.getElementById('sf-clear-filters').addEventListener('click', clearFilters);

    // Cargar más
    document.getElementById('sf-load-more').addEventListener('click', () => {
        if (_hasMore && !_loading) doSearch(_query, _page + 1, true);
    });

    // Modals
    document.getElementById('sf-modal-close').addEventListener('click', closeSFModal);
    document.getElementById('sf-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeSFModal();
    });

    renderEmpty();
}

// ── CONSTRUIR QUERY SCRYFALL ───────────────────────────────────
function buildQuery(base) {
    let q = base.trim();

    // Colores activos
    const colors = [...document.querySelectorAll('.sf-color-btn.sf-color-active')]
        .map(b => b.dataset.color);
    if (colors.length) q += ` c:${colors.join('')}`;

    // Tipo de carta
    const type = document.getElementById('sf-type-input').value.trim();
    if (type) q += ` t:"${type}"`;

    // Formato legal
    const fmt = document.getElementById('sf-format-select').value;
    if (fmt) q += ` f:${fmt}`;

    // Rango de precio EUR — sintaxis nativa Scryfall [web:50]
    const priceMin = parseFloat(document.getElementById('sf-price-min').value);
    const priceMax = parseFloat(document.getElementById('sf-price-max').value);
    if (!isNaN(priceMin) && priceMin >= 0) q += ` eur>=${priceMin.toFixed(2)}`;
    if (!isNaN(priceMax) && priceMax > 0) q += ` eur<=${priceMax.toFixed(2)}`;

    return q;
}

function getSortParams() {
    const val = document.getElementById('sf-sort-select').value || 'name:asc';
    const [order, dir] = val.split(':');
    return {order, dir};
}

function clearFilters() {
    document.getElementById('sf-type-input').value = '';
    document.getElementById('sf-format-select').value = '';
    document.getElementById('sf-sort-select').value = 'name:asc';
    document.getElementById('sf-price-min').value = '';
    document.getElementById('sf-price-max').value = '';
    document.querySelectorAll('.sf-color-btn.sf-color-active')
        .forEach(b => b.classList.remove('sf-color-active'));
    if (_query) doSearch(_query, 1);
}

// ── BUSCAR ────────────────────────────────────────────────────
async function doSearch(base, page = 1, append = false) {
    if (_loading) return;
    _query = base;
    _page = page;
    _loading = true;

    const grid = document.getElementById('sf-results-grid');
    const info = document.getElementById('sf-results-info');
    const full = buildQuery(base);
    const {order, dir} = getSortParams();

    if (!append) {
        grid.innerHTML = skeletonHTML(10);
        info.textContent = '';
        document.getElementById('sf-load-more').classList.add('hidden');
    } else {
        const sk = document.createElement('div');
        sk.id = 'sf-skels';
        sk.innerHTML = skeletonHTML(8, true);
        grid.appendChild(sk);
    }

    try {
        const cacheKey = `${full}__${order}:${dir}__p${page}`;
        let result = await getCachedSearch(cacheKey);

        if (!result) {
            result = await SF.searchCards(full, {page, order, dir});
            await cacheSearch(cacheKey, result);
            await cacheCards(result.data ?? []);
        }

        document.getElementById('sf-skels')?.remove();
        if (!append) grid.innerHTML = '';

        _hasMore = result.has_more ?? false;

        if (!append && result.total_cards !== undefined) {
            info.textContent = `${result.total_cards.toLocaleString()} ${t('results_found')}`;
        }

        (result.data ?? []).forEach(card => grid.appendChild(buildCardEl(card)));
        document.getElementById('sf-load-more').classList.toggle('hidden', !_hasMore);

    } catch (err) {
        document.getElementById('sf-skels')?.remove();
        if (append) return;

        const isNotFound = err instanceof SF.ScryfallError && err.status === 404;
        const isBadQuery = err instanceof SF.ScryfallError && err.status === 422;

        grid.innerHTML = `
      <div class="empty-state">
        <div class="text-5xl mb-4">${isNotFound || isBadQuery ? '🔍' : '⚠️'}</div>
        <h2 class="text-base font-bold text-slate-400 mb-2">
          ${isNotFound ? t('no_results') : isBadQuery ? t('bad_query') : t('search_error')}
        </h2>
        <p class="text-sm text-slate-500">
          ${isNotFound ? t('try_different_query') : isBadQuery ? t('check_syntax') : t('check_connection')}
        </p>
      </div>`;
        info.textContent = '';
    } finally {
        _loading = false;
    }
}

function renderEmpty() {
    document.getElementById('sf-results-grid').innerHTML = `
    <div class="empty-state">
      <div class="text-5xl mb-4">🔮</div>
      <h2 class="text-base font-bold text-slate-400 mb-2">${t('search_prompt')}</h2>
      <p class="text-sm text-slate-500">${t('search_prompt_sub')}</p>
      <div class="mt-4 flex flex-wrap justify-center gap-2 text-xs">
        ${['t:creature f:modern', 'eur>=10 eur<=30', 'c:U t:instant', 'o:"draw a card" f:pauper']
        .map(ex => `<button class="sf-example-btn px-3 py-1.5 rounded-full bg-slate-700/50 hover:bg-sky-400/15 hover:text-sky-400 border border-white/8 transition-colors cursor-pointer text-slate-300">
            ${esc(ex)}</button>`).join('')}
      </div>
    </div>`;

    // Chips de ejemplo clicables
    document.querySelectorAll('.sf-example-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById('sf-search-input');
            input.value = btn.textContent.trim();
            doSearch(btn.textContent.trim(), 1);
        });
    });

    document.getElementById('sf-results-info').textContent = '';
    document.getElementById('sf-load-more').classList.add('hidden');
}

// ── CARD ELEMENT ──────────────────────────────────────────────
function buildCardEl(card) {
    const img = SF.getImageUri(card, 'normal');
    const prices = SF.getPrices(card);
    const eur = prices.eur > 0 ? `${prices.eur.toFixed(2)} €` : '—';

    const RARITY_COLOR = {
        common: 'text-slate-400',
        uncommon: 'text-slate-300',
        rare: 'text-yellow-400',
        mythic: 'text-orange-400'
    };

    const el = document.createElement('div');
    el.className = 'mtg-card-item';
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', card.name);
    el.innerHTML = `
    <div class="card-image-wrapper">
      ${img
        ? `<img src="${esc(img)}" alt="${esc(card.name)}" loading="lazy">`
        : `<div class="card-placeholder">🃏</div>`}
    </div>
    <div class="flex flex-col flex-1 min-h-0">
      <span class="text-sm font-semibold leading-snug line-clamp-2 mb-1">${esc(card.name)}</span>
      <div class="flex justify-between items-center text-[11px] mb-1">
        <span class="text-slate-400 truncate max-w-[68%]">${esc(card.set_name || '')}</span>
        <span class="${RARITY_COLOR[card.rarity] || 'text-slate-400'} font-bold capitalize flex-shrink-0">
          ${card.rarity?.[0]?.toUpperCase() ?? ''}
        </span>
      </div>
      <div class="mt-auto flex items-baseline justify-between">
        <span class="text-base font-extrabold text-emerald-400 tabular-nums">${eur}</span>
        ${prices.eur_foil > 0
        ? `<span class="text-[10px] text-slate-400">✨ ${prices.eur_foil.toFixed(2)}€</span>`
        : ''}
      </div>
    </div>`;

    el.addEventListener('click', () => openSFModal(card));
    el.addEventListener('keydown', e => {
        if (e.key === 'Enter') openSFModal(card);
    });
    return el;
}

function skeletonHTML(n) {
    return Array.from({length: n}, () => `
    <div class="mtg-card-item animate-pulse">
      <div class="card-image-wrapper bg-slate-700/40"></div>
      <div class="flex flex-col gap-2 mt-2">
        <div class="h-3 bg-slate-700/40 rounded-full w-4/5"></div>
        <div class="h-3 bg-slate-700/40 rounded-full w-1/2"></div>
        <div class="h-4 bg-slate-700/40 rounded-full w-1/3 mt-1"></div>
      </div>
    </div>`).join('');
}

// ── MODAL DETALLE ──────────────────────────────────────────────
async function openSFModal(card) {
    const modal = document.getElementById('sf-modal');
    const body = document.getElementById('sf-modal-body');
    const prices = SF.getPrices(card);
    const faces = SF.getCardFaces(card);
    const cmUrl = card.purchase_uris?.cardmarket ?? '';

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    body.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-6">

      <!-- Imágenes -->
      <div class="flex-shrink-0 flex flex-col gap-2 mx-auto sm:mx-0 w-48">
        ${faces.map(face => {
        const fi = face.image_uris?.normal ?? SF.getImageUri(card, 'normal');
        return fi ? `<img src="${esc(fi)}" alt="${esc(face.name ?? card.name)}" class="w-full rounded-xl shadow-2xl">` : '';
    }).join('')}
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0 flex flex-col gap-4">

        <div>
          <div class="flex items-start justify-between gap-2 mb-0.5">
            <h2 class="text-xl font-extrabold leading-tight">${esc(card.name)}</h2>
            <span class="text-sm text-slate-300 font-mono flex-shrink-0 mt-1">${esc(card.mana_cost ?? '')}</span>
          </div>
          <p class="text-sm text-slate-400">${esc(card.type_line ?? '')}</p>
        </div>

        ${(card.oracle_text || card.card_faces) ? `
          <div class="bg-slate-700/40 rounded-lg p-3 text-sm leading-relaxed border border-white/5">
            ${(card.card_faces || [card]).map(face => `
              ${card.card_faces ? `<p class="font-bold text-xs text-sky-400 mb-1">${esc(face.name ?? '')}</p>` : ''}
              <p class="whitespace-pre-line mb-1">${esc(face.oracle_text ?? card.oracle_text ?? '')}</p>
              ${face.power !== undefined
        ? `<p class="text-slate-400 font-bold text-xs pt-1 border-t border-white/10 mt-1">${esc(face.power)}/${esc(face.toughness)}</p>` : ''}
              ${face.loyalty !== undefined
        ? `<p class="text-slate-400 font-bold text-xs pt-1 border-t border-white/10 mt-1">⚡ ${esc(face.loyalty)}</p>` : ''}
              ${face.flavor_text
        ? `<p class="text-slate-500 italic text-xs mt-2 pt-2 border-t border-white/10">${esc(face.flavor_text)}</p>` : ''}
            `).join('<hr class="border-white/10 my-2">')}
          </div>` : ''}

        <!-- Meta chips -->
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="bg-slate-700/50 px-2 py-1 rounded capitalize">${esc(card.rarity ?? '')}</span>
          <span class="bg-slate-700/50 px-2 py-1 rounded">${esc(card.set_name ?? '')} #${esc(card.collector_number ?? '')}</span>
          ${card.artist ? `<span class="bg-slate-700/50 px-2 py-1 rounded text-slate-400">🎨 ${esc(card.artist)}</span>` : ''}
          ${card.released_at ? `<span class="bg-slate-700/50 px-2 py-1 rounded text-slate-400">📅 ${esc(card.released_at)}</span>` : ''}
        </div>

        <!-- Precios -->
        <div class="flex flex-wrap gap-5 text-sm">
          ${prices.eur > 0 ? `
            <div>
              <span class="text-slate-400 text-xs block mb-0.5">🇪🇺 EUR (Cardmarket)</span>
              <span class="text-emerald-400 font-bold text-lg tabular-nums">${prices.eur.toFixed(2)} €</span>
              ${prices.eur_foil > 0 ? `<span class="text-slate-400 text-xs ml-2">✨ ${prices.eur_foil.toFixed(2)} €</span>` : ''}
            </div>` : ''}
          ${prices.usd > 0 ? `
            <div>
              <span class="text-slate-400 text-xs block mb-0.5">🇺🇸 USD (TCGPlayer)</span>
              <span class="text-green-400 font-bold text-lg tabular-nums">${prices.usd.toFixed(2)} $</span>
              ${prices.usd_foil > 0 ? `<span class="text-slate-400 text-xs ml-2">✨ ${prices.usd_foil.toFixed(2)} $</span>` : ''}
            </div>` : ''}
        </div>

        <!-- Legalidad -->
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">${t('legality')}</p>
          <div class="flex flex-wrap gap-1.5">
            ${SF.FORMATS.map(fmt => {
        const status = card.legalities?.[fmt] ?? 'not_legal';
        return `<span class="text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${SF.legalityClass(status)}">${fmt}</span>`;
    }).join('')}
          </div>
        </div>

        <!-- Rulings -->
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">${t('rulings')}</p>
          <div id="sf-rulings" class="text-sm text-slate-400 italic">${t('loading_rulings')}</div>
        </div>

        <!-- Acciones -->
        <div class="flex flex-col gap-2 mt-auto pt-3 border-t border-white/10">
          ${Object.keys(state.folders).length ? `
            <div class="flex gap-2 items-center">
              <select id="sf-folder-select" class="input-glass flex-1 text-sm">
                ${Object.keys(state.folders).map(n =>
        `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
              </select>
              <label class="flex items-center gap-1.5 text-xs text-slate-400 flex-shrink-0 cursor-pointer">
                <input type="checkbox" id="sf-add-foil" class="accent-sky-400"> ✨ Foil
              </label>
              <button id="sf-add-collection" class="btn-primary text-sm flex-shrink-0">
                + ${t('add_to_collection')}
              </button>
            </div>` : `<p class="text-xs text-slate-500">${t('toast_no_folders')}</p>`}

          ${state.decks.length ? `
            <div class="flex gap-2 items-center">
              <select id="sf-deck-select" class="input-glass flex-1 text-sm">
                ${state.decks.map((d, i) =>
        `<option value="${i}">${esc(d.name)} (${esc(d.format)})</option>`).join('')}
              </select>
              <button id="sf-add-deck"
                class="text-sm flex-shrink-0 py-2.5 px-4 rounded-lg font-semibold
                       bg-purple-400/15 text-purple-400 border border-purple-400/30
                       hover:bg-purple-400/25 transition-colors">
                + ${t('add_to_deck')}
              </button>
            </div>` : `<p class="text-xs text-slate-500">${t('toast_no_decks')}</p>`}
          <!-- Wishlist -->
          <button id="sf-add-wishlist"
                  class="w-full py-2 rounded-lg text-sm font-semibold
                         bg-violet-400/10 border border-violet-400/20 text-violet-300
                         hover:bg-violet-400/20 transition-colors">
              💭 ${t('add_to_wishlist')}
          </button>
          ${cmUrl ? `
            <a href="${esc(cmUrl)}" target="_blank" rel="noopener"
               class="btn-primary text-sm text-center block">
               Cardmarket ↗
            </a>` : ''}
        </div>
      </div>
    </div>`;

    _loadRulings(card.id);

    document.getElementById('sf-add-collection')?.addEventListener('click', () => {
        const folder = document.getElementById('sf-folder-select').value;
        const foil = document.getElementById('sf-add-foil').checked;
        _addToCollection(card, folder, foil);
    });

    document.getElementById('sf-add-deck')?.addEventListener('click', () => {
        const idx = parseInt(document.getElementById('sf-deck-select').value, 10);
        _addToDeck(card, idx);
    });

    document.getElementById('sf-add-wishlist')?.addEventListener('click', () => {
        addToWishlist(card);
        showToast(`💭 ${card.name} ${t('added_to_wishlist')}`, 'success');
    });
}

async function _loadRulings(cardId) {
    const el = document.getElementById('sf-rulings');
    if (!el) return;
    try {
        let rulings = await getCachedRulings(cardId);
        if (!rulings) {
            const res = await SF.getCardRulings(cardId);
            rulings = res.data ?? [];
            await cacheRulings(cardId, rulings);
        }
        if (!document.getElementById('sf-rulings')) return;
        if (!rulings.length) {
            el.textContent = t('no_rulings');
            return;
        }
        el.innerHTML = rulings.map(r => `
      <div class="border-l-2 border-sky-400/30 pl-3 mb-3">
        <p class="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide">
          ${esc(r.published_at)} · ${esc((r.source ?? '').toUpperCase())}
        </p>
        <p class="text-slate-300 leading-relaxed">${esc(r.comment)}</p>
      </div>`).join('');
    } catch {
        if (el) el.textContent = t('rulings_error');
    }
}

function _addToCollection(card, folderName, foil = false) {
    if (!state.folders[folderName]) return;
    const prices = SF.getPrices(card);
    const img = SF.getImageUri(card, 'normal');
    const price = foil
        ? (prices.eur_foil || prices.eur || prices.usd_foil || prices.usd || 0)
        : (prices.eur || prices.usd || 0);

    const existing = state.folders[folderName]
        .find(c => c.scryfallId === card.id && c.isFoil === foil);

    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        state.folders[folderName].push({
            name: card.name,
            quantity: 1,
            price: foil
                ? (prices.eur_foil || prices.eur || prices.usd_foil || prices.usd || 0)
                : (prices.eur || prices.usd || 0),
            priceNormal: prices.eur || prices.usd || 0,   // ← NUEVO
            priceFoil: prices.eur_foil || prices.usd_foil || 0, // ← NUEVO
            set: (card.set ?? '').toUpperCase(),
            isFoil: foil,
            colors: (card.color_identity ?? []).join(''),
            imageUrl: img ?? '',
            cardmarketUrl: card.purchase_uris?.cardmarket ?? '',
            condition: 'NM',
            scryfallId: card.id,
            type_line: card.type_line ?? '',
            mana_cost: card.mana_cost ?? '',
            cmc: card.cmc ?? 0,
        });
    }
    saveToStorage();
    renderFolderSidebar();
    updateHeaderValue();
    showToast(t('toast_added_collection', {name: card.name, folder: folderName}), 'success');
}

function _addToDeck(card, deckIndex) {
    const deck = state.decks[deckIndex];
    if (!deck) return;
    const prices = SF.getPrices(card);
    const img = SF.getImageUri(card, 'normal');

    const existing = deck.cards.find(c => c.scryfallId === card.id);
    if (existing) existing.quantity = (existing.quantity || 1) + 1;
    else deck.cards.push({
        name: card.name, quantity: 1,
        price: prices.eur || prices.usd || 0,
        set: (card.set ?? '').toUpperCase(), isFoil: false,
        colors: (card.color_identity ?? []).join(''),
        imageUrl: img ?? '',
        cardmarketUrl: card.purchase_uris?.cardmarket ?? '',
        scryfallId: card.id,
    });

    saveToStorage();
    showToast(t('toast_added_deck', {name: card.name, deck: deck.name}), 'success');
}

export function closeSFModal() {
    const m = document.getElementById('sf-modal');
    if (m) {
        m.style.display = 'none';
        document.body.style.overflow = '';
    }
}
