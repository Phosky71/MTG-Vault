import { state }          from './state.js';
import { t }              from './i18n.js';
import { saveToStorage }  from './storage.js';
import { showToast }      from './ui.js';
import { renderFolderSidebar, updateHeaderValue } from './collection.js';
import * as SF            from './scryfall.js';
import { cacheCards, getCachedSearch, cacheSearch, cacheRulings, getCachedRulings } from './db.js';

const esc = s => String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── ESTADO LOCAL ──────────────────────────────────────────────
let _query   = '';
let _page    = 1;
let _hasMore = false;
let _loading = false;
let _timer   = null;

// ── INIT ──────────────────────────────────────────────────────
export function initSearchView() {
    const input = document.getElementById('sf-search-input');

    input.addEventListener('input', e => {
        clearTimeout(_timer);
        const q = e.target.value.trim();
        _timer = setTimeout(() => {
            if (q.length >= 2) doSearch(q, 1);
            else if (!q)       renderEmpty();
        }, 380);
    });

    document.querySelectorAll('.sf-color-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            btn.classList.toggle('sf-color-active');
            if (_query) doSearch(_query, 1);
        })
    );

    document.getElementById('sf-type-input').addEventListener('input', () => {
        clearTimeout(_timer);
        _timer = setTimeout(() => { if (_query) doSearch(_query, 1); }, 380);
    });

    document.getElementById('sf-format-select').addEventListener('change', () => {
        if (_query) doSearch(_query, 1);
    });

    document.getElementById('sf-load-more').addEventListener('click', () => {
        if (_hasMore && !_loading) doSearch(_query, _page + 1, true);
    });

    // Modal close
    document.getElementById('sf-modal-close').addEventListener('click', closeSFModal);
    document.getElementById('sf-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeSFModal();
    });

    renderEmpty();
}

// ── BUILD QUERY ────────────────────────────────────────────────
function buildQuery(base) {
    let q = base;
    const colors = [...document.querySelectorAll('.sf-color-btn.sf-color-active')]
        .map(b => b.dataset.color);
    if (colors.length) q += ` c:${colors.join('')}`;

    const type = document.getElementById('sf-type-input').value.trim();
    if (type) q += ` t:"${type}"`;

    const fmt = document.getElementById('sf-format-select').value;
    if (fmt) q += ` f:${fmt}`;

    return q;
}

// ── SEARCH ────────────────────────────────────────────────────
async function doSearch(base, page = 1, append = false) {
    if (_loading) return;
    _query  = base;
    _page   = page;
    _loading = true;

    const grid = document.getElementById('sf-results-grid');
    const info = document.getElementById('sf-results-info');
    const full = buildQuery(base);

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
        const cacheKey = `${full}__p${page}`;
        let result = await getCachedSearch(cacheKey);

        if (!result) {
            result = await SF.searchCards(full, { page, order: 'name' });
            await cacheSearch(cacheKey, result);
            await cacheCards(result.data ?? []);
        }

        if (append) document.getElementById('sf-skels')?.remove();
        else grid.innerHTML = '';

        _hasMore = result.has_more ?? false;
        if (!append && result.total_cards) {
            info.textContent = `${result.total_cards.toLocaleString()} ${t('results_found')}`;
        }

        (result.data ?? []).forEach(card => grid.appendChild(buildCardEl(card)));
        document.getElementById('sf-load-more').classList.toggle('hidden', !_hasMore);

    } catch (err) {
        if (append) { document.getElementById('sf-skels')?.remove(); return; }
        const notFound = err instanceof SF.ScryfallError && err.status === 404;
        grid.innerHTML = `
      <div class="empty-state">
        <div class="text-5xl mb-4">${notFound ? '🔍' : '⚠️'}</div>
        <h2 class="text-base font-bold text-slate-400 mb-2">
          ${notFound ? t('no_results') : t('search_error')}
        </h2>
        <p class="text-sm text-slate-500">
          ${notFound ? t('try_different_query') : t('check_connection')}
        </p>
      </div>`;
    } finally {
        _loading = false;
    }
}

function renderEmpty() {
    document.getElementById('sf-results-grid').innerHTML = `
    <div class="empty-state">
      <div class="text-5xl mb-4">🔮</div>
      <h2 class="text-base font-bold text-slate-400 mb-2" data-i18n="search_prompt">${t('search_prompt')}</h2>
      <p class="text-sm text-slate-500" data-i18n="search_prompt_sub">${t('search_prompt_sub')}</p>
    </div>`;
    document.getElementById('sf-results-info').textContent = '';
    document.getElementById('sf-load-more').classList.add('hidden');
}

