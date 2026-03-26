import Database from '@tauri-apps/plugin-sql';
import { state } from './state.js';

let _db = null;

async function getDb() {
    if (!_db) _db = await Database.load('sqlite:mtgvault.db');
    return _db;
}

// ─── HELPERS INTERNOS ─────────────────────────────────────────────────────────

function dbRowToCard(row) {
    return {
        _dbId:         row.id,
        name:          row.name,
        set:           row.set_code,
        quantity:      row.quantity,
        price:         row.price,
        priceNormal:   row.price_normal,
        priceFoil:     row.price_foil,
        isFoil:        row.is_foil === 1,
        condition:     row.condition,
        notes:         row.notes,
        imageUrl:      row.image_url,
        image:         row.image_url,
        colors:        row.colors ?? '',
        cardmarketUrl: row.cardmarket_url,
        scryfallId:    row.scryfall_id,
        id:            row.scryfall_id,
    };
}

function dbRowToDeckCard(row) {
    return {
        name:       row.name,
        quantity:   row.quantity,
        scryfallId: row.scryfall_id,
        imageUrl:   row.image_url,
        manaCost:   row.mana_cost,
        typeLine:   row.type_line,
        cmc:        row.cmc,
        colors:     row.colors ? JSON.parse(row.colors) : [],
        price:      row.price ?? 0,
    };
}

function dbRowToDeck(row, cardRows) {
    const main      = cardRows.filter(c => c.board === 'main').map(dbRowToDeckCard);
    const side      = cardRows.filter(c => c.board === 'side').map(dbRowToDeckCard);
    const cmdRow    = cardRows.find(c => c.board === 'commander');
    const compRow   = cardRows.find(c => c.board === 'companion');

    return {
        _dbId:      row.id,
        id:         row.id,
        name:       row.name,
        format:     row.format,
        url:        row.url,
        notes:      row.notes,
        createdAt:  row.created_at,
        mainboard:  main,
        sideboard:  side,
        commander:  cmdRow  ? dbRowToDeckCard(cmdRow)  : null,
        companion:  compRow ? dbRowToDeckCard(compRow) : null,
    };
}

async function insertDeckCard(db, deckId, card, board) {
    await db.execute(
        `INSERT INTO deck_cards
             (deck_id, name, quantity, board, scryfall_id, image_url,
              mana_cost, type_line, cmc, colors, price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
            deckId,
            card.name,
            card.quantity   ?? 1,
            board,
            card.scryfallId ?? card.id          ?? null,
            card.imageUrl   ?? card.image        ?? null,
            card.manaCost   ?? card.mana_cost    ?? null,
            card.typeLine   ?? card.type_line    ?? null,
            card.cmc        ?? null,
            card.colors     ? JSON.stringify(card.colors) : null,
            card.price      ?? 0,
        ]
    );
}

// ─── LOAD / SAVE ──────────────────────────────────────────────────────────────

export async function loadFromStorage() {
    const db = await getDb();

    // Carpetas + cartas
    const folders = await db.select('SELECT * FROM folders ORDER BY name ASC');
    state.folders = {};
    for (const folder of folders) {
        const cards = await db.select(
            'SELECT * FROM collection_cards WHERE folder_id = $1 ORDER BY name ASC',
            [folder.id]
        );
        state.folders[folder.name] = cards.map(dbRowToCard);
    }

    // Mazos + sus cartas
    const decks = await db.select('SELECT * FROM decks ORDER BY updated_at DESC');
    state.decks = [];
    for (const deck of decks) {
        const cardRows = await db.select(
            'SELECT * FROM deck_cards WHERE deck_id = $1',
            [deck.id]
        );
        state.decks.push(dbRowToDeck(deck, cardRows));
    }
}

// Mantenida por compatibilidad — no-op, cada operación persiste directamente
export function saveToStorage() {
    console.debug('[MTGVault] saveToStorage() → no-op, persistencia en SQLite');
}

// ─── CARPETAS ────────────────────────────────────────────────────────────────

export async function ensureFolder(folderName) {
    const db = await getDb();
    await db.execute('INSERT OR IGNORE INTO folders (name) VALUES ($1)', [folderName]);
    const rows = await db.select('SELECT id FROM folders WHERE name = $1', [folderName]);
    return rows[0].id;
}

export async function renameFolderInDb(oldName, newName) {
    const db = await getDb();
    await db.execute('UPDATE folders SET name = $1 WHERE name = $2', [newName, oldName]);
}

export async function deleteFolderFromDb(folderName) {
    const db = await getDb();
    await db.execute('DELETE FROM folders WHERE name = $1', [folderName]);
}

// ─── CARTAS DE COLECCIÓN ──────────────────────────────────────────────────────

export async function saveCollectionCard(folderName, card) {
    const db       = await getDb();
    const folderId = await ensureFolder(folderName);
    const result   = await db.execute(
        `INSERT INTO collection_cards
         (folder_id, name, set_code, quantity, price, price_normal, price_foil,
          is_foil, condition, notes, image_url, colors, cardmarket_url, scryfall_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
            folderId,
            card.name,
            card.set           ?? null,
            card.quantity      ?? 1,
            card.price         ?? 0,
            card.priceNormal   ?? card.price ?? 0,
            card.priceFoil     ?? 0,
            card.isFoil        ? 1 : 0,
            card.condition     ?? 'NM',
            card.notes         ?? '',
            card.imageUrl      ?? card.image ?? null,
            card.colors        ?? null,
            card.cardmarketUrl ?? card.cardmarket_url ?? null,
            card.scryfallId    ?? card.id ?? null,
        ]
    );
    return result.lastInsertId;
}

