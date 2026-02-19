import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

import { analyzeSentiment } from '@/lib/analysis';

import { ASSETS } from '@/config/assets';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params;

    try {
        // 1. Get Company Name for better search
        const asset = ASSETS.find(a => a.symbol === symbol);
        const query = asset ? `${symbol} ${asset.name}` : symbol;

        // 2. Fetch News (more items to allow for filtering)
        const searchResult = await yahooFinance.search(query, { newsCount: 15 }) as any;
        let newsItems = searchResult.news || [];

        // 3. Strict Filtering: Must contain Symbol OR Name in Title to be relevant
        // This removes "Recommended for you" generic spam.
        if (asset) {
            const terms = [symbol, asset.name.split(' ')[0]]; // "AAPL", "Apple"
            newsItems = newsItems.filter((item: any) => {
                const text = (item.title + ' ' + (item.publisher || '')).toLowerCase();
                return terms.some(term => text.includes(term.toLowerCase()));
            });
        }

        // Limit back to 5-8 relevant items
        newsItems = newsItems.slice(0, 8);

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