// ── CARD ELEMENT ──────────────────────────────────────────────
function buildCardEl(card) {
    const img    = SF.getImageUri(card, 'normal');
    const prices = SF.getPrices(card);
    const eur    = prices.eur > 0 ? `${prices.eur.toFixed(2)} €` : '—';

    const RARITY = { common:'text-slate-400', uncommon:'text-slate-300',
        rare:'text-yellow-400',  mythic:'text-orange-400' };

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
      <div class="flex justify-between items-center text-xs mb-1">
        <span class="text-slate-400 truncate max-w-[70%]">${esc(card.set_name || card.set || '')}</span>
        <span class="${RARITY[card.rarity] || 'text-slate-400'} font-semibold capitalize">${card.rarity?.[0]?.toUpperCase() ?? ''}</span>
      </div>
      <div class="mt-auto text-base font-extrabold text-emerald-400 tabular-nums">${eur}</div>
    </div>`;

    el.addEventListener('click',   () => openSFModal(card));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') openSFModal(card); });
    return el;
}

function skeletonHTML(n, inline = false) {
    return Array.from({ length: n }, () => `
    <div class="mtg-card-item ${inline ? 'sf-skeleton-inline' : ''} animate-pulse">
      <div class="card-image-wrapper bg-slate-700/40"></div>
      <div class="flex flex-col gap-2 mt-2">
        <div class="h-3 bg-slate-700/40 rounded-full w-4/5"></div>
        <div class="h-3 bg-slate-700/40 rounded-full w-1/2"></div>
        <div class="h-4 bg-slate-700/40 rounded-full w-1/3 mt-1"></div>
      </div>
    </div>`).join('');
}

// ── MODAL DETALLE ─────────────────────────────────────────────
async function openSFModal(card) {
    const modal = document.getElementById('sf-modal');
    const body  = document.getElementById('sf-modal-body');

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const prices  = SF.getPrices(card);
    const cmUrl   = card.purchase_uris?.cardmarket ?? '';
    const faces   = SF.getCardFaces(card);

    // ── Construir cabecera y cuerpo del modal ──
    body.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-6">

      <!-- Imágenes -->
      <div class="flex-shrink-0 flex flex-col gap-2 mx-auto sm:mx-0 w-48">
        ${faces.map((face, i) => {
        const faceImg = face.image_uris?.[i === 0 ? 'normal' : 'normal']
            ?? SF.getImageUri(card, 'normal');
        return faceImg
            ? `<img src="${esc(faceImg)}" alt="${esc(face.name ?? card.name)}"
                 class="w-full rounded-xl shadow-2xl">`
            : '';
    }).join('')}
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0 flex flex-col gap-4">

        <!-- Título + maná -->
        <div>
          <div class="flex items-start justify-between gap-2">
            <h2 class="text-xl font-extrabold leading-tight">${esc(card.name)}</h2>
            <span class="text-sm text-slate-300 flex-shrink-0 font-mono">${esc(card.mana_cost ?? '')}</span>
          </div>
          <p class="text-sm text-slate-400 mt-0.5">${esc(card.type_line ?? '')}</p>
        </div>

        <!-- Oracle Text / DFC faces -->
        ${card.oracle_text ? `
          <div class="bg-slate-700/40 rounded-lg p-3 text-sm leading-relaxed border border-white/5 whitespace-pre-line">
            ${esc(card.oracle_text)}
            ${card.power !== undefined
        ? `<p class="text-slate-400 font-bold mt-2 text-xs pt-2 border-t border-white/10">${esc(card.power)}/${esc(card.toughness)}</p>`
        : ''}
            ${card.loyalty !== undefined
        ? `<p class="text-slate-400 font-bold mt-2 text-xs pt-2 border-t border-white/10">⚡ Loyalty: ${esc(card.loyalty)}</p>`
        : ''}
            ${card.flavor_text
        ? `<p class="text-slate-500 italic text-xs mt-2 pt-2 border-t border-white/10">${esc(card.flavor_text)}</p>`
        : ''}
          </div>` : ''}

        ${!card.oracle_text && card.card_faces ? card.card_faces.map(face => `
          <div class="bg-slate-700/40 rounded-lg p-3 text-sm border border-white/5">
            <p class="font-bold mb-1">${esc(face.name)} <span class="text-slate-400 font-mono font-normal text-xs">${esc(face.mana_cost ?? '')}</span></p>
            <p class="text-slate-400 text-xs mb-1">${esc(face.type_line ?? '')}</p>
            <p class="leading-relaxed whitespace-pre-line">${esc(face.oracle_text ?? '')}</p>
          </div>`).join('') : ''}

        <!-- Metadatos -->
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="bg-slate-700/50 px-2 py-1 rounded capitalize">${esc(card.rarity ?? '')}</span>
          <span class="bg-slate-700/50 px-2 py-1 rounded">${esc(card.set_name ?? card.set ?? '')} #${esc(card.collector_number ?? '')}</span>
          ${card.artist ? `<span class="bg-slate-700/50 px-2 py-1 rounded text-slate-400">🎨 ${esc(card.artist)}</span>` : ''}
          ${card.released_at ? `<span class="bg-slate-700/50 px-2 py-1 rounded text-slate-400">${esc(card.released_at)}</span>` : ''}
        </div>

        <!-- Precios -->
        ${(prices.eur > 0 || prices.usd > 0) ? `
          <div class="flex flex-wrap gap-4 text-sm">
            ${prices.eur > 0 ? `
              <div>
                <span class="text-slate-400 text-xs block">🇪🇺 EUR</span>
                <span class="text-emerald-400 font-bold tabular-nums">${prices.eur.toFixed(2)} €</span>
                ${prices.eur_foil > 0 ? `<span class="text-slate-400 text-xs ml-2">✨ ${prices.eur_foil.toFixed(2)} €</span>` : ''}
              </div>` : ''}
            ${prices.usd > 0 ? `
              <div>
                <span class="text-slate-400 text-xs block">🇺🇸 USD</span>
                <span class="text-green-400 font-bold tabular-nums">${prices.usd.toFixed(2)} $</span>
                ${prices.usd_foil > 0 ? `<span class="text-slate-400 text-xs ml-2">✨ ${prices.usd_foil.toFixed(2)} $</span>` : ''}
              </div>` : ''}
          </div>` : ''}

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

        <!-- Rulings (carga async) -->
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
              <button id="sf-add-collection" class="btn-primary text-sm flex-shrink-0 whitespace-nowrap">
                + ${t('add_to_collection')}
              </button>
            </div>` : `
            <p class="text-xs text-slate-500">${t('toast_no_folders')}</p>`}

          ${state.decks.length ? `
            <div class="flex gap-2 items-center">
              <select id="sf-deck-select" class="input-glass flex-1 text-sm">
                ${state.decks.map((d, i) =>
        `<option value="${i}">${esc(d.name)} (${esc(d.format)})</option>`).join('')}
              </select>
              <button id="sf-add-deck" class="text-sm flex-shrink-0 whitespace-nowrap py-2.5 px-4 rounded-lg font-semibold bg-purple-400/15 text-purple-400 border border-purple-400/30 hover:bg-purple-400/25 transition-colors">
                + ${t('add_to_deck')}
              </button>
            </div>` : `
            <p class="text-xs text-slate-500">${t('toast_no_decks')}</p>`}

          ${cmUrl
        ? `<a href="${esc(cmUrl)}" target="_blank" rel="noopener"
                 class="btn-primary text-sm text-center block">
                 Cardmarket ↗
               </a>`
        : ''}
        </div>
      </div>
    </div>`;

    // Cargar rulings en background
    _loadRulings(card.id);

    // Botón añadir a colección
    document.getElementById('sf-add-collection')?.addEventListener('click', () => {
        const folder = document.getElementById('sf-folder-select').value;
        _addToCollection(card, folder);
    });

    // Botón añadir a mazo
    document.getElementById('sf-add-deck')?.addEventListener('click', () => {
        const idx = parseInt(document.getElementById('sf-deck-select').value, 10);
        _addToDeck(card, idx);
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
        if (!el) return; // modal cerrado
        if (!rulings.length) { el.textContent = t('no_rulings'); return; }
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

function _addToCollection(card, folderName) {
    if (!folderName || !state.folders[folderName]) return;
    const prices = SF.getPrices(card);
    const img    = SF.getImageUri(card, 'normal');

    // Incrementar si ya existe (misma carta, no foil)
    const existing = state.folders[folderName]
        .find(c => c.scryfallId === card.id && !c.isFoil);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        state.folders[folderName].push({
            name:          card.name,
            quantity:      1,
            price:         prices.eur || prices.usd || 0,
            set:           (card.set ?? '').toUpperCase(),
            isFoil:        false,
            colors:        (card.color_identity ?? []).join(''),
            imageUrl:      img ?? '',
            cardmarketUrl: card.purchase_uris?.cardmarket ?? '',
            condition:     'NM',
            scryfallId:    card.id,
        });
    }
    saveToStorage();
    renderFolderSidebar();
    updateHeaderValue();
    showToast(t('toast_added_collection', { name: card.name, folder: folderName }), 'success');
}

function _addToDeck(card, deckIndex) {
    const deck = state.decks[deckIndex];
    if (!deck) return;
    const prices = SF.getPrices(card);
    const img    = SF.getImageUri(card, 'normal');

    const existing = deck.cards.find(c => c.scryfallId === card.id);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        deck.cards.push({
            name:          card.name,
            quantity:      1,
            price:         prices.eur || prices.usd || 0,
            set:           (card.set ?? '').toUpperCase(),
            isFoil:        false,
            colors:        (card.color_identity ?? []).join(''),
            imageUrl:      img ?? '',
            cardmarketUrl: card.purchase_uris?.cardmarket ?? '',
            scryfallId:    card.id,
        });
    }
    saveToStorage();
    showToast(t('toast_added_deck', { name: card.name, deck: deck.name }), 'success');
}

export function closeSFModal() {
    const m = document.getElementById('sf-modal');
    if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
}
