import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { calculateIndicators } from '@/lib/technical-analysis';
import { getTradeSignal, analyzeSentiment } from '@/lib/analysis';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ symbol: string }> } // params is a Promise in Next.js 15
) {
    const { symbol } = await params;

    // Get query params for mode (scalp/swing)
    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get('mode') as 'swing' | 'scalp') || 'swing';

    try {
        const queryOptions = { period1: '2023-01-01', interval: '1d' as const }; // Fetch enough data for SMA200

        // Fetch Chart Data (Critical)
        const chartResult = await yahooFinance.chart(symbol, queryOptions);

        // Fetch News (for Sentiment Gate)
        let sentimentLabel: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
        try {
            const news = await yahooFinance.search(symbol, { newsCount: 5 });
            // Simple local sentiment analysis 
            // We need to import analyzeSentiment. 
            // NOTE: To avoid circular deps or code duplication, strictly we should use the lib function.
            // But we need to make sure we have the headlines.
            if (news.news && news.news.length > 0) {
                // @ts-ignore
                const headlines = news.news.map((n: any) => n.title);
                // Used imported function
                const sentimentResult = analyzeSentiment(headlines);
                sentimentLabel = sentimentResult.label;
            }
        } catch (e) {
            console.warn('Sentiment fetch failed inside stock route', e);
        }

        // Fetch Profile Data (Optional) - indices often fail here
        let quoteSummary: any = {};
        try {
            quoteSummary = await yahooFinance.quoteSummary(symbol, { modules: ['summaryProfile', 'assetProfile'] });
        } catch (e) {
            console.warn(`Profile data not found for ${symbol}:`, e);
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

        return NextResponse.json({
            symbol,
            data: enrichedData, // Return full history for charts
            latest: latest,
            recommendation, // { action, reason, confidence }
            profile
        });

    } catch (error: any) {
        console.error('Error fetching stock data:', error);
        console.error('Stack:', error.stack);
        const errorMessage = error.message || 'Unknown error';
        return NextResponse.json({ error: `Failed to fetch data: ${errorMessage}` }, { status: 500 });
    }
}
