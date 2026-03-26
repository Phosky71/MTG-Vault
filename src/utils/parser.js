/**
 * parser.js — Soporte multi-formato CSV para MTG
 *
 * Formatos soportados (auto-detección por cabeceras):
 *   • Manabox
 *   • Dragonshield
 *   • Moxfield
 *   • Deckbox
 *   • MTGGoldfish
 *   • MTGStocks
 *   • Genérico / fallback
 */

// ── Mapas de normalización ────────────────────────────────────

const CONDITION_MAP = {
    // Manabox
    near_mint: 'NM', lightly_played: 'LP', moderately_played: 'MP',
    heavily_played: 'HP', damaged: 'DMG',
    // Dragonshield
    nearmint: 'NM', lightlyplayed: 'LP', moderatelyplayed: 'MP',
    heavilyplayed: 'HP',
    // Moxfield
    'near mint': 'NM', mint: 'NM',
    'good (lightly played)': 'LP', played: 'HP', 'heavily played': 'HP',
    // Deckbox / MTGGoldfish / genérico
    /*'near mint': 'NM',*/ 'lightly played': 'LP', 'moderately played': 'MP',
    // 'heavily played': 'HP',
    // Abreviados
    nm: 'NM', lp: 'LP', mp: 'MP', hp: 'HP', dmg: 'DMG', sp: 'MP',
};

const FOIL_TRUE = new Set(['foil', 'yes', 'true', '1', 'etched']);

const RARITY_MAP = {
    common: 'common', uncommon: 'uncommon',
    rare: 'rare', mythic: 'mythic',
    special: 'special', bonus: 'bonus', land: 'common',
    c: 'common', u: 'uncommon', r: 'rare', m: 'mythic',
};

// ── PARSER CSV RFC-4180 ───────────────────────────────────────

/**
 * Parsea texto CSV con soporte para campos entre comillas (comas internas).
 */
export function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length < 2) return [];

    // Detectar separador (coma vs punto y coma)
    const sep = _detectSeparator(lines[0]);

    const rawHeaders = parseCSVLine(lines[0], sep);
    const header     = rawHeaders.map(h =>
        h.trim().toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
    );

    // Detectar formato
    const fmt = detectFormat(header);

    const cards = [];
    for (let i = 1; i < lines.length; i++) {
        const raw = lines[i].trim();
        if (!raw) continue;

        const cols = parseCSVLine(raw, sep);
        const row  = {};
        header.forEach((h, idx) => { row[h] = (cols[idx] ?? '').trim(); });

        const card = PARSERS[fmt]?.(row) ?? parseGeneric(row);
        if (card?.name) cards.push(card);
    }

    return cards;
}

function _detectSeparator(headerLine) {
    const commas     = (headerLine.match(/,/g)     ?? []).length;
    const semicolons = (headerLine.match(/;/g)     ?? []).length;
    return semicolons > commas ? ';' : ',';
}

function parseCSVLine(line, sep = ',') {
    const result  = [];
    let   current = '';
    let   inQ     = false;

    for (let i = 0; i < line.length; i++) {
        const ch   = line[i];
        const next = line[i + 1];

        if (inQ) {
            if (ch === '"' && next === '"') { current += '"'; i++; }
            else if (ch === '"')            { inQ = false; }
            else                            { current += ch; }
        } else {
            if      (ch === '"')  { inQ = true; }
            else if (ch === sep)  { result.push(current); current = ''; }
            else                  { current += ch; }
        }
    }
    result.push(current);
    return result;
}

// ── DETECCIÓN DE FORMATO ──────────────────────────────────────

/**
 * Devuelve el formato detectado a partir de las cabeceras normalizadas.
 */
