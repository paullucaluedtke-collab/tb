import { useState, useEffect, useRef, useMemo } from 'react';
import { Asset } from '@/config/assets';
import { TradeRecommendation, SentimentResult } from '@/lib/analysis';
import { StockDataPoint } from '@/lib/technical-analysis';
import { getMarketStatus, getPollInterval } from '@/lib/marketHours';

// Types (Moved from page.tsx or shared)
export interface StockData {
    symbol: string;
    data: StockDataPoint[];
    latest: StockDataPoint;
    recommendation: TradeRecommendation;
    profile?: {
        description: string;
        sector?: string;
        industry?: string;
        website?: string;
    };
    nextEarnings?: string | null;
    unusualVolume?: { ratio: number; isUnusual: boolean } | null;
}

export interface NewsItem {
    uuid: string;
    title: string;
    publisher: string;
    link: string;
    providerPublishTime: any;
}

export interface NewsResponse {
    symbol: string;
    news: NewsItem[];
    sentiment: SentimentResult;
}

export interface AIResult {
    score: number;
    summary: string;
    reasoning: string;
    newsHash?: string; // To track if news changed
}

export const useMarketData = (
    selectedSymbol: string,
    watchlist: Asset[],
    activeCategory: string,
    mode: 'swing' | 'scalp' | 'long_term' = 'swing'
) => {
    // State
    const [stockData, setStockData] = useState<StockData | null>(null);
    const [newsData, setNewsData] = useState<NewsResponse | null>(null);
    const [summaries, setSummaries] = useState<Record<string, { price: number, change?: number, changePercent?: number, fiftyTwoWeekHigh?: number, fiftyTwoWeekLow?: number, recommendation: TradeRecommendation, sentiment: SentimentResult, unusualVolume?: number | null }>>({});
    // Keyed by symbol so switching assets never shows stale data from a different symbol
    const [multiTimeframeMap, setMultiTimeframeMap] = useState<Record<string, Record<string, TradeRecommendation>>>({});
    const [aiInsights, setAiInsights] = useState<Record<string, AIResult>>({});
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs for caching and preventing unnecessary effect triggers
    const cacheRef = useRef<Record<string, { stock?: StockData, news?: NewsResponse }>>({});
    const selectedSymbolRef = useRef(selectedSymbol);
    const lastPricePollRef = useRef<number>(0);

    // Update ref when symbol changes
    useEffect(() => {
        selectedSymbolRef.current = selectedSymbol;
    }, [selectedSymbol]);

    // 1. ACTIVE ASSET LOOP: Price (5s, visibility-aware), News (60s)
    useEffect(() => {
        if (!selectedSymbol) return;

        let isMounted = true;
        let priceInterval: NodeJS.Timeout;
        let newsInterval: NodeJS.Timeout;

        const fetchPrice = async () => {
            try {
                const res = await fetch(`/api/stock/${selectedSymbol}?mode=${mode}`);
                const data = await res.json();
                if (!isMounted) return;

                // GUARD: ignore error responses & malformed payloads - never replace good data with bad
                if (!res.ok || data?.error || !Array.isArray(data?.data) || data.data.length === 0 || !data?.latest || !data?.recommendation) {
                    return;
                }

                // Cache only valid stock data
                cacheRef.current[selectedSymbol] = { ...cacheRef.current[selectedSymbol], stock: data };

                // Cheap change detection: compare only the latest candle timestamp + close
                setStockData(prev => {
                    if (!prev) return data;
                    const prevLast = prev.data[prev.data.length - 1];
                    const newLast = data.data[data.data.length - 1];
                    if (prevLast?.date === newLast?.date &&
                        prevLast?.close === newLast?.close &&
                        prev.data.length === data.data.length) {
                        return prev;
                    }
                    return data;
                });
            } catch (e) { }
        };

        const fetchNews = async () => {
            try {
                const res = await fetch(`/api/news/${selectedSymbol}`);
                const data = await res.json();
                if (!isMounted) return;

                // GUARD: ignore error responses / malformed payloads
                if (!res.ok || data?.error || !Array.isArray(data?.news) || !data?.sentiment) {
                    return;
                }

                cacheRef.current[selectedSymbol] = { ...cacheRef.current[selectedSymbol], news: data };

                setNewsData(prev => {
                    const prevHash = prev?.news?.map((n: any) => n.uuid).join('|');
                    const newHash = data?.news?.map((n: any) => n.uuid).join('|');
                    if (prevHash === newHash && prev?.sentiment?.score === data?.sentiment?.score) return prev;
                    return data;
                });
            } catch (e) { }
        };

        // Initial Load (Show Loading only on first mount/symbol change)
        const initialLoad = async () => {
            const cached = cacheRef.current[selectedSymbol];
            if (cached?.stock && cached?.news) {
                setStockData(cached.stock);
                setNewsData(cached.news);
                setLoading(false);
            } else {
                setStockData(null);
                setNewsData(null);
                setLoading(true);
            }

            await Promise.all([fetchPrice(), fetchNews()]);
            if (isMounted) setLoading(false);
        };

        initialLoad();

        // Smart polling: interval adapts to market session
        // Crypto → always 2s | Regular → 2s | Pre/After → 10s | Closed → 45s
        priceInterval = setInterval(() => {
            if (document.hidden) return;
            const asset = watchlist.find(a => a.symbol === selectedSymbol);
            const session = getMarketStatus(selectedSymbol, asset?.category).session;
            const gap = getPollInterval(session);
            const now = Date.now();
            if (now - lastPricePollRef.current < gap) return;
            lastPricePollRef.current = now;
            fetchPrice();
        }, 2000); // Tick every 2s; gate internally by market session

        newsInterval = setInterval(() => {
            if (!document.hidden) fetchNews();
        }, 60000); // 1 min news refresh

        return () => {
            isMounted = false;
            clearInterval(priceInterval);
            clearInterval(newsInterval);
        };
    }, [selectedSymbol, mode]);


    // DEBUG: Track renders
    // console.log("useMarketData Render", selectedSymbol);

    // Stable key for watchlist - avoid JSON.stringify on every render
    const watchlistKey = useMemo(
        () => watchlist.map(a => a.symbol).join(','),
        [watchlist]
    );

    // 2. BACKGROUND LOOP: Batch Watchlist Updates (every 10s, visibility-aware)
    useEffect(() => {
        let isMounted = true;
        const symbolList = watchlistKey ? watchlistKey.split(',') : [];

        const fetchBatchPrices = async () => {
            if (symbolList.length === 0) return;
            try {
                // Always include benchmarks for relative strength calculations
                const benchmarks = ['SPY', 'BTC-USD'];
                const withBenchmarks = Array.from(new Set([...symbolList, ...benchmarks]));
                const res = await fetch('/api/batch-quotes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: withBenchmarks })
                });
                const json = await res.json();

                if (!isMounted) return;

                if (json.data) {
                    setSummaries(prev => {
                        const next = { ...prev };
                        let hasChanges = false;

                        json.data.forEach((item: any) => {
                            if (next[item.symbol]?.price !== item.price) {
                                hasChanges = true;
                                next[item.symbol] = {
                                    ...next[item.symbol],
                                    price: item.price,
                                    change: item.change,
                                    changePercent: item.changePercent,
                                    fiftyTwoWeekHigh: item.fiftyTwoWeekHigh,
                                    fiftyTwoWeekLow: item.fiftyTwoWeekLow,
                                    recommendation: next[item.symbol]?.recommendation || { action: 'WAIT', confidence: 'LOW', reason: 'Loading...' },
                                    sentiment: next[item.symbol]?.sentiment || { score: 0, label: 'Neutral', summary: '' }
                                };
                            }
                        });
                        return hasChanges ? next : prev;
                    });
                }
            } catch (e) { }
        };

        fetchBatchPrices(); // Initial fetch

        // Fast watchlist refresh (5s) - visibility-gated + server-cached (15s TTL)
        const interval = setInterval(() => {
            if (!document.hidden) {
                fetchBatchPrices();
            }
        }, 5000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [watchlistKey]);

    // 2a. MULTI-TIMEFRAME: per-symbol cache — switching stocks never shows wrong data
    const fetchMultiTimeframe = async (symbol?: string) => {
        const targetSymbol = symbol || selectedSymbol;
        if (!targetSymbol) return;
        try {
            const modes = ['swing', 'scalp', 'long_term'] as const;
            const results = await Promise.all(
                modes.map(async (m) => {
                    const res = await fetch(`/api/stock/${targetSymbol}?mode=${m}`);
                    const data = await res.json();
                    return { mode: m, recommendation: data.recommendation };
                })
            );
            const tfMap: Record<string, TradeRecommendation> = {};
            results.forEach(r => { if (r.recommendation) tfMap[r.mode] = r.recommendation; });
            setMultiTimeframeMap(prev => ({ ...prev, [targetSymbol]: tfMap }));
        } catch (e) { }
    };

    // Expose per-symbol multi-timeframe for current selected symbol
    const multiTimeframe = multiTimeframeMap[selectedSymbol] ?? null;

    // 2b. MANUAL AI ANALYSIS: Triggered by user clicking the analyze button
    const triggerAiAnalysis = async (symbol?: string) => {
        const targetSymbol = symbol || selectedSymbol;
        if (!targetSymbol || !newsData?.news || newsData.news.length === 0) return;

        const currentNews = newsData.news.slice(0, 3);
        const newsHash = currentNews.map(n => n.uuid).join('|');

        setAiLoading(true);
        try {
            const res = await fetch('/api/ai-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: targetSymbol,
                    newsItems: currentNews.map(n => ({ title: n.title, link: n.link, description: n.publisher }))
                })
            });

            if (res.ok) {
                const data = await res.json();
                setAiInsights(prev => ({
                    ...prev,
                    [targetSymbol]: { ...data, newsHash }
                }));
            }
        } catch (e) {
            // Analysis failed silently
        } finally {
            setAiLoading(false);
        }
    };

    // 3. BACKGROUND SYNC: Deep Analysis & News for Watchlist (60s loop)
    useEffect(() => {
        let isMounted = true;

        const fetchDeepAnalysis = async () => {
            const symbols = watchlist.map(a => a.symbol);
            if (symbols.length === 0) return;

            // Deep Technical Analysis
            try {
                const res = await fetch('/api/batch-analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols, mode })
                });
                const json = await res.json();

                if (!isMounted) return;

                if (json.data) {
                    setSummaries(prev => {
                        const next = { ...prev };
                        Object.entries(json.data).forEach(([symbol, data]: [string, any]) => {
                            if (data.error) {
                                // Don't leave symbols stuck on "Loading..." — give them a WAIT
                                if (!next[symbol]?.recommendation || next[symbol]?.recommendation?.reason === 'Loading...') {
                                    next[symbol] = {
                                        ...next[symbol],
                                        recommendation: { action: 'WAIT', confidence: 'LOW', reason: data.error === 'Insufficient data' ? 'Not enough data' : 'Analysis unavailable' },
                                        sentiment: next[symbol]?.sentiment || { score: 0, label: 'Neutral', summary: '' }
                                    };
                                }
                                return;
                            }
                            next[symbol] = {
                                ...next[symbol],
                                price: data.latestClose || next[symbol]?.price,
                                recommendation: data.recommendation,
                                unusualVolume: data.unusualVolume,
                                sentiment: next[symbol]?.sentiment || { score: 0, label: 'Neutral', summary: '' }
                            };
                        });
                        return next;
                    });
                }
            } catch (e) {
                // console.warn("Deep fetch failed", e);
            }

            // News Sentiment Sync — fetch 15 at a time, rotating through the watchlist
            const targetAssets = activeCategory === 'All' ? watchlist : watchlist.filter(a => a.category === activeCategory);
            const assetsToFetch = targetAssets.slice(0, 15);

            for (const asset of assetsToFetch) {
                if (!isMounted) break;
                if (asset.symbol === selectedSymbolRef.current) continue;

                try {
                    const newsRes = await fetch(`/api/news/${asset.symbol}`);
                    const newsJson = await newsRes.json();

                    if (newsJson && !newsJson.error && newsJson.sentiment) {
                        setSummaries(prev => ({
                            ...prev,
                            [asset.symbol]: {
                                ...prev[asset.symbol],
                                sentiment: newsJson.sentiment
                            }
                        }));
                    }
                } catch (e) { }
            }
        };

        fetchDeepAnalysis();
        // Deep analysis is heavy but cached server-side (5min LRU) - keep 90s refresh for fresh signals
        const interval = setInterval(() => {
            if (!document.hidden) fetchDeepAnalysis();
        }, 90_000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [watchlistKey, mode, activeCategory]);

    return {
        stockData,
        newsData,
        summaries,
        aiInsights,
        loading,
        aiLoading,
        error,
        lastUpdated: stockData ? new Date() : null,
        triggerAiAnalysis,
        multiTimeframe,
        fetchMultiTimeframe,
    };
};
