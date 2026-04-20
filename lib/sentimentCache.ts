import { LRUCache } from 'lru-cache';

export type SentimentLabel = 'Bullish' | 'Bearish' | 'Neutral';

// Shared across routes so news fetch (full 8 headlines, best quality) primes
// the cache used by stock route and batch-analysis — avoids each route running
// its own sentiment lookup and the batch route defaulting to 'Neutral'.
export const sharedSentimentCache = new LRUCache<string, SentimentLabel>({
    max: 500,
    ttl: 10 * 60 * 1000, // 10 minutes
});

export const getSharedSentiment = (symbol: string): SentimentLabel =>
    sharedSentimentCache.get(symbol) || 'Neutral';

export const setSharedSentiment = (symbol: string, label: SentimentLabel) => {
    sharedSentimentCache.set(symbol, label);
};
