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
    mode: 'swing' | 'scalp' = 'swing'
) => {
    // State
    const [stockData, setStockData] = useState<StockData | null>(null);
    const [newsData, setNewsData] = useState<NewsResponse | null>(null);
    const [summaries, setSummaries] = useState<Record<string, { price: number, recommendation: TradeRecommendation, sentiment: SentimentResult }>>({});
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

        // Slow Loop: News (30s)
        newsInterval = setInterval(fetchNews, 30000);

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
        // console.log("Mounting Batch Effect");
        let isMounted = true;

        // Stabilize symbols to prevent unnecessary effect re-runs if watchlist obj ref changes but content doesn't
        // We use a simple join string as a dependency
        const symbolList = watchlist.map(a => a.symbol);

        const fetchBatchPrices = async () => {
            if (symbolList.length === 0) return;
            // console.log("Fetching Batch...");
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
                        // Check if actually changed to avoid re-renders?
                        // For now, just set it.
                        const next = { ...prev };
                        let hasChanges = false;

                        json.data.forEach((item: any) => {
                            if (next[item.symbol]?.price !== item.price) {
                                hasChanges = true;
                                next[item.symbol] = {
                                    ...next[item.symbol],
                                    price: item.price,
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

        const interval = setInterval(() => {
            if (!document.hidden) {
                fetchBatchPrices();
            }
        }, 2000); // 2.0s Fast Loop (Sidebar)

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
        // We depend on the stringified symbols to avoid "object reference" loops
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(watchlist.map(a => a.symbol))]);

    // 2a. AUTO-ANALYZE: Trigger AI when stock changes (Debounced)
    useEffect(() => {
        if (!selectedSymbol || !newsData?.news || newsData.news.length === 0) return;

        // Generate a simple hash of the top 3 news titles to detect changes
        const currentNews = newsData.news.slice(0, 3);
        const newsHash = currentNews.map(n => n.uuid).join('|');

        // If we already have a result for this exact news set, skip
        if (aiInsights[selectedSymbol] && aiInsights[selectedSymbol].newsHash === newsHash) return;

        const timer = setTimeout(async () => {
            setAiLoading(true);
            try {
                const res = await fetch('/api/ai-analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        symbol: selectedSymbol,
                        newsItems: currentNews.map(n => ({ title: n.title, link: n.link, description: n.publisher }))
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    setAiInsights(prev => ({
                        ...prev,
                        [selectedSymbol]: { ...data, newsHash }
                    }));
                }
            } catch (e) {
                // console.warn("Auto-Analyze failed", e);
            } finally {
                setAiLoading(false);
            }
        }, 1500); // 1.5s delay to allow user to settle

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSymbol, newsData?.sentiment?.score]);

    // 3. DEEP LAYER: Full Analysis on Mode Switch (or Periodic 60s)
    useEffect(() => {
        let isMounted = true;

        const fetchDeepAnalysis = async () => {
            const symbols = watchlist.map(a => a.symbol);
            if (symbols.length === 0) return;

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

                            // Update Recommendation
                            next[symbol] = {
                                ...next[symbol],
                                // Update price if available (backup)
                                price: data.latestClose || next[symbol]?.price,
                                recommendation: data.recommendation,
                                // Keep existing sentiment or default
                                sentiment: next[symbol]?.sentiment || { score: 0, label: 'Neutral', summary: '' }
                            };
                        });
                        return next;
                    });
                }
            } catch (e) {
                // console.warn("Deep fetch failed", e);
            }
        };

        fetchDeepAnalysis();
        const interval = setInterval(fetchDeepAnalysis, 60000); // 60s refresh

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [watchlist, mode]); // Re-run when mode or watchlist changes

    // 4. BACKGROUND LOOP: Slow Details for Watchlist (News Sentiment) - 30s
    useEffect(() => {
        let isMounted = true;

        const fetchSlowDetails = async () => {
            const targetAssets = activeCategory === 'All' ? watchlist : watchlist.filter(a => a.category === activeCategory);
            const assetsToFetch = targetAssets.slice(0, 10); // Check top 10 for detailed analysis
            const symbols = assetsToFetch.map(a => a.symbol);

            // Standard loop for heavy data
            const chunk = 3;
            for (let i = 0; i < symbols.length; i += chunk) {
                if (!isMounted) break;
                const batch = symbols.slice(i, i + chunk);
                await Promise.all(batch.map(async (symbol) => {
                    if (symbol === selectedSymbolRef.current) return;

                    try {
                        const [stockRes, newsRes] = await Promise.all([
                            fetch(`/api/stock/${symbol}`),
                            fetch(`/api/news/${symbol}`)
                        ]);
                        const stockJson = await stockRes.json();
                        const newsJson = await newsRes.json();

                        if (!isMounted) return;

                        if (!stockJson.error && !newsJson.error) {
                            setSummaries(prev => ({
                                ...prev,
                                [symbol]: {
                                    ...prev[symbol], // Keep price
                                    price: stockJson.latest.close, // Sync price
                                    recommendation: stockJson.recommendation,
                                    sentiment: newsJson.sentiment
                                }
                            }));
                        }
                    } catch (e) { }
                }));
                await new Promise(r => setTimeout(r, 1000));
            }
        };

        fetchSlowDetails();
        const interval = setInterval(fetchSlowDetails, 30000); // 30s Slow Cycle

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
        // Removed selectedSymbol from dependencies to stop network thrashing on share switch
    }, [watchlist, activeCategory]);

    return {
        stockData,
        newsData,
        summaries,
        aiInsights,
        loading,
        aiLoading,
        error,
        lastUpdated: stockData ? new Date() : null // Derived or could be state
    };
};