export function detectFormat(headers) {
    const h = new Set(headers);

    if (h.has('manabox_id') || (h.has('scryfall_id') && h.has('set_code')))
        return 'manabox';

    if (h.has('folder_name') || h.has('trade_quantity'))
        return 'dragonshield';

    if (h.has('tradelist_count') || (h.has('count') && h.has('edition') && h.has('tradelist_count')))
        return 'deckbox';

    if (h.has('count') && h.has('edition') && !h.has('tradelist_count'))
        return 'moxfield';

    if (h.has('product_line') || h.has('tcg_market_price') || h.has('total_quantity'))
        return 'tcgplayer';

    if ((h.has('card') || h.has('name')) && h.has('set_id'))
        return 'mtggoldfish';

    if (h.has('set') && h.has('card') && h.has('quantity'))
        return 'mtgstocks';

    return 'generic';
}

// ── PARSERS POR FORMATO ───────────────────────────────────────

const PARSERS = {
    manabox,
    dragonshield,
    moxfield,
    deckbox,
    tcgplayer,
    mtggoldfish,
    mtgstocks,
    generic: parseGeneric,
};

// ──────────────────────────────────────────────────────────────
// MANABOX
// Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,
// ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,
// Language,Purchase price currency
// ──────────────────────────────────────────────────────────────
function manabox(row) {
    const name = row['name']; if (!name) return null;
    const isFoil = FOIL_TRUE.has((row['foil'] ?? '').toLowerCase());
    const price  = parseFloat(row['purchase_price'] ?? '0') || 0;

    return _card({
        name,
        quantity:  _qty(row['quantity']),
        price,
        isFoil,
        priceNormal: isFoil ? 0 : price,
        priceFoil:   isFoil ? price : 0,
        condition:   _condition(row['condition']),
        rarity:      _rarity(row['rarity']),
        set:         (row['set_code'] ?? '').toUpperCase(),
        setName:     row['set_name'] ?? '',
        language:    row['language'] ?? 'en',
        scryfallId:  row['scryfall_id'] ?? '',
        collectorNumber: row['collector_number'] ?? '',
        imageUrl:    _scryfallImg(row['scryfall_id']),
        notes:       _manaboxNotes(row),
    });
}

function _manaboxNotes(row) {
    const flags = [
        row['misprint'] === 'true' ? 'Misprint' : '',
        row['altered']  === 'true' ? 'Altered'  : '',
    ].filter(Boolean);
    return flags.length ? flags.join(', ') : undefined;
}

// ──────────────────────────────────────────────────────────────
// DRAGONSHIELD
// Folder Name,Quantity,Trade Quantity,Card Name,Set Code,Set Name,
// Card Number,Condition,Language,Foil,Signed,Artist Proof,
// Altered Art,Misprint,Promo,Textless,My Price
// ──────────────────────────────────────────────────────────────
function dragonshield(row) {
    const name = row['card_name'] ?? row['name']; if (!name) return null;
    const isFoil  = FOIL_TRUE.has((row['foil'] ?? '').toLowerCase());
    const price   = parseFloat((row['my_price'] ?? '0').replace(/[$€£]/g, '')) || 0;

    return _card({
        name,
        quantity:  _qty(row['quantity']),
        price,
        isFoil,
        priceNormal: isFoil ? 0 : price,
        priceFoil:   isFoil ? price : 0,
        condition:   _condition(row['condition']),
        rarity:      _rarity(row['rarity'] ?? ''),
        set:         (row['set_code'] ?? '').toUpperCase(),
        setName:     row['set_name'] ?? '',
        language:    row['language'] ?? 'en',
        collectorNumber: row['card_number'] ?? '',
        notes:       [
            row['signed']       === '1' ? 'Signed'        : '',
            row['artist_proof'] === '1' ? 'Artist Proof'  : '',
            row['altered_art']  === '1' ? 'Altered'        : '',
            row['misprint']     === '1' ? 'Misprint'       : '',
        ].filter(Boolean).join(', ') || undefined,
    });
}

