import {state} from '../core/state.js';
import {t} from '../i18n/index.js';
import {saveToStorage} from '../core/storage.js';
import {showToast} from '../utils/ui.js';
import * as SF from '../api/scryfall.js';
import {cacheCards, cacheSearch, getCachedSearch} from '../core/db.js';
import { exportDeckToCSV, exportDeckToTxt, exportDeckToJSON } from '../utils/export.js';



const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── FORMAT RULES ──────────────────────────────────────────────
export const FORMAT_RULES = {
    standard: {
        min: 60,
        max: Infinity,
        side: 15,
        singleton: false,
        hasCommander: false,
        maxCopies: 4,
        noLegalityCheck: false,
        label: 'Standard'
    },
    pioneer: {
        min: 60,
        max: Infinity,
        side: 15,
        singleton: false,
        hasCommander: false,
        maxCopies: 4,
        noLegalityCheck: false,
        label: 'Pioneer'
    },
    modern: {
        min: 60,
        max: Infinity,
        side: 15,
        singleton: false,
        hasCommander: false,
        maxCopies: 4,
        noLegalityCheck: false,
        label: 'Modern'
    },
    legacy: {
        min: 60,
        max: Infinity,
        side: 15,
        singleton: false,
        hasCommander: false,
        maxCopies: 4,
        noLegalityCheck: false,
        label: 'Legacy'
    },
    vintage: {
        min: 60,
        max: Infinity,
        side: 15,
        singleton: false,
        hasCommander: false,
        maxCopies: 4,
        noLegalityCheck: false,
        label: 'Vintage'
    },
    pauper: {
        min: 60,
        max: Infinity,
        side: 15,
        singleton: false,
        hasCommander: false,
        maxCopies: 4,
        noLegalityCheck: false,
        label: 'Pauper'
    },
    historic: {
        min: 60,
        max: Infinity,
        side: 15,
        singleton: false,
        hasCommander: false,
        maxCopies: 4,
        noLegalityCheck: false,
        label: 'Historic'
    },
    explorer: {
        min: 60,
        max: Infinity,
        side: 15,
        singleton: false,
        hasCommander: false,
        maxCopies: 4,
        noLegalityCheck: false,
        label: 'Explorer'
    },
    alchemy: {
        min: 60,
        max: Infinity,
        side: 15,
        singleton: false,
        hasCommander: false,
        maxCopies: 4,
        noLegalityCheck: false,
        label: 'Alchemy'
    },
    timeless: {
        min: 60,
        max: Infinity,
        side: 15,
        singleton: false,
        hasCommander: false,
        maxCopies: 4,
        noLegalityCheck: false,
        label: 'Timeless'
    },
    commander: {
        min: 100,
        max: 100,
        side: 0,
        singleton: true,
        hasCommander: true,
        maxCopies: 1,
        noLegalityCheck: false,
        label: 'Commander (EDH)'
    },
    duel: {
        min: 100,
        max: 100,
        side: 0,
        singleton: true,
        hasCommander: true,
        maxCopies: 1,
        noLegalityCheck: false,
        label: 'Duel Commander'
    },
    brawl: {
        min: 60,
        max: 60,
        side: 0,
        singleton: true,
        hasCommander: true,
        maxCopies: 1,
        noLegalityCheck: false,
        label: 'Brawl'
    },
    oathbreaker: {
        min: 60,
        max: 60,
        side: 0,
        singleton: true,
        hasCommander: true,
        maxCopies: 1,
        noLegalityCheck: false,
        label: 'Oathbreaker'
    },
    // ── Kitchen Table ──────────────────────────────────────────────────────────
    kitchentable: {
        min: 60,
        max: Infinity,
        side: 15,
        singleton: false,
        hasCommander: false,
        maxCopies: 4,
        noLegalityCheck: true,
        label: 'Kitchen Table'
    },
    cmdkitchentable: {
        min: 100,
        max: 100,
        side: 0,
        singleton: true,
        hasCommander: true,
        maxCopies: 1,
        noLegalityCheck: true,
        label: 'Cmd Kitchen Table'
    },
};

// ── AGRUPACIÓN POR TIPO ───────────────────────────────────────
const TYPE_GROUPS = [
    {key: 'creature', label: 'Criaturas', match: tl => tl.includes('creature')},
    {key: 'planeswalker', label: 'Planeswalkers', match: tl => tl.includes('planeswalker')},
    {key: 'instant', label: 'Instantáneos', match: tl => tl.includes('instant')},
    {key: 'sorcery', label: 'Conjuros', match: tl => tl.includes('sorcery')},
    {key: 'enchantment', label: 'Encantamientos', match: tl => tl.includes('enchantment') && !tl.includes('creature')},
    {key: 'artifact', label: 'Artefactos', match: tl => tl.includes('artifact') && !tl.includes('creature')},
    {key: 'land', label: 'Tierras', match: tl => tl.includes('land')},
    {key: 'other', label: 'Otros', match: () => true},
];

const BASIC_LANDS = new Set([
    'plains', 'island', 'swamp', 'mountain', 'forest', 'wastes',
    'snow-covered plains', 'snow-covered island', 'snow-covered swamp',
    'snow-covered mountain', 'snow-covered forest',
]);

