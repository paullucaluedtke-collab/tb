import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache } from 'lru-cache';
const yahooFinance = new YahooFinance();

import { analyzeSentiment } from '@/lib/analysis';

import { ASSETS } from '@/config/assets';

// Cache news heavily because it doesn't change every second
const newsCache = new LRUCache<string, any>({
    max: 100,
    ttl: 60000, // 60 seconds TTL for news
});

export async function GET(
    request: Request,
    { params }: { params: Promise<{ symbol: string }> }
) {
    const { symbol } = await params;

    const cachedNews = newsCache.get(symbol);
    if (cachedNews) {
        return NextResponse.json(cachedNews);
    }

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

        const responseData = {
            symbol,
            news: newsItems,
            sentiment // { score, label, summary }
        };

        newsCache.set(symbol, responseData);

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Error fetching news:', error);
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