// ──────────────────────────────────────────────────────────────
// MOXFIELD
// Count,Name,Edition,Condition,Language,Foil,Collector Number,
// Alter,Proxy,Purchase Price
// ──────────────────────────────────────────────────────────────
function moxfield(row) {
    const name = row['name']; if (!name) return null;
    const isFoil = FOIL_TRUE.has((row['foil'] ?? '').toLowerCase());
    const price  = parseFloat((row['purchase_price'] ?? '0').replace(/[$€£]/g, '')) || 0;

    return _card({
        name,
        quantity:  _qty(row['count']),
        price,
        isFoil,
        priceNormal: isFoil ? 0 : price,
        priceFoil:   isFoil ? price : 0,
        condition:   _condition(row['condition']),
        set:         (row['edition'] ?? '').toUpperCase(),
        language:    _moxfieldLang(row['language'] ?? 'English'),
        collectorNumber: row['collector_number'] ?? '',
        notes:       row['alter'] === '1' ? 'Altered' : undefined,
    });
}

const MOXFIELD_LANG = {
    english: 'en', spanish: 'es', french: 'fr', german: 'de',
    italian: 'it', portuguese: 'pt', japanese: 'ja', korean: 'ko',
    russian: 'ru', chinese: 'zhs', 'traditional chinese': 'zht',
};
function _moxfieldLang(lang) {
    return MOXFIELD_LANG[lang.toLowerCase()] ?? lang.toLowerCase().slice(0, 2);
}

// ──────────────────────────────────────────────────────────────
// DECKBOX
// Count,Tradelist Count,Name,Edition,Card Number,Condition,
// Language,Foil,Signed,Artist Proof,Altered Art,Misprint,
// Promo,Textless,My Price
// ──────────────────────────────────────────────────────────────
function deckbox(row) {
    const name = row['name']; if (!name) return null;
    const isFoil = FOIL_TRUE.has((row['foil'] ?? '').toLowerCase());
    const price  = parseFloat((row['my_price'] ?? '0').replace(/[$€£]/g, '')) || 0;

    return _card({
        name,
        quantity:  _qty(row['count']),
        price,
        isFoil,
        priceNormal: isFoil ? 0 : price,
        priceFoil:   isFoil ? price : 0,
        condition:   _condition(row['condition']),
        set:         (row['edition'] ?? '').toUpperCase(),
        language:    _moxfieldLang(row['language'] ?? 'English'),
        collectorNumber: row['card_number'] ?? '',
        notes:       [
            row['signed']       ? 'Signed'       : '',
            row['artist_proof'] ? 'Artist Proof' : '',
            row['altered_art']  ? 'Altered'      : '',
            row['misprint']     ? 'Misprint'     : '',
        ].filter(Boolean).join(', ') || undefined,
    });
}

// ──────────────────────────────────────────────────────────────
// TCGPLAYER
// Quantity,Product Line,Set Name,Product Name,Title,Number,
// Rarity,Condition,TCG Market Price,...
// ──────────────────────────────────────────────────────────────
function tcgplayer(row) {
    const name = row['product_name'] ?? row['title'] ?? row['name'];
    if (!name) return null;
    const isFoil = (row['printing'] ?? row['finish'] ?? '').toLowerCase().includes('foil');
    const price  = parseFloat(row['tcg_market_price'] ?? row['my_price'] ?? '0') || 0;

    return _card({
        name,
        quantity:  _qty(row['quantity'] ?? row['add_to_quantity']),
        price,
        isFoil,
        priceNormal: isFoil ? 0 : price,
        priceFoil:   isFoil ? price : 0,
        condition:   _condition(row['condition']),
        rarity:      _rarity(row['rarity'] ?? ''),
        setName:     row['set_name'] ?? '',
        collectorNumber: row['number'] ?? '',
    });
}

// ──────────────────────────────────────────────────────────────
// MTGGOLDFISH
// Card,Set ID,Set Name,Quantity,Foil
// ──────────────────────────────────────────────────────────────
function mtggoldfish(row) {
    const name = row['card'] ?? row['name']; if (!name) return null;
    const isFoil = FOIL_TRUE.has((row['foil'] ?? '').toLowerCase());

    return _card({
        name,
        quantity:  _qty(row['quantity']),
        isFoil,
        set:       (row['set_id'] ?? row['set'] ?? '').toUpperCase(),
        setName:   row['set_name'] ?? '',
    });
}

