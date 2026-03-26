import { state } from './state.js';
import {
    ensureFolder,
    saveFolderCards,
    saveDeck,
    saveWishlistItem,
    getPriceHistory as sqlGetPriceHistory,
} from './storage.js';
import { initDB } from './db.js';

const MIGRATION_KEY = 'mtgvault_sqlite_migrated_v1';

// Lee la wishlist directamente desde IndexedDB sin depender de db.js
function idbReadAll(storeName) {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('mtg_vault_db');
        req.onsuccess = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.close();
                return resolve([]);
            }
            const tx  = db.transaction(storeName, 'readonly');
            const req2 = tx.objectStore(storeName).getAll();
            req2.onsuccess = ev => { db.close(); resolve(ev.target.result ?? []); };
            req2.onerror   = ev => { db.close(); reject(ev.target.error); };
        };
        req.onerror = e => resolve([]); // Si no existe, ignorar
    });
}

export async function migrateToSQLite() {
    if (localStorage.getItem(MIGRATION_KEY)) return false;

    console.log('[MTGVault] Iniciando migración a SQLite...');
    let didMigrate = false;

    try {
        // ── 1. Carpetas + cartas (localStorage) ──────────────────────────────
        const rawFolders = localStorage.getItem('mtg_vault_folders');
        if (rawFolders) {
            const folders = JSON.parse(rawFolders); // { [folderName]: Card[] }
            for (const [folderName, cards] of Object.entries(folders)) {
                if (Array.isArray(cards) && cards.length > 0) {
                    await saveFolderCards(folderName, cards);
                    console.log(`  ✓ Carpeta "${folderName}": ${cards.length} cartas`);
                } else {
                    await ensureFolder(folderName);
                    console.log(`  ✓ Carpeta vacía "${folderName}"`);
                }
            }
            didMigrate = true;
        }

        // ── 2. Mazos (localStorage) ──────────────────────────────────────────
        const rawDecks = localStorage.getItem('mtg_vault_decks');
        if (rawDecks) {
            const decks = JSON.parse(rawDecks);
            for (const deck of decks) {
                await saveDeck(deck);
            }
            console.log(`  ✓ Mazos: ${decks.length}`);
            didMigrate = true;
        }

        // ── 3. Wishlist (IndexedDB) ──────────────────────────────────────────
        const wishlistItems = await idbReadAll('wishlist');
        for (const item of wishlistItems) {
            await saveWishlistItem(item);
        }
        if (wishlistItems.length) {
            console.log(`  ✓ Wishlist: ${wishlistItems.length} items`);
            didMigrate = true;
        }

        // ── 4. Historial de precios (IndexedDB) ──────────────────────────────
        const priceRows = await idbReadAll('priceHistory');
        if (priceRows.length) {
            const { default: Database } = await import('@tauri-apps/plugin-sql');
            const db = await Database.load('sqlite:mtgvault.db');
            for (const entry of priceRows) {
                await db.execute(
                    'INSERT OR IGNORE INTO price_history (date, value) VALUES ($1, $2)',
                    [entry.date, entry.value]
                );
            }
            console.log(`  ✓ Historial de precios: ${priceRows.length} entradas`);
        }

        // ── Marcar como completada ────────────────────────────────────────────
        localStorage.setItem(MIGRATION_KEY, '1');
        console.log('[MTGVault] Migración completada ✓');
        return didMigrate;

    } catch (err) {
        console.error('[MTGVault] Error en migración (se reintentará al próximo arranque):', err);
        return false;
    }
}