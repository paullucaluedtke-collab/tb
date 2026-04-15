import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache } from 'lru-cache';
const yahooFinance = new YahooFinance();
import { calculateIndicators } from '@/lib/technical-analysis';
import { getTradeSignal, analyzeSentiment } from '@/lib/analysis';

// Global cache for API route (persists across hot reloads in dev, lives in memory in prod)
// Larger TTL drastically reduces Yahoo Finance calls and serverless cold-start pressure.
const globalCache = new LRUCache<string, any>({
    max: 200, // Max 200 symbol+mode combos
    ttl: 30_000, // 30 seconds TTL for enriched chart data (frontend polls at 5s now)
});

// Separate cache for quoteSummary (profile) data - changes very rarely
const profileCache = new LRUCache<string, any>({
    max: 200,
    ttl: 6 * 60 * 60 * 1000, // 6 hours (profile rarely changes)
});

// Cache for headlines-based sentiment (changes slowly)
const sentimentCache = new LRUCache<string, 'Bullish' | 'Bearish' | 'Neutral'>({
    max: 200,
    ttl: 5 * 60 * 1000, // 5 minutes
});

export async function GET(
    request: Request,
    { params }: { params: Promise<{ symbol: string }> } // params is a Promise in Next.js 15
) {
    const { symbol } = await params;

    // Get query params for mode (scalp/swing)
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get('mode') as 'swing' | 'scalp' | 'long_term') || 'swing';

    const cacheKey = `${symbol}-${mode}`;
    const cachedData = globalCache.get(cacheKey);

    if (cachedData) {
        return NextResponse.json(cachedData);
    }

    try {
        const queryOptions = { period1: '2023-01-01', interval: '1d' as const }; // Fetch enough data for SMA200

        // Fetch Chart Data (Critical)
        const chartResult = await yahooFinance.chart(symbol, queryOptions);

        // Sentiment (cached 5min) - avoid hitting Yahoo search every call
        let sentimentLabel: 'Bullish' | 'Bearish' | 'Neutral' = sentimentCache.get(symbol) || 'Neutral';
        if (!sentimentCache.has(symbol)) {
            try {
                const news = await yahooFinance.search(symbol, { newsCount: 5 });
                if (news.news && news.news.length > 0) {
                    // @ts-ignore
                    const headlines = news.news.map((n: any) => n.title);
                    sentimentLabel = analyzeSentiment(headlines).label;
                }
                sentimentCache.set(symbol, sentimentLabel);
            } catch (e) {
                sentimentCache.set(symbol, 'Neutral');
            }
        }

        // Profile Data (cached 6h) - changes very rarely
        let quoteSummary: any = profileCache.get(symbol);
        if (!quoteSummary) {
            try {
                quoteSummary = await yahooFinance.quoteSummary(symbol, { modules: ['summaryProfile', 'assetProfile'] });
                profileCache.set(symbol, quoteSummary);
            } catch (e) {
                profileCache.set(symbol, {}); // cache miss too, to avoid retrying indices every time
                quoteSummary = {};
            }
        }

        const quotes = chartResult?.quotes?.filter((q: any) => q.close !== null && q.date !== null);

        if (!quotes || quotes.length === 0) {
            return NextResponse.json({ error: 'No data found' }, { status: 404 });
        }

        const enrichedData = calculateIndicators(quotes);

        // Get the latest values for a quick summary
        const latest = enrichedData[enrichedData.length - 1];

        // Get Trade Recommendation with Mode & Sentiment
        const recommendation = getTradeSignal(enrichedData, mode, sentimentLabel);

        // Prepare Profile Data
        let profile = {
            description: 'No description available.',
            sector: undefined as string | undefined,
            industry: undefined as string | undefined,
            website: undefined as string | undefined
        };

        if (quoteSummary?.summaryProfile) {
            // Stock
            profile.description = quoteSummary.summaryProfile.longBusinessSummary || profile.description;
            profile.sector = quoteSummary.summaryProfile.sector;
            profile.industry = quoteSummary.summaryProfile.industry;
            profile.website = quoteSummary.summaryProfile.website;
        } else if (quoteSummary?.assetProfile) {
            // Crypto / ETF
            profile.description = quoteSummary.assetProfile.description || profile.description;
            profile.sector = quoteSummary.assetProfile.sector;
            profile.industry = quoteSummary.assetProfile.industry;
        }

        const responseData = {
            symbol,
            data: enrichedData, // Return full history for charts
            latest: latest,
            recommendation, // { action, reason, confidence }
            profile
        };

        // Save to cache
        globalCache.set(cacheKey, responseData);

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('Error fetching stock data:', error);
        console.error('Stack:', error.stack);
        const errorMessage = error.message || 'Unknown error';
        return NextResponse.json({ error: `Failed to fetch data: ${errorMessage}` }, { status: 500 });
    }
}
