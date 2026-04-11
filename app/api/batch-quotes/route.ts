import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache } from 'lru-cache';
const yahooFinance = new YahooFinance();

// Global cache for batch route
const batchCache = new LRUCache<string, any>({
    max: 50,
    ttl: 3000, // 3 seconds TTL
});

export async function POST(request: Request) {
    try {
        const { symbols } = await request.json();

        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return NextResponse.json({ error: 'Invalid symbols array' }, { status: 400 });
        }

        const cacheKey = symbols.sort().join(',');
        const cachedResponse = batchCache.get(cacheKey);

        if (cachedResponse) {
            return NextResponse.json({ data: cachedResponse });
        }

        // Fetch quotes in batch
        const results = await yahooFinance.quote(symbols);

        // Map to a lightweight format for the frontend
        const formattedQuotes = results.map((q: any) => {
            return {
                symbol: q.symbol,
                price: q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice,
                change: q.regularMarketChange,
                changePercent: q.regularMarketChangePercent,
                fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
                fiftyTwoWeekLow: q.fiftyTwoWeekLow,
                marketCap: q.marketCap,
            };
        });

        // Save to cache
        batchCache.set(cacheKey, formattedQuotes);

        return NextResponse.json({ data: formattedQuotes });
    } catch (error: any) {
        console.error('Batch fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch batch data' }, { status: 500 });
    }
}
