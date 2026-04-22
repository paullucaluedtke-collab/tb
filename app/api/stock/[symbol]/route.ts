import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache } from 'lru-cache';
const yahooFinance = new YahooFinance();
import { calculateIndicators } from '@/lib/technical-analysis';
import { getTradeSignal, analyzeSentiment } from '@/lib/analysis';
import { sharedSentimentCache } from '@/lib/sentimentCache';

// Global cache for API route. Frontend polls active asset at 2s — 5s TTL means
// ~60% cache hits while keeping data fresh for real-time feel.
const globalCache = new LRUCache<string, any>({
    max: 200,
    ttl: 5_000,
});

// Separate cache for quoteSummary (profile) data - changes very rarely
const profileCache = new LRUCache<string, any>({
    max: 200,
    ttl: 6 * 60 * 60 * 1000, // 6 hours (profile rarely changes)
});

// Cache for earnings/calendar events — changes ~quarterly
const calendarCache = new LRUCache<string, any>({
    max: 200,
    ttl: 12 * 60 * 60 * 1000, // 12 hours
});

// Sentiment uses shared cache (lib/sentimentCache) so news route can prime it
const sentimentCache = sharedSentimentCache;

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
        // Fetch daily candles for long-term indicators (SMA200 etc.)
        const dailyOptions = { period1: '2023-01-01', interval: '1d' as const };
        const dailyResult = await yahooFinance.chart(symbol, dailyOptions);

        // Also fetch recent 1h candles for intraday signal freshness
        const intradayStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        let intradayQuotes: any[] = [];
        try {
            const intradayResult = await yahooFinance.chart(symbol, { period1: intradayStart, interval: '1h' as const });
            intradayQuotes = intradayResult?.quotes?.filter((q: any) => q.close !== null && q.date !== null) || [];
        } catch { }

        // Merge: use daily candles as base, then replace the last day's candle
        // with the most recent intraday candle so indicators reflect current price
        const chartResult = dailyResult;

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

        // If we have intraday data, update the last daily candle with the latest
        // intraday close so signals reflect the current price, not yesterday's close
        if (intradayQuotes.length > 0) {
            const latestIntraday = intradayQuotes[intradayQuotes.length - 1];
            const lastDaily = quotes[quotes.length - 1];
            if (latestIntraday && lastDaily) {
                lastDaily.close = latestIntraday.close;
                lastDaily.high = Math.max(lastDaily.high ?? 0, latestIntraday.high ?? 0);
                lastDaily.low = Math.min(lastDaily.low ?? Infinity, latestIntraday.low ?? Infinity);
                lastDaily.volume = latestIntraday.volume || lastDaily.volume;
            }
        }

        const enrichedData = calculateIndicators(quotes);

        // Get the latest values for a quick summary
        const latest = enrichedData[enrichedData.length - 1];

        // Earnings date (cached 12h) — must be fetched BEFORE signal generation for earnings gate
        let nextEarnings: string | null = calendarCache.get(symbol);
        if (!calendarCache.has(symbol)) {
            try {
                const calSummary: any = await yahooFinance.quoteSummary(symbol, { modules: ['calendarEvents'] });
                const earningsDates: any[] = calSummary?.calendarEvents?.earnings?.earningsDate || [];
                const future = earningsDates
                    .map((d: any) => (d instanceof Date ? d : new Date(d)))
                    .filter((d: Date) => !isNaN(d.getTime()) && d.getTime() > Date.now())
                    .sort((a: Date, b: Date) => a.getTime() - b.getTime());
                nextEarnings = future[0] ? future[0].toISOString() : null;
                calendarCache.set(symbol, nextEarnings);
            } catch (e) {
                calendarCache.set(symbol, null);
                nextEarnings = null;
            }
        }

        // Get Trade Recommendation with Mode, Sentiment & Earnings context
        const recommendation = getTradeSignal(enrichedData, mode, sentimentLabel, nextEarnings);

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

        // Unusual volume detection: today's volume vs 20-day SMA
        const unusualVolume =
            latest?.volume && latest?.volumeSma20 && latest.volumeSma20 > 0
                ? {
                    ratio: latest.volume / latest.volumeSma20,
                    isUnusual: latest.volume / latest.volumeSma20 >= 2,
                }
                : null;

        const responseData = {
            symbol,
            data: enrichedData, // Return full history for charts
            latest: latest,
            recommendation, // { action, reason, confidence }
            profile,
            nextEarnings, // ISO string or null
            unusualVolume, // { ratio, isUnusual } or null
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
