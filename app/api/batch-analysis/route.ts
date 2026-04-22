import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache } from 'lru-cache';
const yahooFinance = new YahooFinance();
import { calculateIndicators } from '@/lib/technical-analysis';
import { getTradeSignal, analyzeSentiment } from '@/lib/analysis';
import { getSharedSentiment } from '@/lib/sentimentCache';

// Per-symbol analysis cache — reduced to 60s so signals stay fresh intraday
const analysisCache = new LRUCache<string, any>({
    max: 500,
    ttl: 60 * 1000, // 60 seconds
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { symbols, mode } = body;

        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
        }

        const activeMode = mode === 'scalp' ? 'scalp' : (mode === 'long_term' ? 'long_term' : 'swing');

        // Process in chunks to avoid rate limiting
        const chunkSize = 10;
        const results: Record<string, any> = {};

        // Pre-populate from cache; only fetch cache misses
        const missing: string[] = [];
        for (const sym of symbols) {
            const cached = analysisCache.get(`${sym}-${activeMode}`);
            if (cached) {
                results[sym] = cached;
            } else {
                missing.push(sym);
            }
        }

        // Dynamic start date keeps payload small while having enough for SMA200
        const dynamicStart = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];

        for (let i = 0; i < missing.length; i += chunkSize) {
            const chunk = missing.slice(i, i + chunkSize);

            await Promise.all(chunk.map(async (symbol: string) => {
                try {
                    const queryOptions = { period1: dynamicStart, interval: '1d' as const };

                    const chartResult = await yahooFinance.chart(symbol, queryOptions);
                    const quotes = chartResult?.quotes?.filter((q: any) => q.close !== null && q.date !== null);

                    if (!quotes || quotes.length < 50) {
                        results[symbol] = { error: 'Insufficient data' };
                        return;
                    }

                    // Fetch current quote to update the last candle with live price
                    try {
                        const liveQuotes = await yahooFinance.quote(symbol);
                        const livePrice = (liveQuotes as any)?.postMarketPrice
                            || (liveQuotes as any)?.preMarketPrice
                            || (liveQuotes as any)?.regularMarketPrice;
                        if (livePrice && quotes.length > 0) {
                            const last = quotes[quotes.length - 1];
                            last.close = livePrice;
                            last.high = Math.max(last.high ?? livePrice, livePrice);
                            last.low = Math.min(last.low ?? livePrice, livePrice);
                        }
                    } catch { }

                    const enrichedData = calculateIndicators(quotes);
                    // Use shared sentiment cache (primed by /api/news/[symbol]) instead of
                    // always defaulting to Neutral — makes sidebar signals sentiment-aware.
                    const sentimentLabel = getSharedSentiment(symbol);
                    const recommendation = getTradeSignal(enrichedData, activeMode, sentimentLabel);
                    const latest = enrichedData[enrichedData.length - 1];

                    // Unusual volume: today's volume vs 20-day SMA
                    const unusualVolume =
                        latest?.volume && latest?.volumeSma20 && latest.volumeSma20 > 0
                            ? latest.volume / latest.volumeSma20
                            : null;

                    const entry = {
                        recommendation,
                        latestClose: quotes[quotes.length - 1].close,
                        unusualVolume, // ratio
                    };
                    analysisCache.set(`${symbol}-${activeMode}`, entry);
                    results[symbol] = entry;

                } catch (e) {
                    console.error(`Failed to analyze ${symbol}`, e);
                    results[symbol] = { error: 'Analysis failed' };
                }
            }));
        }

        return NextResponse.json({ data: results });

    } catch (error: any) {
        console.error('Batch analysis error:', error);
        return NextResponse.json({ error: 'Failed to run batch analysis' }, { status: 500 });
    }
}