export async function updateCollectionCard(dbId, fields) {
    const db  = await getDb();
    const map = {
        quantity:     fields.quantity,
        condition:    fields.condition,
        notes:        fields.notes,
        is_foil:      fields.isFoil     !== undefined ? (fields.isFoil ? 1 : 0) : undefined,
        price:        fields.price,
        price_normal: fields.priceNormal,
        price_foil:   fields.priceFoil,
    };
    const sets = [], vals = [];
    let i = 1;
    for (const [col, val] of Object.entries(map)) {
        if (val !== undefined) { sets.push(`${col} = $${i++}`); vals.push(val); }
    }
    if (!sets.length) return;
    vals.push(dbId);
    await db.execute(`UPDATE collection_cards SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

export async function deleteCollectionCard(dbId) {
    const db = await getDb();
    await db.execute('DELETE FROM collection_cards WHERE id = $1', [dbId]);
}

export async function saveFolderCards(folderName, cards) {
    const db       = await getDb();
    const folderId = await ensureFolder(folderName);
    await db.execute('DELETE FROM collection_cards WHERE folder_id = $1', [folderId]);
    for (const card of cards) {
        await db.execute(
            `INSERT INTO collection_cards
                 (folder_id, name, set_code, quantity, price, price_normal, price_foil,
                  is_foil, condition, notes, image_url, colors, cardmarket_url, scryfall_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [
                folderId,
                card.name,
                card.set           ?? null,
                card.quantity      ?? 1,
                card.price         ?? 0,
                card.priceNormal   ?? card.price ?? 0,
                card.priceFoil     ?? 0,
                card.isFoil        ? 1 : 0,
                card.condition     ?? 'NM',
                card.notes         ?? '',
                card.imageUrl      ?? card.image ?? null,
                card.colors        ?? null,
                card.cardmarketUrl ?? card.cardmarket_url ?? null,
                card.scryfallId    ?? card.id ?? null,
            ]
        );
    }
}

// ─── MAZOS ───────────────────────────────────────────────────────────────────

export async function saveDeck(deck) {
    const db    = await getDb();
    let deckId  = deck._dbId ?? null;

    // Compatibilidad con formato antiguo (cards en vez de mainboard)
    const mainboard = deck.mainboard ?? deck.cards ?? [];
    const sideboard = deck.sideboard ?? [];

    if (deckId) {
        await db.execute(
            `UPDATE decks
             SET name = $1, format = $2, url = $3, notes = $4, updated_at = datetime('now')
             WHERE id = $5`,
            [deck.name, deck.format ?? 'modern', deck.url ?? '', deck.notes ?? '', deckId]
        );
    } else {
        const r = await db.execute(
            'INSERT INTO decks (js_id, name, format, url, notes) VALUES ($1,$2,$3,$4,$5)',
            [
                String(deck.id ?? Date.now()),
                deck.name,
                deck.format ?? 'modern',
                deck.url   ?? '',
                deck.notes ?? '',
            ]
        );
        deckId = r.lastInsertId;
    }

    // Reemplazar todas las cartas del mazo
    await db.execute('DELETE FROM deck_cards WHERE deck_id = $1', [deckId]);

    for (const card of mainboard) {
        await insertDeckCard(db, deckId, card, 'main');
    }
    for (const card of sideboard) {
        await insertDeckCard(db, deckId, card, 'side');
    }
    if (deck.commander) {
        await insertDeckCard(db, deckId, { ...deck.commander, quantity: 1 }, 'commander');
    }
    if (deck.companion) {
        await insertDeckCard(db, deckId, { ...deck.companion, quantity: 1 }, 'companion');
    }

    return deckId;
}

export async function deleteDeck(deckId) {
    const db = await getDb();
    await db.execute('DELETE FROM decks WHERE id = $1', [deckId]);
}

// ─── WISHLIST ─────────────────────────────────────────────────────────────────

export async function getWishlist() {
    const db   = await getDb();
    const rows = await db.select('SELECT data FROM wishlist ORDER BY priority DESC');
    return rows.map(r => JSON.parse(r.data));
}

export async function saveWishlistItem(item) {
    const db = await getDb();
    await db.execute(
        'INSERT OR REPLACE INTO wishlist (id, name, priority, data) VALUES ($1,$2,$3,$4)',
        [String(item.id), item.name ?? '', item.priority ?? 0, JSON.stringify(item)]
    );
}

export async function deleteWishlistItem(id) {
    const db = await getDb();
    await db.execute('DELETE FROM wishlist WHERE id = $1', [String(id)]);
}

// ─── HISTORIAL DE PRECIOS ────────────────────────────────────────────────────

export async function savePriceSnapshot(value) {
    const db    = await getDb();
    const today = new Date().toISOString().slice(0, 10);
    await db.execute(
        'INSERT OR REPLACE INTO price_history (date, value) VALUES ($1,$2)',
        [today, parseFloat(value.toFixed(2))]
    );
}

export async function getPriceHistory(days = 60) {
    const db     = await getDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return await db.select(
        'SELECT date, value FROM price_history WHERE date >= $1 ORDER BY date ASC',
        [cutoff.toISOString().slice(0, 10)]
    );
}