// ── COMMANDER BRACKETS (Oct 2025 — Wizards official) ──────────
// Fuente: magic.wizards.com/en/news/announcements/commander-brackets-beta-update-october-21-2025

export const GAME_CHANGERS = new Set([
    // ── Blanco ─────────────────────────────────────────────────
    'Drannith Magistrate',
    'Humility',
    'Serra\'s Sanctum',
    'Smothering Tithe',
    'Enlightened Tutor',
    'Teferi\'s Protection',
    'Coalition Victory',
    // ── Azul ───────────────────────────────────────────────────
    'Consecrated Sphinx',
    'Cyclonic Rift',
    'Force of Will',
    'Fierce Guardianship',
    'Gifts Ungiven',
    'Intuition',
    'Mystical Tutor',
    'Narset, Parter of Veils',
    'Rhystic Study',
    'Thassa\'s Oracle',
    'Panoptic Mirror',
    // ── Negro ──────────────────────────────────────────────────
    'Ad Nauseam',
    'Bolas\'s Citadel',
    'Braids, Cabal Minion',
    'Demonic Tutor',
    'Imperial Seal',
    'Necropotence',
    'Opposition Agent',
    'Orcish Bowmasters',
    'Tergrid, God of Fright',
    'Vampiric Tutor',
    // ── Rojo ───────────────────────────────────────────────────
    'Dockside Extortionist',
    'Gamble',
    'Jeska\'s Will',
    // ── Verde ──────────────────────────────────────────────────
    'Crop Rotation',
    'Gaea\'s Cradle',
    'Survival of the Fittest',
    'Worldly Tutor',
    // ── Multicolor ─────────────────────────────────────────────
    'Grand Arbiter Augustin IV',
    // ── Artefactos / Incoloro ──────────────────────────────────
    'Jeweled Lotus',
    'Mana Crypt',
    'Mana Vault',
    'Sensei\'s Divining Top',
    'Skullclamp',
    'Sol Ring',           // bracket 2 si es el único GC
    'The One Ring',
]);

// Cards que de por sí sitúan al menos en bracket 4
const BRACKET4_CARDS = new Set([
    'Thassa\'s Oracle', 'Demonic Tutor', 'Imperial Seal', 'Ad Nauseam',
    'Necropotence', 'Jeweled Lotus', 'Mana Crypt', 'Gaea\'s Cradle',
    'Force of Will', 'Fierce Guardianship', 'Dockside Extortionist',
    'Gifts Ungiven', 'Bolas\'s Citadel', 'Panoptic Mirror', 'Coalition Victory',
]);

const BRACKET_LABELS = {
    1: {
        label: 'Bracket 1 — Exhibition',
        color: 'text-emerald-400',
        bg: 'bg-emerald-400/12 border-emerald-400/25',
        desc: 'Nivel precon. Sin Game Changers.'
    },
    2: {
        label: 'Bracket 2 — Core',
        color: 'text-sky-400',
        bg: 'bg-sky-400/12 border-sky-400/25',
        desc: 'Ligeramente potenciado. 1-2 Game Changers.'
    },
    3: {
        label: 'Bracket 3 — Upgraded',
        color: 'text-yellow-400',
        bg: 'bg-yellow-400/12 border-yellow-400/25',
        desc: 'Sinergias fuertes. 3-5 Game Changers.'
    },
    4: {
        label: 'Bracket 4 — Optimized',
        color: 'text-orange-400',
        bg: 'bg-orange-400/12 border-orange-400/25',
        desc: 'Muy optimizado. 6+ Game Changers o cartas B4.'
    },
    5: {
        label: 'Bracket 5 — cEDH',
        color: 'text-red-400',
        bg: 'bg-red-400/12 border-red-400/25',
        desc: 'Completamente optimizado. Metagame competitivo.'
    },
};

/**
 * Calcula el bracket Commander de un mazo.
 * @param {object} deck - objeto mazo con mainboard, sideboard, commander
 * @returns {{ bracket: number, gcFound: string[], gcCount: number, hasB4Card: boolean }}
 */
export function calculateBracket(deck) {
    const allCards = [
        ...(deck.mainboard ?? []),
        ...(deck.sideboard ?? []),
        ...(deck.commander ? [deck.commander] : []),
    ];

    const gcFound = [];
    let hasB4 = false;

    allCards.forEach(card => {
        if (GAME_CHANGERS.has(card.name)) {
            gcFound.push(card.name);
            if (BRACKET4_CARDS.has(card.name)) hasB4 = true;
        }
    });

    // Deduplicar (singleton, pero por si acaso)
    const unique = [...new Set(gcFound)];
    const count = unique.length;

    let bracket;
    if (count === 0) bracket = 1;
    else if (count <= 2 && !hasB4) bracket = 2;
    else if (count <= 5 && !hasB4) bracket = 3;
    else if (hasB4 || count >= 6) bracket = 4;
    else bracket = 3;

    // cEDH: múltiples B4 cards + alta densidad de GC
    if (hasB4 && count >= 8) bracket = 5;

    return {bracket, gcFound: unique, gcCount: count, hasB4};
}

const CMC_COLORS = [
    'bg-slate-500', 'bg-emerald-400', 'bg-sky-400', 'bg-blue-400',
    'bg-violet-400', 'bg-purple-400', 'bg-pink-500', 'bg-red-500',
];

