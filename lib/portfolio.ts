// Server-side portfolio CRUD on top of better-sqlite3.
// All routes use a single 'default' user for now — auth is password-only and
// the app is single-tenant. Easy to scope to multi-user later via user_id.

import { getDb } from './db';

export interface Holding {
    id: number;
    userId: string;
    symbol: string;
    quantity: number;
    avgCost: number;
    currency: string;
    broker: string;
    notes: string | null;
    addedAt: number;
    updatedAt: number;
}

export interface HoldingInput {
    symbol: string;
    quantity: number;
    avgCost: number;
    currency?: string;
    broker?: string;
    notes?: string | null;
}

const DEFAULT_USER = 'default';

type Row = {
    id: number;
    user_id: string;
    symbol: string;
    quantity: number;
    avg_cost: number;
    currency: string;
    broker: string;
    notes: string | null;
    added_at: number;
    updated_at: number;
};

const rowToHolding = (r: Row): Holding => ({
    id: r.id,
    userId: r.user_id,
    symbol: r.symbol,
    quantity: r.quantity,
    avgCost: r.avg_cost,
    currency: r.currency,
    broker: r.broker,
    notes: r.notes,
    addedAt: r.added_at,
    updatedAt: r.updated_at,
});

export function listHoldings(userId: string = DEFAULT_USER): Holding[] {
    const rows = getDb()
        .prepare('SELECT * FROM holdings WHERE user_id = ? ORDER BY symbol ASC')
        .all(userId) as Row[];
    return rows.map(rowToHolding);
}

