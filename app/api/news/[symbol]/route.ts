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

const TRUSTED_PUBLISHERS = [
    'bloomberg',
    'reuters',
    'the wall street journal',
    'financial times',
    'cnbc',
    'marketwatch',
    'barrons',
    "barron's",
    'forbes',
    'fortune',
    'the new york times',
    'benzinga'
];

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
        // Request 30 items to dig past the generic press releases
        let searchResult: any = {};
        let newsItems: any[] = [];
        
        try {
            searchResult = await yahooFinance.search(query, { newsCount: 30 }) as any;
            newsItems = searchResult.news || [];
        } catch (e: any) {
            // Yahoo's API frequently throws SchemaValidation failures on large queries 
            // even though the data is valid. Safe bypass:
            if (e.name === 'FailedYahooValidationError' && e.result?.news) {
                newsItems = e.result.news;
            } else {
                throw e; // Rethrow if it's a real network error
            }
        }

        // 3. Strict Filtering: Must contain Symbol OR Name in Title to be relevant
        // This removes "Recommended for you" generic spam.
        if (asset) {
            const terms = [symbol, asset.name.split(' ')[0]]; // "AAPL", "Apple"
            newsItems = newsItems.filter((item: any) => {
                const text = (item.title + ' ' + (item.publisher || '')).toLowerCase();
                return terms.some(term => text.includes(term.toLowerCase()));
            });
        }

        // 4. Trusted Publisher Sort
        newsItems.sort((a: any, b: any) => {
            const aPublisher = (a.publisher || '').toLowerCase();
            const bPublisher = (b.publisher || '').toLowerCase();
            
            const aIsTrusted = TRUSTED_PUBLISHERS.some(p => aPublisher.includes(p));
            const bIsTrusted = TRUSTED_PUBLISHERS.some(p => bPublisher.includes(p));

            if (aIsTrusted && !bIsTrusted) return -1;
            if (!aIsTrusted && bIsTrusted) return 1;
            
            // If both are trusted or both are untrusted, sort by publish time (newest first)
            const aDate = a.providerPublishTime ? new Date(a.providerPublishTime).getTime() : 0;
            const bDate = b.providerPublishTime ? new Date(b.providerPublishTime).getTime() : 0;
            return bDate - aDate;
        });

        // 5. Limit back to top 8 highest-quality items
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