// ── MODULE STATE ──────────────────────────────────────────────
let _deck = null;
let _deckIdx = -1;
let _timer = null;
let _loading = false;

// ── MIGRACIÓN (formato viejo → nuevo) ─────────────────────────
function migrateDeck(deck) {
    if (!deck.mainboard) {
        deck.mainboard = deck.cards ?? [];
        deck.sideboard = [];
        deck.commander = null;
        deck.companion = null;
        deck.notes = '';
        deck.createdAt = deck.createdAt ?? Date.now();
        delete deck.cards;
        saveToStorage();
    }
    return deck;
}

// ── ABRIR / CERRAR ────────────────────────────────────────────
export function openDeckBuilder(deckIndex) {
    _deckIdx = deckIndex;
    _deck = state.decks[deckIndex];
    if (!_deck) return;

    migrateDeck(_deck);

    document.getElementById('view-deckbuilder').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Inicializar búsqueda (re-añadir listener limpio)
    const input = document.getElementById('builder-search-input');
    input.value = '';
    input.removeEventListener('input', _onSearchInput);
    input.addEventListener('input', _onSearchInput);

    // Tabs zona main/side
    document.querySelectorAll('.builder-zone-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.builder-zone-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderDeckList();
        });
    });

    ['builder-close-btn', 'builder-export-txt-btn', 'builder-export-csv-btn',
        'builder-export-json-btn', 'builder-import-text-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const fresh = el.cloneNode(true);
        el.replaceWith(fresh);
    });

    document.getElementById('builder-close-btn')
        ?.addEventListener('click', closeDeckBuilder);
    document.getElementById('builder-export-txt-btn')
        ?.addEventListener('click', exportDeckText);           // copia al portapapeles
    document.getElementById('builder-export-csv-btn')
        ?.addEventListener('click', () => exportDeckToCSV(_deck));
    document.getElementById('builder-export-json-btn')
        ?.addEventListener('click', () => exportDeckToJSON(_deck));
    document.getElementById('builder-import-text-btn')
        ?.addEventListener('click', openImportTextModal);

    // Editar nombre del mazo inline
    const nameEl = document.getElementById('builder-deck-name');
    nameEl.setAttribute('contenteditable', 'true');
    nameEl.addEventListener('blur', () => {
        const newName = nameEl.textContent.trim();
        if (newName && newName !== _deck.name) {
            _deck.name = newName;
            saveToStorage();
            showToast(t('deck_renamed'), 'success');
        }
    });
    nameEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            nameEl.blur();
        }
    });

    _renderAll();
    renderEmptySearch();
    input.focus();
}

export function closeDeckBuilder() {
    document.getElementById('view-deckbuilder').classList.add('hidden');
    document.body.style.overflow = '';
    const input = document.getElementById('builder-search-input');
    input?.removeEventListener('input', _onSearchInput);
    _deck = null;
    _deckIdx = -1;
}

function _renderAll() {
    renderBuilderHeader();
    renderDeckList();
    renderStats();
}

// ── HEADER ────────────────────────────────────────────────────
function renderBuilderHeader() {
    const rules = FORMAT_RULES[_deck.format] ?? FORMAT_RULES.modern;
    const mainCount = (_deck.mainboard ?? []).reduce((s, c) => s + (c.quantity || 1), 0);
    const sideCount = (_deck.sideboard ?? []).reduce((s, c) => s + (c.quantity || 1), 0);
    const maxLabel = rules.max === Infinity ? `${rules.min}+` : String(rules.max);
    const validation = validateDeck();

    document.getElementById('builder-deck-name').textContent = _deck.name;
    document.getElementById('builder-format-badge').textContent = rules.label;
    document.getElementById('builder-main-count').textContent = mainCount;
    document.getElementById('builder-side-count').textContent = sideCount;
    document.getElementById('builder-max-count').textContent = `/${maxLabel}`;

    const statusEl = document.getElementById('builder-status');
    if (validation.valid) {
        statusEl.className = 'badge-valid';
        statusEl.textContent = '✓ ' + t('deck_valid');
        statusEl.title = '';
    } else {
        statusEl.className = 'badge-invalid';
        statusEl.textContent = `✗ ${validation.errors[0]}`;
        statusEl.title = validation.errors.join('\n');
    }
}

// ── BÚSQUEDA ──────────────────────────────────────────────────
function _onSearchInput(e) {
    clearTimeout(_timer);
    const q = e.target.value.trim();
    _timer = setTimeout(() => {
        if (q.length >= 2) doBuilderSearch(q);
        else renderEmptySearch();
    }, 350);
}

async function doBuilderSearch(query) {
    if (_loading) return;
    _loading = true;
    const grid = document.getElementById('builder-search-results');
    grid.innerHTML = builderSkeleton(8);

    try {
        const key = `builder__${query}__p1`;
        let result = await getCachedSearch(key);
        if (!result) {
            result = await SF.searchCards(query, {page: 1, order: 'name', dir: 'asc'});
            await cacheSearch(key, result);
            await cacheCards(result.data ?? []);
        }
        grid.innerHTML = '';
        (result.data ?? []).slice(0, 24).forEach(card => grid.appendChild(buildSearchEl(card)));
    } catch (err) {
        const nf = err instanceof SF.ScryfallError && err.status === 404;
        grid.innerHTML = `<div class="builder-search-empty">
      ${nf ? '🔍 ' + t('no_results') : '⚠️ ' + t('search_error')}</div>`;
    } finally {
        _loading = false;
    }
}

