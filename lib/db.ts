// SQLite connection + schema bootstrap.
// Single shared connection per Node process (better-sqlite3 is synchronous,
// so we don't need a pool). Database file location comes from DB_PATH env;
// fallback to a project-local ./data/portfolio.db for `npm run dev`.

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DB_PATH || './data/portfolio.db';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (_db) return _db;

    const dir = dirname(DB_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');   // concurrent reads while writing
    _db.pragma('foreign_keys = ON');
    _db.pragma('synchronous = NORMAL'); // good durability/speed trade-off

    // Schema — idempotent; safe to run on every cold start.
    _db.exec(`
        CREATE TABLE IF NOT EXISTS holdings (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT    NOT NULL DEFAULT 'default',
            symbol      TEXT    NOT NULL,
            quantity    REAL    NOT NULL,
            avg_cost    REAL    NOT NULL,
            currency    TEXT    NOT NULL DEFAULT 'USD',
            broker      TEXT    NOT NULL DEFAULT 'manual',
            notes       TEXT,
            added_at    INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL,
            UNIQUE(user_id, symbol)
        );

        CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);
    `);

    return _db;
}

// Reset for tests / explicit reload.
export function closeDb() {
    if (_db) { _db.close(); _db = null; }
}
