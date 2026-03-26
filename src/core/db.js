/**
 * IndexedDB wrapper para MTG Vault.
 * Almacena en local:
 *   • cards      — cartas cacheadas de Scryfall
 *   • rulings    — reglas de cartas
 *   • searches   — resultados de búsqueda (TTL 1h por defecto)
 */

const DB_NAME = 'mtg_vault_db';
const DB_VERSION = 3;

let _db = null;

export async function initDB() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = ({target: {result: db}}) => {
            if (!db.objectStoreNames.contains('cards')) {
                const cs = db.createObjectStore('cards', {keyPath: 'id'});
                cs.createIndex('by_name', 'name', {unique: false});
                cs.createIndex('by_oracle_id', 'oracle_id', {unique: false});
                cs.createIndex('by_set', 'set', {unique: false});
                cs.createIndex('by_cached_at', 'cached_at', {unique: false});
            }
            if (!db.objectStoreNames.contains('rulings')) {
                db.createObjectStore('rulings', {keyPath: 'card_id'});
            }
            if (!db.objectStoreNames.contains('searches')) {
                const ss = db.createObjectStore('searches', {keyPath: 'key'});
                ss.createIndex('by_ts', 'ts', {unique: false});
            }
            if (!db.objectStoreNames.contains('priceHistory')) {
                db.createObjectStore('priceHistory', {keyPath: 'date'});
            }
            if (!db.objectStoreNames.contains('wishlist')) {
                const ws = db.createObjectStore('wishlist', {keyPath: 'id'});
                ws.createIndex('by_priority', 'priority', {unique: false});
                ws.createIndex('by_name', 'name', {unique: false});
            }
        };

        req.onsuccess = e => {
            _db = e.target.result;
            resolve(_db);
        };
        req.onerror = e => reject(e.target.error);
    });
}

// ── GENÉRICOS ─────────────────────────────────────────────────
function tx(store, mode = 'readonly') {
    return _db.transaction([store], mode).objectStore(store);
}

function idbGet(store, key) {
    return new Promise((res, rej) => {
        const req = tx(store).get(key);
        req.onsuccess = e => res(e.target.result ?? null);
        req.onerror = e => rej(e.target.error);
    });
}

function idbPut(store, value) {
    return new Promise((res, rej) => {
        const req = tx(store, 'readwrite').put(value);
        req.onsuccess = () => res();
        req.onerror = e => rej(e.target.error);
    });
}

function idbClear(store) {
    return new Promise((res, rej) => {
        const req = tx(store, 'readwrite').clear();
        req.onsuccess = () => res();
        req.onerror = e => rej(e.target.error);
    });
}

// ── CARTAS ────────────────────────────────────────────────────
export async function cacheCards(cards) {
    await initDB();
    const now = Date.now();
    const db = _db;
    return new Promise((res, rej) => {
        const t = db.transaction(['cards'], 'readwrite');
        const s = t.objectStore('cards');
        cards.forEach(c => s.put({...c, cached_at: now}));
        t.oncomplete = res;
        t.onerror = e => rej(e.target.error);
    });
}

export async function getCachedCard(id) {
    await initDB();
    return idbGet('cards', id);
}

// ── RULINGS ───────────────────────────────────────────────────
export async function cacheRulings(cardId, rulings) {
    await initDB();
    return idbPut('rulings', {card_id: cardId, data: rulings, ts: Date.now()});
}

export async function getCachedRulings(cardId, maxAgeMs = 86_400_000) { // 24h
    await initDB();
    const row = await idbGet('rulings', cardId);
    if (row && (Date.now() - row.ts) < maxAgeMs) return row.data;
    return null;
}

// ── BÚSQUEDAS ─────────────────────────────────────────────────
export async function cacheSearch(key, result) {
    await initDB();
    return idbPut('searches', {key, result, ts: Date.now()});
}

export async function getCachedSearch(key, maxAgeMs = 3_600_000) { // 1h
    await initDB();
    const row = await idbGet('searches', key);
    if (row && (Date.now() - row.ts) < maxAgeMs) return row.result;
    return null;
}

// ── ESTADÍSTICAS Y LIMPIEZA ───────────────────────────────────
export async function getDBStats() {
    await initDB();
    const counts = {};
    for (const store of ['cards', 'rulings', 'searches']) {
        counts[store] = await new Promise((res, rej) => {
            const req = tx(store).count();
            req.onsuccess = e => res(e.target.result);
            req.onerror = e => rej(e.target.error);
        });
    }
    return counts;
}

export async function clearCache() {
    await initDB();
    await Promise.all(['cards', 'rulings', 'searches'].map(idbClear));
}

export async function savePriceSnapshot(value) {
    const db = await initDB();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return new Promise((res, rej) => {
        const tx = db.transaction('priceHistory', 'readwrite');
        const store = tx.objectStore('priceHistory');
        const req = store.put({date: today, value: parseFloat(value.toFixed(2))});
        req.onsuccess = () => res();
        req.onerror = e => rej(e.target.error);
    });
}

export async function getPriceHistory(days = 60) {
    const db = await initDB();
    return new Promise((res, rej) => {
        const tx = db.transaction('priceHistory', 'readonly');
        const store = tx.objectStore('priceHistory');
        const req = store.getAll();
        req.onsuccess = e => {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            const result = (e.target.result ?? [])
                .filter(r => new Date(r.date) >= cutoff)
                .sort((a, b) => a.date.localeCompare(b.date));
            res(result);
        };
        req.onerror = e => rej(e.target.error);
    });
}

export async function getWishlist() {
    const db = await initDB();
    return new Promise((res, rej) => {
        const req = db.transaction('wishlist', 'readonly')
            .objectStore('wishlist').getAll();
        req.onsuccess = e => res(e.target.result ?? []);
        req.onerror = e => rej(e.target.error);
    });
}

export async function saveWishlistItem(item) {
    const db = await initDB();
    return new Promise((res, rej) => {
        const req = db.transaction('wishlist', 'readwrite')
            .objectStore('wishlist').put(item);
        req.onsuccess = () => res();
        req.onerror = e => rej(e.target.error);
    });
}

export async function deleteWishlistItem(id) {
    const db = await initDB();
    return new Promise((res, rej) => {
        const req = db.transaction('wishlist', 'readwrite')
            .objectStore('wishlist').delete(id);
        req.onsuccess = () => res();
        req.onerror = e => rej(e.target.error);
    });
}