function renderEmptySearch() {
    document.getElementById('builder-search-results').innerHTML = `
    <div class="builder-search-empty">
      <div class="text-2xl mb-1">🔍</div>
      ${t('builder_search_hint')}
    </div>`;
}

function buildSearchEl(card) {
    const img = SF.getImageUri(card, 'small');
    const prices = SF.getPrices(card);
    const eur = prices.eur > 0 ? `${prices.eur.toFixed(2)} €` : '—';
    const rules = FORMAT_RULES[_deck.format] ?? FORMAT_RULES.modern;

    const inMain = _deck.mainboard?.find(c => c.scryfallId === card.id)?.quantity ?? 0;
    const inSide = _deck.sideboard?.find(c => c.scryfallId === card.id)?.quantity ?? 0;
    const total = inMain + inSide;

    // ── Legalidad ─────────────────────────────────────────────
    const legal = rules.noLegalityCheck ? 'legal' : (card.legalities?.[_deck.format] ?? 'unknown');
    const isLegal = rules.noLegalityCheck || legal === 'legal' || legal === 'restricted';

    const LEGAL_BADGE = {
        legal: '',
        restricted: `<span class="text-[9px] text-yellow-400 font-bold border border-yellow-400/30 px-1 rounded">RESTRICTED ×1</span>`,
        banned: `<span class="text-[9px] text-red-400 font-bold border border-red-400/30 px-1 rounded">BANEADA</span>`,
        not_legal: `<span class="text-[9px] text-slate-500 font-bold border border-slate-600/40 px-1 rounded">NO LEGAL</span>`,
        unknown: '',
    };

    // ── Game Changer badge ────────────────────────────────────
    const isGC = GAME_CHANGERS.has(card.name);
    const isB4Card = BRACKET4_CARDS.has(card.name);
    const gcBadge = isB4Card
        ? `<span class="text-[9px] text-red-300 font-bold border border-red-400/30 px-1 rounded bg-red-400/10">GC★</span>`
        : isGC
            ? `<span class="text-[9px] text-yellow-300 font-bold border border-yellow-400/25 px-1 rounded bg-yellow-400/10">GC</span>`
            : '';

    const isCommFmt = rules.hasCommander;

    const el = document.createElement('div');
    el.className = `builder-search-card${isLegal ? '' : ' opacity-50'}`;
    el.innerHTML = `
    <div class="builder-s-img">
      ${img
        ? `<img src="${esc(img)}" alt="${esc(card.name)}" loading="lazy">`
        : '<div class="text-xl opacity-20">🃏</div>'}
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-xs font-semibold line-clamp-1">${esc(card.name)}</div>
      <div class="text-[10px] text-slate-400 line-clamp-1">${esc(card.type_line ?? '')}</div>
      <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
        <span class="text-[10px] text-slate-500">${esc(card.mana_cost ?? '')}</span>
        ${!rules.noLegalityCheck && legal !== 'legal' ? (LEGAL_BADGE[legal] ?? '') : ''}
        ${gcBadge}
        ${total > 0 ? `<span class="text-[9px] text-sky-400 font-bold">×${total} ✓</span>` : ''}
      </div>
    </div>
    <div class="flex flex-col items-end gap-1 flex-shrink-0">
      <span class="text-[11px] font-bold text-emerald-400">${eur}</span>
      <div class="flex gap-1">
        <button class="s-add-btn main" title="${t('add_to_mainboard')}" ${!isLegal ? 'disabled' : ''}>+M</button>
        ${!isCommFmt ? `<button class="s-add-btn side" title="${t('add_to_sideboard')}" ${!isLegal ? 'disabled' : ''}>+S</button>` : ''}
                ${isCommFmt ? `<button class="s-add-btn cmd"  title="→ Commander">⭐</button>` : ''}
        <button class="s-add-btn wl" title="${t('add_to_wishlist')}">💭</button>
      </div>
    </div>`;

    el.querySelector('.s-add-btn.main')?.addEventListener('click', e => {
        e.stopPropagation();
        addCard(card, 'mainboard');
    });
    el.querySelector('.s-add-btn.side')?.addEventListener('click', e => {
        e.stopPropagation();
        addCard(card, 'sideboard');
    });
    el.querySelector('.s-add-btn.cmd')?.addEventListener('click', e => {
        e.stopPropagation();
        setCommander(card);
    });

    // Click en imagen → añadir a mainboard (solo si es legal)
    el.querySelector('.builder-s-img')?.addEventListener('click', () => {
        if (isLegal) addCard(card, 'mainboard');
    });

    el.querySelector('.s-add-btn.wl')?.addEventListener('click', e => {
        e.stopPropagation();
        addToWishlist(card);
        showToast(`💭 ${card.name} ${t('added_to_wishlist')}`, 'success');
    });

    return el;
}

function builderSkeleton(n) {
    return Array.from({length: n}, () => `
    <div class="builder-search-card animate-pulse">
      <div class="builder-s-img bg-slate-700/50"></div>
      <div class="flex-1 flex flex-col gap-1">
        <div class="h-2.5 bg-slate-700/50 rounded w-3/4"></div>
        <div class="h-2 bg-slate-700/50 rounded w-1/2"></div>
      </div>
    </div>`).join('');
}

