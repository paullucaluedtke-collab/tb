// POST /api/portfolio/sectors  { symbols: string[] } → { sectors: Record<symbol, sector> }
// Sector almost never changes, so we cache aggressively (24h). Used by the
// portfolio panel for the allocation donut + AI coach concentration analysis.

import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache } from 'lru-cache';

const yahooFinance = new YahooFinance();

const sectorCache = new LRUCache<string, string>({
    max: 1000,
    ttl: 24 * 60 * 60 * 1000, // 24h
});

// Map a few common ETFs / crypto to pseudo-sectors so the donut isn't all "Unknown".
const STATIC_SECTORS: Record<string, string> = {
    'BTC-USD': 'Crypto', 'ETH-USD': 'Crypto', 'SOL-USD': 'Crypto', 'XRP-USD': 'Crypto',
    'SPY': 'Broad Index', 'VOO': 'Broad Index', 'QQQ': 'Broad Index', 'IWM': 'Broad Index', 'DIA': 'Broad Index',
    'GLD': 'Commodities', 'SLV': 'Commodities', 'TLT': 'Bonds',
    'XLK': 'Technology', 'SMH': 'Technology', 'SOXX': 'Technology',
    'XLE': 'Energy', 'XLF': 'Financials',
};

export async function POST(req: Request) {
    try {
        const { symbols } = await req.json();
        if (!Array.isArray(symbols)) {
            return NextResponse.json({ error: 'symbols must be an array' }, { status: 400 });
        }

        const sectors: Record<string, string> = {};
        const toFetch: string[] = [];

        for (const sym of symbols) {
            if (STATIC_SECTORS[sym]) { sectors[sym] = STATIC_SECTORS[sym]; continue; }
            const cached = sectorCache.get(sym);
            if (cached) { sectors[sym] = cached; continue; }
            toFetch.push(sym);
        }

        await Promise.all(toFetch.map(async (sym) => {
            try {
                const qs: any = await yahooFinance.quoteSummary(sym, { modules: ['assetProfile', 'summaryProfile'] });
                const sector = qs?.assetProfile?.sector || qs?.summaryProfile?.sector
                    || (sym.endsWith('-USD') ? 'Crypto' : 'Unknown');
                sectorCache.set(sym, sector);
                sectors[sym] = sector;
            } catch {
                const fallback = sym.endsWith('-USD') ? 'Crypto' : 'Unknown';
                sectorCache.set(sym, fallback);
                sectors[sym] = fallback;
            }
        }));

        return NextResponse.json({ sectors });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to resolve sectors' }, { status: 500 });
    }
}
