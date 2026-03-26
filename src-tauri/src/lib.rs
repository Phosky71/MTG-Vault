use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            kind: MigrationKind::Up,
            sql: "
                CREATE TABLE IF NOT EXISTS folders (
                    id   INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE
                );

                CREATE TABLE IF NOT EXISTS collection_cards (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    folder_id      INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
                    name           TEXT NOT NULL,
                    set_code       TEXT,
                    quantity       INTEGER NOT NULL DEFAULT 1,
                    price          REAL    DEFAULT 0,
                    price_normal   REAL    DEFAULT 0,
                    price_foil     REAL    DEFAULT 0,
                    is_foil        INTEGER NOT NULL DEFAULT 0,
                    condition      TEXT    DEFAULT 'NM',
                    notes          TEXT    DEFAULT '',
                    image_url      TEXT,
                    colors         TEXT,
                    cardmarket_url TEXT,
                    scryfall_id    TEXT,
                    added_at       TEXT    DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS decks (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    js_id      TEXT,
                    name       TEXT NOT NULL,
                    format     TEXT DEFAULT 'modern',
                    url        TEXT DEFAULT '',
                    notes      TEXT DEFAULT '',
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS deck_cards (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    deck_id     INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
                    name        TEXT    NOT NULL,
                    quantity    INTEGER NOT NULL DEFAULT 1,
                    board       TEXT    NOT NULL DEFAULT 'main',
                    scryfall_id TEXT,
                    image_url   TEXT,
                    mana_cost   TEXT,
                    type_line   TEXT,
                    cmc         REAL,
                    colors      TEXT,
                    price       REAL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS wishlist (
                    id       TEXT PRIMARY KEY,
                    name     TEXT    NOT NULL,
                    priority INTEGER DEFAULT 0,
                    data     TEXT    NOT NULL
                );

                CREATE TABLE IF NOT EXISTS price_history (
                    date  TEXT PRIMARY KEY,
                    value REAL NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_cards_folder ON collection_cards(folder_id);
                CREATE INDEX IF NOT EXISTS idx_cards_name   ON collection_cards(name);
                CREATE INDEX IF NOT EXISTS idx_deck_cards   ON deck_cards(deck_id);
                CREATE INDEX IF NOT EXISTS idx_wl_priority  ON wishlist(priority DESC);
            ",
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:mtgvault.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("Error al iniciar MTG Vault");
}