// ──────────────────────────────────────────────────────────────
// MTGSTOCKS
// "Card","Set","Quantity","Price","Condition","Language","Foil","Signed"
// ──────────────────────────────────────────────────────────────
function mtgstocks(row) {
    const name = row['card'] ?? row['name']; if (!name) return null;
    const isFoil = FOIL_TRUE.has((row['foil'] ?? '').toLowerCase());
    const price  = parseFloat(row['price'] ?? '0') || 0;

    return _card({
        name,
        quantity:  _qty(row['quantity']),
        price,
        isFoil,
        priceNormal: isFoil ? 0 : price,
        priceFoil:   isFoil ? price : 0,
        condition:   _condition(row['condition']),
        language:    row['language'] ?? 'en',
        set:         (row['set'] ?? '').toUpperCase(),
        notes:       row['signed'] === '1' ? 'Signed' : undefined,
    });
}

// ──────────────────────────────────────────────────────────────
// GENÉRICO — intenta adivinar columnas por nombre
// ──────────────────────────────────────────────────────────────
function parseGeneric(row) {
    const name = row['name']      ?? row['card_name'] ?? row['card']
        ?? row['title']    ?? row['product_name'];
    if (!name) return null;

    const qty  = _qty(row['quantity'] ?? row['count'] ?? row['qty'] ?? row['amount'] ?? '1');
    const isFoil = FOIL_TRUE.has(
        (row['foil'] ?? row['finish'] ?? row['printing'] ?? '').toLowerCase()
    );
    const price = parseFloat(
        (row['price'] ?? row['purchase_price'] ?? row['my_price']
            ?? row['value'] ?? row['market_price'] ?? '0').replace(/[$€£]/g, '')
    ) || 0;
    const set = (
        row['set'] ?? row['set_code'] ?? row['edition']
        ?? row['set_id'] ?? row['expansion'] ?? ''
    ).toUpperCase();

    return _card({
        name,
        quantity: qty,
        price,
        isFoil,
        priceNormal: isFoil ? 0 : price,
        priceFoil:   isFoil ? price : 0,
        condition:   _condition(row['condition'] ?? ''),
        rarity:      _rarity(row['rarity'] ?? ''),
        set,
        setName:     row['set_name'] ?? '',
        language:    row['language'] ?? 'en',
        scryfallId:  row['scryfall_id'] ?? row['scryfallid'] ?? '',
        collectorNumber: row['collector_number'] ?? row['card_number'] ?? row['number'] ?? '',
        imageUrl:    _scryfallImg(row['scryfall_id'] ?? row['scryfallid']),
        colors:      row['colors'] ?? row['color_identity'] ?? row['color'] ?? '',
    });
}

// ── HELPERS INTERNOS ──────────────────────────────────────────

/** Construye el objeto carta normalizado con defaults */
function _card(fields) {
    return {
        name:            fields.name,
        quantity:        fields.quantity        ?? 1,
        price:           fields.price           ?? 0,
        priceNormal:     fields.priceNormal     ?? 0,
        priceFoil:       fields.priceFoil       ?? 0,
        isFoil:          fields.isFoil          ?? false,
        condition:       fields.condition       ?? 'NM',
        rarity:          fields.rarity          ?? '',
        set:             fields.set             ?? '',
        setName:         fields.setName         ?? '',
        language:        fields.language        ?? 'en',
        scryfallId:      fields.scryfallId      ?? '',
        collectorNumber: fields.collectorNumber ?? '',
        imageUrl:        fields.imageUrl        ?? '',
        colors:          fields.colors          ?? '',
        notes:           fields.notes,
    };
}

function _qty(val) {
    const n = parseInt(val ?? '1', 10);
    return Math.max(1, isNaN(n) ? 1 : n);
}

function _condition(raw) {
    const key = (raw ?? '').toLowerCase().trim()
        .replace(/[\s\-–]/g, '_')
        .replace(/_+/g, '_');
    return CONDITION_MAP[key] ?? CONDITION_MAP[key.replace(/_/g, '')] ?? 'NM';
}

function _rarity(raw) {
    return RARITY_MAP[(raw ?? '').toLowerCase().trim()] ?? '';
}

function _scryfallImg(id) {
    if (!id || id.length < 8) return '';
    return `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg`;
}