// ── AÑADIR / ELIMINAR CARTAS ──────────────────────────────────
function addCard(card, zone = 'mainboard') {
    const rules = FORMAT_RULES[_deck.format] ?? FORMAT_RULES.modern;
    if (!_deck[zone]) _deck[zone] = [];

    // ── Control de legalidad ──────────────────────────────────
    if (!rules.noLegalityCheck) {
        const legalStatus = card.legalities?.[_deck.format];

        if (legalStatus === 'banned') {
            showToast(t('toast_card_banned', {name: card.name, format: rules.label}), 'error');
            return;
        }
        if (legalStatus === 'not_legal') {
            showToast(t('toast_card_not_legal', {name: card.name, format: rules.label}), 'warning');
            return;
        }
        if (legalStatus === 'restricted') {
            // Vintage: máximo 1 copia total entre main + side
            const totalCopies = (_deck.mainboard?.find(c => c.scryfallId === card.id)?.quantity ?? 0)
                + (_deck.sideboard?.find(c => c.scryfallId === card.id)?.quantity ?? 0);
            if (totalCopies >= 1) {
                showToast(t('toast_card_restricted', {name: card.name}), 'warning');
                return;
            }
        }
    }

    // ── Control singleton ─────────────────────────────────────
    const existing = _deck[zone].find(c => c.scryfallId === card.id);
    const isBasic = BASIC_LANDS.has(card.name.toLowerCase());
    const totalCopies = (_deck.mainboard?.find(c => c.scryfallId === card.id)?.quantity ?? 0)
        + (_deck.sideboard?.find(c => c.scryfallId === card.id)?.quantity ?? 0);

    if (rules.singleton && !isBasic && totalCopies >= 1) {
        showToast(t('toast_singleton_limit'), 'warning');
        return;
    }
    if (!rules.singleton && !isBasic && totalCopies >= rules.maxCopies) {
        showToast(t('toast_max_copies', {n: rules.maxCopies}), 'warning');
        return;
    }

    // ── Añadir ────────────────────────────────────────────────
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        const prices = SF.getPrices(card);
        _deck[zone].push({
            name: card.name,
            quantity: 1,
            scryfallId: card.id,
            type_line: card.type_line ?? '',
            mana_cost: card.mana_cost ?? '',
            cmc: card.cmc ?? 0,
            price: prices.eur || prices.usd || 0,
            priceNormal: prices.eur || prices.usd || 0,
            priceFoil: prices.eur_foil || prices.usd_foil || 0,
            colors: (card.color_identity ?? []).join(''),
            imageUrl: SF.getImageUri(card, 'normal') ?? '',
            set: (card.set ?? '').toUpperCase(),
        });
    }

    saveToStorage();
    _renderAll();
    showToast(`${card.name} → ${zone === 'mainboard' ? t('mainboard') : t('sideboard')}`, 'success');
}


function setCommander(card) {
    const prices = SF.getPrices(card);
    _deck.commander = {
        name: card.name,
        scryfallId: card.id,
        quantity: 1,
        imageUrl: SF.getImageUri(card, 'normal') ?? '',
        type_line: card.type_line ?? '',
        mana_cost: card.mana_cost ?? '',
        cmc: card.cmc ?? 0,
        price: prices.eur || prices.usd || 0,
        colors: (card.color_identity ?? []).join(''),
        set: (card.set ?? '').toUpperCase(),
    };
    saveToStorage();
    _renderAll();
    showToast(`⭐ ${card.name} → Commander`, 'success');
}

function removeCard(cardId, zone) {
    if (zone === 'commander') {
        _deck.commander = null;
        saveToStorage();
        _renderAll();
        return;
    }
    _deck[zone] = (_deck[zone] ?? []).filter(c => c.scryfallId !== cardId);
    saveToStorage();
    _renderAll();
}

function updateQty(cardId, zone, delta) {
    const card = _deck[zone]?.find(c => c.scryfallId === cardId);
    if (!card) return;

    const rules = FORMAT_RULES[_deck.format] ?? FORMAT_RULES.modern;
    const isBasic = BASIC_LANDS.has(card.name.toLowerCase());
    const next = (card.quantity || 1) + delta;

    if (next <= 0) {
        removeCard(cardId, zone);
        return;
    }
    if (!isBasic && !rules.singleton && delta > 0) {
        const other = zone === 'mainboard' ? 'sideboard' : 'mainboard';
        const otherQty = _deck[other]?.find(c => c.scryfallId === cardId)?.quantity ?? 0;
        if ((card.quantity || 1) + otherQty >= rules.maxCopies) {
            showToast(t('toast_max_copies', {n: rules.maxCopies}), 'warning');
            return;
        }
    }

    card.quantity = Math.min(99, next);
    saveToStorage();
    _renderAll();
}

