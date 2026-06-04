// Best-effort parser for Trade Republic PDF documents (Depotauszug /
// Wertpapierabrechnung / Kontoauszug). TR layouts vary and PDFs flatten to
// messy text, so this is deliberately forgiving: it extracts ISINs plus the
// nearest quantity + price, and returns candidates for the user to REVIEW as
// editable CSV before importing — we never import PDF data silently.

export interface TrCandidate {
    isin: string;
    symbol?: string;     // resolved later via Yahoo search
    name?: string;
    quantity?: number;
    price?: number;
}

export interface TrParseResult {
    candidates: TrCandidate[];
    warnings: string[];
}

const ISIN_RE = /\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/g;

// German number: 1.234,56 → 1234.56 ; also plain 1234.56
function parseNum(raw: string): number | null {
    if (!raw) return null;
    let s = raw.trim();
    // If both separators present, the last one is the decimal separator.
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > -1 && lastDot > -1) {
        if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.'); // German
        else s = s.replace(/,/g, '');                                         // English
    } else if (lastComma > -1) {
        // Only comma → decimal comma
        s = s.replace(/\./g, '').replace(',', '.');
    }
    const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
}

export function parseTradeRepublicText(text: string): TrParseResult {
    const warnings: string[] = [];
    const candidates: TrCandidate[] = [];
    if (!text || text.trim().length === 0) {
        return { candidates, warnings: ['Empty PDF text — could not extract anything.'] };
    }

    // Normalize whitespace but keep line structure as hints.
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const joined = text.replace(/\s+/g, ' ');

    // Collect every ISIN occurrence with a context window around it.
    const seen = new Map<string, TrCandidate>();
    let m: RegExpExecArray | null;
    ISIN_RE.lastIndex = 0;
    while ((m = ISIN_RE.exec(joined)) !== null) {
        const isin = m[1];
        if (seen.has(isin)) continue;

        // Context: 120 chars before + 120 after the ISIN.
        const start = Math.max(0, m.index - 120);
        const ctx = joined.slice(start, Math.min(joined.length, m.index + 120));

        // Quantity heuristics: "Stk. 12", "Stück 12", "12 Stk", or "Anzahl 12".
        let quantity: number | undefined;
        const qtyMatch =
            ctx.match(/(?:St(?:ü|u)?ck|Stk\.?|Anzahl|Quantity|Qty|Nominale?)[:\s]*([\d.,]+)/i) ||
            ctx.match(/([\d.,]+)\s*(?:St(?:ü|u)?ck|Stk\.?|Anteile?|Shares?)\b/i);
        if (qtyMatch) {
            const q = parseNum(qtyMatch[1]);
            if (q && q > 0 && q < 1_000_000) quantity = q;
        }

        // Price heuristics: a currency-tagged number near the ISIN.
        let price: number | undefined;
        const priceMatch =
            ctx.match(/(?:Kurs|Preis|Price|Einstand|Ø\s*Kurs|Durchschnitt)[:\s]*([\d.,]+)/i) ||
            ctx.match(/([\d.,]+)\s*(?:EUR|USD|€|\$)/i);
        if (priceMatch) {
            const p = parseNum(priceMatch[1]);
            if (p && p > 0 && p < 1_000_000) price = p;
        }

        // Best-effort name: the line that contains the ISIN, stripped of codes.
        const nameLine = lines.find(l => l.includes(isin));
        const name = nameLine
            ? nameLine.replace(isin, '').replace(/[\d.,]+\s*(EUR|USD|€|\$)?/g, '').replace(/St(ü|u)?ck|Stk\.?/gi, '').trim().slice(0, 40) || undefined
            : undefined;

        const cand: TrCandidate = { isin, name, quantity, price };
        seen.set(isin, cand);
        candidates.push(cand);
    }

    if (candidates.length === 0) {
        warnings.push('No ISINs found. This may be a transaction confirmation rather than a portfolio statement.');
    }
    candidates.forEach(c => {
        if (c.quantity == null) warnings.push(`${c.isin}: quantity not detected — please fill in manually.`);
        if (c.price == null) warnings.push(`${c.isin}: avg price not detected — please fill in manually.`);
    });

    return { candidates, warnings };
}

// Build an editable CSV string from candidates so the user can review/correct
// before importing through the normal CSV path.
export function candidatesToCsv(candidates: TrCandidate[]): string {
    const header = 'symbol,quantity,avg_cost,broker,notes';
    const rows = candidates.map(c => {
        const sym = c.symbol || c.isin; // fall back to ISIN if symbol unresolved
        const qty = c.quantity ?? '';
        const price = c.price ?? '';
        const note = c.name ? c.name.replace(/,/g, ' ') : '';
        return `${sym},${qty},${price},Trade Republic,${note}`;
    });
    return [header, ...rows].join('\n');
}
