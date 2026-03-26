/**
 * Cliente oficial de la API de Scryfall.
 * Rate limit: máx 10 req/s → forzamos 100ms entre llamadas.
 * Documentación: https://scryfall.com/docs/api
 */

const BASE = 'https://api.scryfall.com';
let _lastRequest = 0;

async function rateLimited(fn) {
    const wait = Math.max(0, _lastRequest + 110 - Date.now());
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    _lastRequest = Date.now();
    return fn();
}

async function apiFetch(path) {
    return rateLimited(async () => {
        const res = await fetch(`${BASE}${path}`);
        if (res.status === 404) throw new ScryfallError('not_found', 404);
        if (res.status === 422) throw new ScryfallError('bad_query', 422);
        if (!res.ok) throw new ScryfallError(`HTTP ${res.status}`, res.status);
        return res.json();
    });
}

export class ScryfallError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ScryfallError';
        this.status = status;
    }
}

// ── BÚSQUEDA ───────────────────────────────────────────────────
export function searchCards(query, {page = 1, order = 'name', dir = 'asc'} = {}) {
    const params = new URLSearchParams({
        q: query, order, dir,
        page: String(page),
        include_extras: 'false',
        include_multilingual: 'false',
    });
    return apiFetch(`/cards/search?${params}`);
}

// ── CARTA INDIVIDUAL ───────────────────────────────────────────
export function getCardById(id) {
    return apiFetch(`/cards/${id}`);
}

export function getCardByName(name, set = '') {
    const params = new URLSearchParams({fuzzy: name});
    if (set) params.set('set', set);
    return apiFetch(`/cards/named?${params}`);
}

export function getCardRulings(scryfallId) {
    return apiFetch(`/cards/${scryfallId}/rulings`);
}

// ── AUTOCOMPLETE ──────────────────────────────────────────────
export async function autocomplete(query) {
    if (query.length < 2) return [];
    try {
        const res = await apiFetch(`/cards/autocomplete?q=${encodeURIComponent(query)}`);
        return res.data ?? [];
    } catch {
        return [];
    }
}

// ── BULK DATA INFO ─────────────────────────────────────────────
export function getBulkDataInfo() {
    return apiFetch('/bulk-data');
}

// ── HELPERS DE CARD OBJECT ─────────────────────────────────────
export function getImageUri(card, size = 'normal') {
    if (card.image_uris?.[size]) return card.image_uris[size];
    if (card.card_faces?.[0]?.image_uris?.[size]) return card.card_faces[0].image_uris[size];
    return null;
}

export function getCardFaces(card) {
    if (card.card_faces?.length) return card.card_faces;
    return [card];
}

export function getPrices(card) {
    return {
        eur: parseFloat(card.prices?.eur ?? 0) || 0,
        eur_foil: parseFloat(card.prices?.eur_foil ?? 0) || 0,
        usd: parseFloat(card.prices?.usd ?? 0) || 0,
        usd_foil: parseFloat(card.prices?.usd_foil ?? 0) || 0,
    };
}

export const FORMATS = ['standard', 'pioneer', 'modern', 'legacy', 'commander', 'pauper', 'vintage', 'historic'];

export function legalityClass(status) {
    return {
        legal: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
        banned: 'bg-red-400/15 text-red-400 border-red-400/30 line-through opacity-70',
        restricted: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
        not_legal: 'bg-slate-700/40 text-slate-500 border-white/5',
    }[status] ?? 'bg-slate-700/40 text-slate-500 border-white/5';
}

// ── ALIASES (usados por wishlist.js y otros módulos) ──────────
/** Alias de getCardById — usado por wishlist.js */
export const fetchById = getCardById;

/** Alias de searchCards con firma simplificada — usado por wishlist.js */
export function search(query, page = 1) {
    return searchCards(query, {page});
}