// ── RENDER DECK LIST ──────────────────────────────────────────
export function renderDeckList() {
    const rules = FORMAT_RULES[_deck.format] ?? FORMAT_RULES.modern;
    const zone = _getActiveZone();
    const cards = _deck[zone] ?? [];
    const list = document.getElementById('builder-deck-list');
    let html = '';

    // Commander slot
    if (rules.hasCommander) {
        const cmd = _deck.commander;
        html += `
      <div class="builder-group">
        <div class="builder-group-hd">
          <span class="text-xs font-bold text-yellow-400 uppercase tracking-wider">⭐ Commander</span>
          <span class="text-xs text-slate-500">${cmd ? '1' : '0'}/1</span>
        </div>
        ${cmd ? buildDeckCardRow(cmd, 'commander', true)
            : `<div class="builder-empty-slot">${t('no_commander')} — ${t('search_and_click')}</div>`}
      </div>`;
    }

    if (!cards.length) {
        html += `<div class="builder-deck-empty">
      <div class="text-3xl mb-2">📋</div>
      ${t('builder_deck_empty')}
    </div>`;
    } else {
        const groups = _groupCards(cards);
        groups.forEach(g => {
            const total = g.cards.reduce((s, c) => s + (c.quantity || 1), 0);
            html += `
        <div class="builder-group">
          <div class="builder-group-hd">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${g.label}</span>
            <span class="text-xs text-slate-500">${total}</span>
          </div>
          ${g.cards
                .sort((a, b) => (a.cmc ?? 0) - (b.cmc ?? 0) || a.name.localeCompare(b.name))
                .map(c => buildDeckCardRow(c, zone)).join('')}
        </div>`;
        });
    }

    list.innerHTML = html;

    // Event listeners
    list.querySelectorAll('[data-action="remove"]').forEach(btn =>
        btn.addEventListener('click', () => removeCard(btn.dataset.id, btn.dataset.zone))
    );
    list.querySelectorAll('[data-action="minus"]').forEach(btn =>
        btn.addEventListener('click', () => updateQty(btn.dataset.id, btn.dataset.zone, -1))
    );
    list.querySelectorAll('[data-action="plus"]').forEach(btn =>
        btn.addEventListener('click', () => updateQty(btn.dataset.id, btn.dataset.zone, +1))
    );
}

function buildDeckCardRow(card, zone, isCommander = false) {
    const qty = isCommander ? 1 : (card.quantity || 1);
    const id = card.scryfallId ?? '';
    const total = card.price > 0 ? (card.price * qty).toFixed(2) + ' €' : '';

    return `
    <div class="builder-deck-row">
      <div class="builder-d-img">
        ${card.imageUrl
        ? `<img src="${esc(card.imageUrl)}" alt="${esc(card.name)}" loading="lazy">`
        : '<div class="text-base opacity-20">🃏</div>'}
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-semibold line-clamp-1">${esc(card.name)}</div>
        <div class="text-[10px] text-slate-400">
          ${esc(card.mana_cost ?? '')} · ${esc(card.set ?? '')}
          ${total ? ` · <span class="text-emerald-400">${total}</span>` : ''}
        </div>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        ${!isCommander ? `
          <button class="qty-btn" data-action="minus" data-id="${esc(id)}" data-zone="${esc(zone)}">−</button>
          <span class="w-5 text-center text-xs font-bold tabular-nums">${qty}</span>
          <button class="qty-btn" data-action="plus"  data-id="${esc(id)}" data-zone="${esc(zone)}">+</button>
        ` : ''}
        <button class="deck-row-remove" data-action="remove" data-id="${esc(id)}" data-zone="${esc(zone)}" title="${t('delete')}">✕</button>
      </div>
    </div>`;
}

function _groupCards(cards) {
    const groups = TYPE_GROUPS.map(g => ({...g, cards: []}));
    cards.forEach(card => {
        const tl = (card.type_line ?? '').toLowerCase();
        const g = groups.find(g => g.match(tl));
        if (g) g.cards.push(card);
    });
    return groups.filter(g => g.cards.length > 0);
}

function _getActiveZone() {
    return document.querySelector('.builder-zone-tab.active')?.dataset.zone ?? 'mainboard';
}

