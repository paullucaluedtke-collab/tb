import { useState, useEffect, useRef } from 'react';
import { Asset } from '@/config/assets';
import { TradeRecommendation, SentimentResult } from '@/lib/analysis';
import { StockDataPoint } from '@/lib/technical-analysis';

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
    const [summaries, setSummaries] = useState<Record<string, { price: number, change?: number, changePercent?: number, recommendation: TradeRecommendation, sentiment: SentimentResult }>>({});
    const [aiInsights, setAiInsights] = useState<Record<string, AIResult>>({});
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Refs for caching and preventing unnecessary effect triggers
    const cacheRef = useRef<Record<string, { stock?: StockData, news?: NewsResponse }>>({});
    const selectedSymbolRef = useRef(selectedSymbol);

    // Update ref when symbol changes
    useEffect(() => {
        selectedSymbolRef.current = selectedSymbol;
    }, [selectedSymbol]);

    // 1. ACTIVE ASSET LOOP: Fast Price (1s), Slow News (30s)
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

                // Cache stock data
                cacheRef.current[selectedSymbol] = { ...cacheRef.current[selectedSymbol], stock: data };

                // Only update if price/data actually changed to prevent jitter
                setStockData(prev => {
                    if (prev && JSON.stringify(prev.data) === JSON.stringify(data.data)) return prev;
                    return data;
                });
            } catch (e) { }
        };

        const fetchNews = async () => {
            try {
                const res = await fetch(`/api/news/${selectedSymbol}`);
                const data = await res.json();
                if (!isMounted) return;

                // Cache news data
                cacheRef.current[selectedSymbol] = { ...cacheRef.current[selectedSymbol], news: data };

                // Only update if news ID/hashes changed to prevent AI reset
                setNewsData(prev => {
                    const prevHash = prev?.news?.map((n: any) => n.uuid).join('|');
                    const newHash = data?.news?.map((n: any) => n.uuid).join('|');
                    // Also check sentiment score to ensure we don't miss updates there
                    if (prevHash === newHash && prev?.sentiment?.score === data?.sentiment?.score) return prev;
                    return data;
                });
            } catch (e) { }
        };

        // Initial Load (Show Loading only on first mount/symbol change)
        const initialLoad = async () => {
            const cached = cacheRef.current[selectedSymbol];
            if (cached?.stock && cached?.news) {
                // Use cache
                setStockData(cached.stock);
                setNewsData(cached.news);
                setLoading(false);
            } else {
                // Clear state to show loading spinner for new asset
                setStockData(null);
                setNewsData(null);
                setLoading(true);
            }

            // Always fetch fresh data anyway
            await Promise.all([fetchPrice(), fetchNews()]);
            if (isMounted) setLoading(false);
        };

        initialLoad();

        // Fast Loop: Price (1s)
        priceInterval = setInterval(fetchPrice, 1000);

        // Slow Loop: News (60s) for active symbol
        newsInterval = setInterval(fetchNews, 60000);

        return () => {
            isMounted = false;
            clearInterval(priceInterval);
            clearInterval(newsInterval);
        };
    }, [selectedSymbol, mode]);


    // DEBUG: Track renders
    // console.log("useMarketData Render", selectedSymbol);

    // 2. BACKGROUND LOOP: Batch Watchlist Updates (Global Fast - 2.0s)
    useEffect(() => {
        let isMounted = true;
        const symbolList = watchlist.map(a => a.symbol);

        const fetchBatchPrices = async () => {
            if (symbolList.length === 0) return;
            try {
                const res = await fetch('/api/batch-quotes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: symbolList })
                });
                const json = await res.json();

                if (!isMounted) return;

                if (json.data) {
                    setSummaries(prev => {
                        const next = { ...prev };
                        let hasChanges = false;

                        json.data.forEach((item: any) => {
                            // Only update if price changed
                            if (next[item.symbol]?.price !== item.price) {
                                hasChanges = true;
                                next[item.symbol] = {
                                    ...next[item.symbol],
                                    price: item.price,
                                    change: item.change,
                                    changePercent: item.changePercent,
                                    // Use minimal default if it doesn't exist yet, wait for deep analysis
                                    recommendation: next[item.symbol]?.recommendation || { action: 'WAIT', confidence: 'LOW', reason: 'Loading...' },
                                    sentiment: next[item.symbol]?.sentiment || { score: 0, label: 'Neutral', summary: '' }
                                };
                            }
                        });
                        return hasChanges ? next : prev;
                    });
                }
            } catch (e) {
                // console.warn("Batch fetch fail", e);
            }
        };

        fetchBatchPrices(); // Initial fetch

        // 2s Fast Loop for Watchlist Prices
        const interval = setInterval(() => {
            if (!document.hidden) {
                fetchBatchPrices();
            }
        }, 2000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(watchlist.map(a => a.symbol))]);

    // 2a. MANUAL AI ANALYSIS: Triggered by user clicking the analyze button
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
                            if (data.error) return;
                            next[symbol] = {
                                ...next[symbol],
                                price: data.latestClose || next[symbol]?.price,
                                recommendation: data.recommendation,
                                sentiment: next[symbol]?.sentiment || { score: 0, label: 'Neutral', summary: '' }
                            };
                        });
                        return next;
                    });
                }
            } catch (e) {
                // console.warn("Deep fetch failed", e);
            }

            // News Sentiment Sync - Batch it to avoid hammering
            const targetAssets = activeCategory === 'All' ? watchlist : watchlist.filter(a => a.category === activeCategory);
            // Only sync top 5 visibly to save API calls
            const assetsToFetch = targetAssets.slice(0, 5);

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
        const interval = setInterval(fetchDeepAnalysis, 60000); // 60s background full sync

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [watchlist, mode, activeCategory]);

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
    };
};
