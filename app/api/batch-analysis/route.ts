import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { calculateIndicators } from '@/lib/technical-analysis';
import { getTradeSignal, analyzeSentiment } from '@/lib/analysis';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { symbols, mode } = body;

        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
        }

        const activeMode = mode === 'scalp' ? 'scalp' : 'swing';

        // Process in chunks to avoid rate limiting
        const chunkSize = 10;
        const results: Record<string, any> = {};

        for (let i = 0; i < symbols.length; i += chunkSize) {
            const chunk = symbols.slice(i, i + chunkSize);

            await Promise.all(chunk.map(async (symbol: string) => {
                try {
                    // Fetch enough data for SMA200 (approx 300 days to be safe, but keep payload small)
                    // We need ~200 data points. 1y is safe.
                    const queryOptions = { period1: '2023-01-01', interval: '1d' as const };
                    // Optimization: We could calculate a dynamic start date (Today - 300 days)

                    const chartResult = await yahooFinance.chart(symbol, queryOptions);
                    const quotes = chartResult?.quotes?.filter((q: any) => q.close !== null && q.date !== null);

                    if (!quotes || quotes.length < 50) {
                        results[symbol] = { error: 'Insufficient data' };
                        return;
                    }

                    const enrichedData = calculateIndicators(quotes);

                    // We do NOT fetch news here to keep it fast.
                    // Batch sentiment is too heavy.
                    // We assume Neutral sentiment for batch sorting unless previously fetched.
                    const recommendation = getTradeSignal(enrichedData, activeMode, 'Neutral');

                    results[symbol] = {
                        recommendation,
                        latestClose: quotes[quotes.length - 1].close
                    };

                } catch (e) {
                    console.error(`Failed to analyze ${symbol}`, e);
                    results[symbol] = { error: 'Analysis failed' };
                }
            }));

            // Optional: small delay between chunks if needed (not usually for 50 items)
        }

        return NextResponse.json({ data: results });

    } catch (error: any) {
        console.error('Batch analysis error:', error);
        return NextResponse.json({ error: 'Failed to run batch analysis' }, { status: 500 });
    }
}
