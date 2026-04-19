import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { LRUCache } from 'lru-cache';

const yahooFinance = new YahooFinance();

const cache = new LRUCache<string, any>({ max: 5, ttl: 10 * 60 * 1000 });

// Symbols + queries that generate macro/geopolitical news
const MACRO_QUERIES = [
    'CL=F',   // Crude oil
    'GC=F',   // Gold (safe-haven proxy)
    'geopolitical risk trade war 2025',
    'oil supply disruption sanctions',
];

export interface GeoNewsItem {
    uuid: string;
    title: string;
    publisher: string;
    link: string;
    providerPublishTime: any;
    impact: { tags: string[]; color: string } | null;
}

const IMPACT_RULES: { keywords: string[]; tags: string[]; color: string }[] = [
    { keywords: ['oil', 'crude', 'opec', 'hormuz', 'iran', 'pipeline', 'petroleum', 'brent', 'wti', 'energy supply'], tags: ['Oil', 'Energy'], color: 'orange' },
    { keywords: ['defense', 'military', 'nato', 'missile', 'war', 'ukraine', 'taiwan', 'weapon', 'conflict', 'attack', 'troops', 'airstrike'], tags: ['Defense'], color: 'red' },
    { keywords: ['shipping', 'port', 'freight', 'suez', 'container', 'supply chain', 'red sea', 'blockade', 'strait'], tags: ['Shipping'], color: 'sky' },
    { keywords: ['tariff', 'trade war', 'sanction', 'export ban', 'import duty', 'protectionism', 'wto'], tags: ['Trade'], color: 'yellow' },
    { keywords: ['fed ', 'interest rate', 'inflation', 'cpi', 'central bank', 'monetary policy', 'fomc'], tags: ['Rates'], color: 'purple' },
    { keywords: ['gold', 'safe haven', 'dollar index', 'currency crisis', 'commodity'], tags: ['Commodities'], color: 'amber' },
    { keywords: ['semiconductor', 'chip export', 'tech ban', 'ai chip', 'export control'], tags: ['Tech'], color: 'indigo' },
];

function getImpact(title: string): { tags: string[]; color: string } | null {
    const lower = title.toLowerCase();
    for (const rule of IMPACT_RULES) {
        if (rule.keywords.some(k => lower.includes(k))) {
            return { tags: rule.tags, color: rule.color };
        }
    }
    return null;
}

export async function GET() {
    const cached = cache.get('geo');
    if (cached) return NextResponse.json(cached);

    const allNews: GeoNewsItem[] = [];
    const seen = new Set<string>();

    for (const query of MACRO_QUERIES) {
        try {
            let result: any = {};
            try {
                result = await yahooFinance.search(query, { newsCount: 20 }) as any;
            } catch (e: any) {
                if (e.name === 'FailedYahooValidationError' && e.result?.news) {
                    result = e.result;
                } else continue;
            }

            const items: any[] = result.news || [];
            for (const item of items) {
                if (!item.uuid || seen.has(item.uuid)) continue;
                const impact = getImpact(item.title || '');
                // For text queries, only include items with a detected impact tag
                const isSymbolQuery = query.includes('=F') || query.startsWith('^');
                if (!impact && !isSymbolQuery) continue;
                seen.add(item.uuid);
                allNews.push({
                    uuid: item.uuid,
                    title: item.title,
                    publisher: item.publisher || '',
                    link: item.link || '',
                    providerPublishTime: item.providerPublishTime,
                    impact,
                });
            }
        } catch (_) {
            // Skip failed queries silently
        }
    }

    // Newest first
    allNews.sort((a, b) => {
        const at = a.providerPublishTime ? new Date(a.providerPublishTime).getTime() : 0;
        const bt = b.providerPublishTime ? new Date(b.providerPublishTime).getTime() : 0;
        return bt - at;
    });

    const payload = { news: allNews.slice(0, 12), fetchedAt: new Date().toISOString() };
    cache.set('geo', payload);
    return NextResponse.json(payload);
}
