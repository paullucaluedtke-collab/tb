import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

import { analyzeSentiment } from '@/lib/analysis';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params;

    try {
        const searchResult = await yahooFinance.search(symbol, { newsCount: 10 }) as any;

        // Filter to only include actual news items (search can return quotes too)
        const newsItems = searchResult.news || [];

        // Analyze Sentiment
        const headlines = newsItems.map((item: any) => item.title);
        const sentiment = analyzeSentiment(headlines);

        return NextResponse.json({
            symbol,
            news: newsItems,
            sentiment // { score, label, summary }
        });

    } catch (error) {
        console.error('Error fetching news:', error);
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
