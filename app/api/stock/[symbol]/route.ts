import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { calculateIndicators } from '@/lib/technical-analysis';
import { getTradeSignal } from '@/lib/analysis';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ symbol: string }> } // params is a Promise in Next.js 15
) {
    const { symbol } = await params;

    try {
        const queryOptions = { period1: '2023-01-01', interval: '1d' as const }; // Fetch enough data for SMA200

        // Parallel fetch for chart and quote summary (profile)
        const [chartResult, quoteSummary] = await Promise.all([
            yahooFinance.chart(symbol, queryOptions),
            yahooFinance.quoteSummary(symbol, { modules: ['summaryProfile', 'assetProfile'] })
        ]);

        const quotes = chartResult?.quotes?.filter((q: any) => q.close !== null && q.date !== null);

        if (!quotes || quotes.length === 0) {
            return NextResponse.json({ error: 'No data found' }, { status: 404 });
        }

        const enrichedData = calculateIndicators(quotes);

        // Get the latest values for a quick summary
        const latest = enrichedData[enrichedData.length - 1];

        // Get Trade Recommendation
        const recommendation = getTradeSignal(enrichedData);

        // Prepare Profile Data
        let profile = {
            description: 'No description available.',
            sector: undefined as string | undefined,
            industry: undefined as string | undefined,
            website: undefined as string | undefined
        };

        if (quoteSummary.summaryProfile) {
            // Stock
            profile.description = quoteSummary.summaryProfile.longBusinessSummary || profile.description;
            profile.sector = quoteSummary.summaryProfile.sector;
            profile.industry = quoteSummary.summaryProfile.industry;
            profile.website = quoteSummary.summaryProfile.website;
        } else if (quoteSummary.assetProfile) {
            // Crypto / ETF
            profile.description = quoteSummary.assetProfile.description || profile.description;
            profile.sector = quoteSummary.assetProfile.sector; // Sometimes available for ETFs
            profile.industry = quoteSummary.assetProfile.industry;
            // Crypto typically doesn't have website in assetProfile, might need summaryProfile?
            // Often crypto description is in assetProfile.
        }

        return NextResponse.json({
            symbol,
            data: enrichedData, // Return full history for charts
            latest: latest,
            recommendation, // { action, reason, confidence }
            profile
        });

    } catch (error) {
        console.error('Error fetching stock data:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