// ── STATS ─────────────────────────────────────────────────────
export function renderStats() {
    const main = _deck.mainboard ?? [];
    const all = [...main, ...(_deck.sideboard ?? [])];

    // Curva de maná (sin tierras)
    const spells = main.filter(c => !(c.type_line ?? '').toLowerCase().includes('land'));
    const curve = Array(8).fill(0);
    spells.forEach(c => {
        const cmc = Math.min(Math.round(c.cmc ?? 0), 7);
        curve[cmc] += (c.quantity || 1);
    });
    const curveMax = Math.max(...curve, 1);

    // Colores
    const colorMap = {};
    main.forEach(c => {
        (c.colors || '').split('').forEach(col => {
            if (col) colorMap[col] = (colorMap[col] || 0) + (c.quantity || 1);
        });
    });

    // Tipos
    const types = {creature: 0, spell: 0, land: 0, other: 0};
    main.forEach(c => {
        const tl = (c.type_line ?? '').toLowerCase();
        const q = c.quantity || 1;
        if (tl.includes('land')) types.land += q;
        else if (tl.includes('creature')) types.creature += q;
        else if (tl.includes('instant') || tl.includes('sorcery')) types.spell += q;
        else types.other += q;
    });

    // Valor total (main + side + commander)
    let totalVal = all.reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);
    if (_deck.commander) totalVal += _deck.commander.price || 0;

    const COLOR_EMOJI = {W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌲', C: '💎'};
    const isCommFmt = ['commander', 'duel', 'brawl', 'oathbreaker', 'cmdkitchentable']
        .includes(_deck.format);

    document.getElementById('builder-stats').innerHTML = `
    <div class="stats-inner">

      <!-- Curva de maná -->
      <div class="stat-block">
        <p class="stat-label">${t('mana_curve')}</p>
        <div class="curve-bars">
          ${curve.map((count, i) => `
            <div class="curve-col">
              <span class="curve-count">${count || ''}</span>
              <div class="curve-bar ${CMC_COLORS[i]}"
                   style="height:${curveMax > 0 ? (count / curveMax) * 100 : 0}%">
              </div>
              <span class="curve-label">${i === 7 ? '7+' : i}</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- Colores -->
      <div class="stat-block">
        <p class="stat-label">${t('colors')}</p>
        <div class="flex flex-wrap gap-2">
          ${Object.entries(colorMap).length
        ? Object.entries(colorMap)
            .sort((a, b) => b[1] - a[1])
            .map(([c, n]) => `
                  <div class="flex items-center gap-0.5 text-xs">
                    <span>${COLOR_EMOJI[c] ?? c}</span>
                    <span class="text-slate-300 font-bold">${n}</span>
                  </div>`).join('')
        : `<span class="text-xs text-slate-500">${t('colorless')}</span>`}
        </div>
      </div>

      <!-- Tipos -->
      <div class="stat-block">
        <p class="stat-label">${t('type_breakdown')}</p>
        <div class="flex flex-col gap-0.5 text-xs">
          ${[['🧙', t('creatures'), types.creature],
        ['⚡', t('spells'), types.spell],
        ['🌍', t('lands'), types.land],
        ['✨', t('other'), types.other],
    ].filter(([, , n]) => n > 0)
        .map(([icon, label, n]) => `
              <div class="flex justify-between gap-4">
                <span class="text-slate-400">${icon} ${label}</span>
                <span class="font-bold">${n}</span>
              </div>`).join('')}
        </div>
      </div>

      <!-- Valor -->
      <div class="stat-block">
        <p class="stat-label">${t('total_value')}</p>
        <p class="text-lg font-extrabold text-emerald-400 tabular-nums">${totalVal.toFixed(2)} €</p>
        <p class="text-[10px] text-slate-500">
          ${main.reduce((s, c) => s + (c.quantity || 1), 0)} cartas
          · Side: ${(_deck.sideboard ?? []).reduce((s, c) => s + (c.quantity || 1), 0)}
        </p>
      </div>

      <!-- Bracket Commander (solo formatos commander) -->
      ${isCommFmt ? renderBracketWidget() : ''}

    </div>`;
}

// ── VALIDACIÓN ────────────────────────────────────────────────
function validateDeck() {
    const rules = FORMAT_RULES[_deck.format] ?? FORMAT_RULES.modern;
    const mainCount = (_deck.mainboard ?? []).reduce((s, c) => s + (c.quantity || 1), 0);
    const sideCount = (_deck.sideboard ?? []).reduce((s, c) => s + (c.quantity || 1), 0);
    const errors = [];

    if (mainCount < rules.min) errors.push(t('err_too_few', {n: mainCount, min: rules.min}));
    if (mainCount > rules.max) errors.push(t('err_too_many', {n: mainCount, max: rules.max}));
    if (sideCount > rules.side) errors.push(t('err_side_limit', {n: sideCount, max: rules.side}));
    if (rules.hasCommander && !_deck.commander) errors.push(t('err_no_commander'));

    return {valid: errors.length === 0, errors};
}

// ── COPIAR LISTA AL PORTAPAPELES (MTGO / Arena) ───────────────
export function exportDeckText() {
    const lines = [];

    if (_deck.commander) {
        lines.push('Commander');
        lines.push(`1 ${_deck.commander.name}`);
        lines.push('');
    }

    const groups = _groupCards(_deck.mainboard ?? []);
    groups.forEach(g => {
        lines.push(`// ${g.label}`);
        g.cards
            .sort((a, b) => (a.cmc ?? 0) - (b.cmc ?? 0) || a.name.localeCompare(b.name))
            .forEach(c => lines.push(`${c.quantity || 1} ${c.name}`));
        lines.push('');
    });

    if (_deck.sideboard?.length) {
        lines.push('Sideboard');
        _deck.sideboard
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(c => lines.push(`${c.quantity || 1} ${c.name}`));
        lines.push('');
    }

    const mainCount = (_deck.mainboard ?? []).reduce((s, c) => s + (c.quantity || 1), 0);
    const sideCount = (_deck.sideboard ?? []).reduce((s, c) => s + (c.quantity || 1), 0);
    const totalVal  = [
        ...(_deck.mainboard ?? []),
        ...(_deck.sideboard ?? []),
        ...(_deck.commander ? [_deck.commander] : []),
    ].reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);

    lines.push(`// ${_deck.name}`);
    lines.push(`// Main: ${mainCount} · Side: ${sideCount} · Valor: ${totalVal.toFixed(2)} €`);

    const text = lines.join('\n');

    navigator.clipboard?.writeText(text).then(
        () => showToast(t('toast_deck_copied'), 'success'),
        () => _fallbackCopy(text)
    ) ?? _fallbackCopy(text);
}

function _fallbackCopy(text) {
    const ta = Object.assign(document.createElement('textarea'),
        { value: text, style: 'position:fixed;opacity:0' });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(t('toast_deck_copied'), 'success');
}