// Upsert: if (user, symbol) exists, average-up the cost basis and add quantity.
// This matches how brokers report consolidated positions across multiple buys.
export function upsertHolding(input: HoldingInput, userId: string = DEFAULT_USER): Holding {
    const symbol = input.symbol.trim().toUpperCase();
    if (!symbol) throw new Error('symbol required');
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('quantity must be > 0');
    if (!Number.isFinite(input.avgCost) || input.avgCost <= 0) throw new Error('avgCost must be > 0');

    const db = getDb();
    const now = Date.now();
    const existing = db
        .prepare('SELECT * FROM holdings WHERE user_id = ? AND symbol = ?')
        .get(userId, symbol) as Row | undefined;

    if (existing) {
        const newQty = existing.quantity + input.quantity;
        // Weighted-average cost across all lots
        const newAvg = ((existing.quantity * existing.avg_cost) + (input.quantity * input.avgCost)) / newQty;
        db.prepare(`
            UPDATE holdings
            SET quantity = ?, avg_cost = ?, currency = ?, broker = ?, notes = COALESCE(?, notes), updated_at = ?
            WHERE id = ?
        `).run(newQty, newAvg, input.currency ?? existing.currency, input.broker ?? existing.broker, input.notes ?? null, now, existing.id);
        return rowToHolding(db.prepare('SELECT * FROM holdings WHERE id = ?').get(existing.id) as Row);
    }

    const info = db.prepare(`
        INSERT INTO holdings (user_id, symbol, quantity, avg_cost, currency, broker, notes, added_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, symbol, input.quantity, input.avgCost, input.currency ?? 'USD', input.broker ?? 'manual', input.notes ?? null, now, now);

    return rowToHolding(db.prepare('SELECT * FROM holdings WHERE id = ?').get(info.lastInsertRowid) as Row);
}

// Overwrite (vs upsert which averages). Used by the "edit holding" UI.
export function replaceHolding(id: number, input: HoldingInput, userId: string = DEFAULT_USER): Holding | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM holdings WHERE id = ? AND user_id = ?').get(id, userId) as Row | undefined;
    if (!row) return null;
    const now = Date.now();
    db.prepare(`
        UPDATE holdings
        SET symbol = ?, quantity = ?, avg_cost = ?, currency = ?, broker = ?, notes = ?, updated_at = ?
        WHERE id = ?
    `).run(input.symbol.trim().toUpperCase(), input.quantity, input.avgCost, input.currency ?? row.currency, input.broker ?? row.broker, input.notes ?? row.notes, now, id);
    return rowToHolding(db.prepare('SELECT * FROM holdings WHERE id = ?').get(id) as Row);
}

export function deleteHolding(id: number, userId: string = DEFAULT_USER): boolean {
    const info = getDb().prepare('DELETE FROM holdings WHERE id = ? AND user_id = ?').run(id, userId);
    return info.changes > 0;
}

export function clearAllHoldings(userId: string = DEFAULT_USER): number {
    return getDb().prepare('DELETE FROM holdings WHERE user_id = ?').run(userId).changes;
}

// Parse a permissive CSV: header row required, columns: symbol, quantity, avg_cost
// Optional columns: currency, broker, notes. Returns parsed rows + any errors so the
// UI can show them inline instead of failing the whole import.
export interface CsvParseResult {
    rows: HoldingInput[];
    errors: { line: number; message: string }[];
}

export function parseHoldingsCsv(csv: string): CsvParseResult {
    const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { rows: [], errors: [{ line: 0, message: 'Empty file' }] };

    const splitLine = (line: string): string[] => {
        // Naive CSV split — handles quoted strings with commas inside.
        const out: string[] = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') { inQuote = !inQuote; continue; }
            if (c === ',' && !inQuote) { out.push(cur); cur = ''; continue; }
            cur += c;
        }
        out.push(cur);
        return out.map(s => s.trim());
    };

    const header = splitLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    const idx = {
        symbol:   header.findIndex(h => h === 'symbol' || h === 'ticker' || h === 'isin'),
        quantity: header.findIndex(h => h === 'quantity' || h === 'qty' || h === 'shares' || h === 'stueck' || h === 'stück'),
        avgCost:  header.findIndex(h => h === 'avg_cost' || h === 'avgcost' || h === 'avg_price' || h === 'avgprice' || h === 'price' || h === 'einstand'),
        currency: header.findIndex(h => h === 'currency' || h === 'waehrung' || h === 'währung'),
        broker:   header.findIndex(h => h === 'broker'),
        notes:    header.findIndex(h => h === 'notes' || h === 'notiz'),
    };

    const errors: { line: number; message: string }[] = [];
    if (idx.symbol < 0)   errors.push({ line: 1, message: 'Missing required column: symbol' });
    if (idx.quantity < 0) errors.push({ line: 1, message: 'Missing required column: quantity' });
    if (idx.avgCost < 0)  errors.push({ line: 1, message: 'Missing required column: avg_cost / price' });
    if (errors.length > 0) return { rows: [], errors };

    const rows: HoldingInput[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = splitLine(lines[i]);
        const symbol   = cells[idx.symbol];
        // Allow "1.234,56" (German) or "1234.56" (English)
        const numparse = (s: string) => parseFloat((s ?? '').replace(/\./g, '').replace(',', '.'));
        const qty = numparse(cells[idx.quantity]);
        const cost = numparse(cells[idx.avgCost]);

        if (!symbol) { errors.push({ line: i + 1, message: 'missing symbol' }); continue; }
        if (!Number.isFinite(qty) || qty <= 0) { errors.push({ line: i + 1, message: `invalid quantity "${cells[idx.quantity]}"` }); continue; }
        if (!Number.isFinite(cost) || cost <= 0) { errors.push({ line: i + 1, message: `invalid avg_cost "${cells[idx.avgCost]}"` }); continue; }

        rows.push({
            symbol,
            quantity: qty,
            avgCost: cost,
            currency: idx.currency >= 0 ? (cells[idx.currency] || undefined) : undefined,
            broker:   idx.broker   >= 0 ? (cells[idx.broker]   || undefined) : undefined,
            notes:    idx.notes    >= 0 ? (cells[idx.notes]    || null)      : null,
        });
    }

    return { rows, errors };
}
