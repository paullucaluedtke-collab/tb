// POST /api/portfolio/benchmark  { benchmark?: 'SPY' | 'BTC-USD' }
//   → { benchmarkReturnPct, benchmarkSymbol, perHolding: [...] }
//
// "Opportunity cost" benchmark: for each holding we look up the benchmark's
// price on the date the position was added, then compute what the same money
// would have returned if invested in the benchmark instead. Blended by cost
// basis. The client compares this to the portfolio's actual return to show alpha.

import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache } from 'lru-cache';
import { listHoldings } from '@/lib/portfolio';

const yahooFinance = new YahooFinance();

// Cache the benchmark's full price history briefly — many holdings reuse it.
const histCache = new LRUCache<string, { date: number; close: number }[]>({
    max: 10,
    ttl: 30 * 60 * 1000, // 30 min
});

async function getHistory(symbol: string, since: number): Promise<{ date: number; close: number }[]> {
    const cached = histCache.get(symbol);
    if (cached && cached[0]?.date <= since) return cached;
    const start = new Date(Math.min(since, Date.now() - 7 * 86_400_000)).toISOString().split('T')[0];
    const res = await yahooFinance.chart(symbol, { period1: start, interval: '1d' as const });
    const series = (res?.quotes || [])
        .filter((q: any) => q.close != null && q.date != null)
        .map((q: any) => ({ date: new Date(q.date).getTime(), close: q.close as number }));
    histCache.set(symbol, series);
    return series;
}

// Closest close at or before a target timestamp.
function priceAt(series: { date: number; close: number }[], ts: number): number | null {
    let best: number | null = null;
    for (const p of series) {
        if (p.date <= ts) best = p.close;
        else break;
    }
    return best ?? (series[0]?.close ?? null);
}

export async function POST(req: Request) {
    try {
        const { benchmark } = await req.json().catch(() => ({}));
        const benchmarkSymbol = benchmark === 'BTC-USD' ? 'BTC-USD' : 'SPY';

        const holdings = listHoldings();
        if (holdings.length === 0) {
            return NextResponse.json({ error: 'Portfolio is empty' }, { status: 400 });
        }

        const earliest = Math.min(...holdings.map(h => h.addedAt));
        const series = await getHistory(benchmarkSymbol, earliest);
        if (series.length === 0) {
            return NextResponse.json({ error: 'No benchmark data' }, { status: 500 });
        }
        const currentBenchmark = series[series.length - 1].close;

        let weightedReturn = 0;
        let totalWeight = 0;
        const perHolding = holdings.map(h => {
            const costBasis = h.quantity * h.avgCost;
            const benchAtAdd = priceAt(series, h.addedAt);
            const benchReturnPct = benchAtAdd ? ((currentBenchmark - benchAtAdd) / benchAtAdd) * 100 : 0;
            weightedReturn += benchReturnPct * costBasis;
            totalWeight += costBasis;
            return { symbol: h.symbol, benchReturnPct, addedAt: h.addedAt };
        });

        const benchmarkReturnPct = totalWeight > 0 ? weightedReturn / totalWeight : 0;

        return NextResponse.json({ benchmarkSymbol, benchmarkReturnPct, perHolding });
    } catch (e: any) {
        console.error('Benchmark error:', e);
        return NextResponse.json({ error: e.message || 'Benchmark failed' }, { status: 500 });
    }
}