// ── IMPORTAR LISTA DE TEXTO ───────────────────────────────────
function openImportTextModal() {
    const modal = document.getElementById('card-modal');
    const body = document.getElementById('modal-body');

    body.innerHTML = `
    <h2 class="text-lg font-extrabold mb-3">📋 ${t('import_decklist')}</h2>
    <p class="text-sm text-slate-400 mb-3">${t('import_decklist_hint')}</p>
    <textarea id="import-deck-textarea" rows="14"
      class="input-glass w-full font-mono text-xs resize-none"
      placeholder="1 Lightning Bolt\n4 Scalding Tarn\n// Sideboard\n2 Surgical Extraction"></textarea>
    <div class="flex gap-3 mt-3">
      <button id="import-deck-cancel"
        class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-white/8 hover:bg-white/15 transition-colors">
        ${t('cancel')}
      </button>
      <button id="import-deck-confirm" class="flex-1 btn-primary">
        ${t('import_text')}
      </button>
    </div>`;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    document.getElementById('import-deck-cancel').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    document.getElementById('import-deck-confirm').addEventListener('click', async () => {
        const text = document.getElementById('import-deck-textarea').value.trim();
        if (!text) return;

        modal.style.display = 'none';
        await parseAndImportDecklist(text);
    });
}

async function parseAndImportDecklist(text) {
    showToast(t('importing_decklist'), 'info');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let zone = 'mainboard';
    let cmdNext = false;
    let count = 0;
    let errors = 0;

    for (const line of lines) {
        if (/^\/\/|^#/.test(line)) continue;
        if (/^(commander|commandante)/i.test(line)) {
            cmdNext = true;
            continue;
        }
        if (/^(sideboard|side)/i.test(line)) {
            zone = 'sideboard';
            cmdNext = false;
            continue;
        }
        if (/^(deck|mazo|main)/i.test(line)) {
            zone = 'mainboard';
            cmdNext = false;
            continue;
        }

        const match = line.match(/^(\d+)[x×]?\s+(.+)$/i);
        if (!match) continue;

        const qty = Math.max(1, Math.min(99, parseInt(match[1], 10)));
        const name = match[2].trim().replace(/\s+\(.*\).*$/, ''); // strip set info

        try {
            const card = await SF.getCardByName(name);
            await new Promise(r => setTimeout(r, 110)); // rate limit

            if (cmdNext || zone === 'commander') {
                setCommander(card);
                cmdNext = false;
            } else {
                const existing = _deck[zone]?.find(c => c.scryfallId === card.id);
                if (existing) {
                    existing.quantity = qty;
                } else {
                    const prices = SF.getPrices(card);
                    if (!_deck[zone]) _deck[zone] = [];
                    _deck[zone].push({
                        name: card.name, quantity: qty,
                        scryfallId: card.id,
                        type_line: card.type_line ?? '',
                        mana_cost: card.mana_cost ?? '',
                        cmc: card.cmc ?? 0,
                        price: prices.eur || prices.usd || 0,
                        colors: (card.color_identity ?? []).join(''),
                        imageUrl: SF.getImageUri(card, 'normal') ?? '',
                        set: (card.set ?? '').toUpperCase(),
                    });
                }
                count++;
            }
        } catch {
            errors++;
        }
    }

    saveToStorage();
    _renderAll();
    showToast(t('import_done', {n: count, errors}), errors > 0 ? 'warning' : 'success');
}

function renderBracketWidget() {
    const {bracket, gcFound, gcCount, hasB4} = calculateBracket(_deck);
    const info = BRACKET_LABELS[bracket];
    const isCasual = _deck.format === 'cmdkitchentable';

    return `
    <div class="stat-block bracket-widget">
      <p class="stat-label">⚡ Bracket</p>

      <!-- Barra de brackets -->
      <div class="bracket-bar">
        ${[1, 2, 3, 4, 5].map(b => `
          <div class="bracket-pip ${b === bracket ? 'active' : ''} ${BRACKET_LABELS[b].color.replace('text-', 'border-')}"
               title="${BRACKET_LABELS[b].label}">
            <span class="bracket-pip-num">${b}</span>
          </div>`).join('')}
      </div>

      <!-- Badge resultado -->
      <div class="bracket-badge ${info.bg} border rounded-lg px-2 py-1 mt-2">
        <span class="text-xs font-bold ${info.color}">${isCasual ? '🍺 ' : ''}${info.label}</span>
        <p class="text-[10px] text-slate-400 mt-0.5">${info.desc}</p>
      </div>

      <!-- Game Changers encontrados -->
      ${gcCount > 0 ? `
        <div class="mt-2">
          <p class="text-[10px] text-slate-500 mb-1 uppercase tracking-wide font-semibold">
            Game Changers (${gcCount})
          </p>
          <div class="flex flex-wrap gap-1">
            ${gcFound.map(name => `
              <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold
                           ${BRACKET4_CARDS.has(name)
        ? 'bg-red-400/15 text-red-300 border border-red-400/25'
        : 'bg-yellow-400/12 text-yellow-300 border border-yellow-400/20'}">
                ${esc(name)}
              </span>`).join('')}
          </div>
        </div>` : `
        <p class="text-[10px] text-slate-500 mt-1.5">Sin Game Changers detectados</p>`}
    </div>`;
}

