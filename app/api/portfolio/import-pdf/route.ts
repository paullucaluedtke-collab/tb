// POST /api/portfolio/import-pdf  (multipart/form-data, field "file")
//   → { csv, candidates, warnings }
//
// Extracts text from a Trade Republic PDF, parses ISIN + quantity + price
// candidates, resolves each ISIN to a Yahoo symbol via search, and returns an
// editable CSV. We DO NOT auto-import — the client pre-fills the CSV textarea
// so the user can review/correct before committing (PDF layouts are fragile).

import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache } from 'lru-cache';
import { parseTradeRepublicText, candidatesToCsv } from '@/lib/trPdf';

export const maxDuration = 30;

const yahooFinance = new YahooFinance();
const isinCache = new LRUCache<string, string>({ max: 2000, ttl: 7 * 24 * 60 * 60 * 1000 });

async function resolveIsin(isin: string): Promise<string | undefined> {
    const cached = isinCache.get(isin);
    if (cached) return cached;
    try {
        const res: any = await yahooFinance.search(isin, { quotesCount: 3, newsCount: 0 });
        const quote = (res?.quotes || []).find((q: any) => q.symbol);
        if (quote?.symbol) {
            isinCache.set(isin, quote.symbol);
            return quote.symbol;
        }
    } catch { /* fall through */ }
    return undefined;
}

export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const file = form.get('file');
        if (!file || typeof file === 'string') {
            return NextResponse.json({ error: 'No PDF file uploaded (field "file")' }, { status: 400 });
        }

        const arrayBuf = await (file as File).arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        // Import the inner module directly — pdf-parse's index.js runs debug code
        // against a sample file on import, which throws in a bundled environment.
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as any;
        const parsed = await pdfParse(buffer);
        const text: string = parsed?.text || '';

        const { candidates, warnings } = parseTradeRepublicText(text);

        // Resolve ISINs → Yahoo symbols (parallel, cached).
        await Promise.all(candidates.map(async (c) => {
            const sym = await resolveIsin(c.isin);
            if (sym) c.symbol = sym;
            else warnings.push(`${c.isin}: could not resolve to a ticker — edit the symbol manually.`);
        }));

        const csv = candidatesToCsv(candidates);
        return NextResponse.json({ csv, candidates, warnings });
    } catch (e: any) {
        console.error('PDF import error:', e);
        return NextResponse.json({ error: e.message || 'Failed to parse PDF' }, { status: 500 });
    }
}
