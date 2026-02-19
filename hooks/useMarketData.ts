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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. FAST LOOP: Fetch Detailed Data for Selected Asset (3.5s)
    useEffect(() => {
        if (!selectedSymbol) return;

        let isMounted = true;

        const fetchDetails = async () => {
            try {
                // Only show loading on initial fetch if no data exists
                if (!stockData || stockData.symbol !== selectedSymbol) {
                    setLoading(true);
                }

                const [stockRes, newsRes] = await Promise.all([
                    fetch(`/api/stock/${selectedSymbol}?mode=${mode}`),
                    fetch(`/api/news/${selectedSymbol}`)
                ]);

                const stockJson = await stockRes.json();
                const newsJson = await newsRes.json();

                if (!isMounted) return;

                if (stockJson.error) throw new Error(stockJson.error);
                if (newsJson.error) console.warn("News error:", newsJson.error);

                setStockData(stockJson);
                setNewsData(newsJson);
                setError(null);
            } catch (err: any) {
                if (isMounted) setError(err.message || 'Failed to fetch data');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchDetails(); // Initial fetch

        const interval = setInterval(fetchDetails, 3500); // 3.5s Fast Loop

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [selectedSymbol, mode]);


    // 2. BACKGROUND LOOP: Batch Watchlist Updates (Global Fast - 2.0s)
    useEffect(() => {
        let isMounted = true;

        const fetchBatchPrices = async () => {
            // Fetch ALL assets to ensure background updates for everything
            const symbols = watchlist.map(a => a.symbol);

            if (symbols.length === 0) return;

            try {
                const res = await fetch('/api/batch-quotes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols })
                });
                const json = await res.json();

                if (!isMounted) return;

                if (json.data) {
                    setSummaries(prev => {
                        const next = { ...prev };
                        json.data.forEach((item: any) => {
                            // Merge price, keep existing rec/sentiment if available
                            next[item.symbol] = {
                                ...next[item.symbol], // Keep defaults
                                price: item.price,
                                // We don't update recommendation/sentiment here to save bandwidth
                                recommendation: next[item.symbol]?.recommendation || { action: 'WAIT', confidence: 'LOW', reason: 'Loading...' },
                                sentiment: next[item.symbol]?.sentiment || { score: 0, label: 'Neutral', summary: '' }
                            };
                        });
                        return next;
                    });
                }
            } catch (e) {
                // console.warn("Batch fetch fail", e); 
            }
        };

        fetchBatchPrices(); // Initial fetch

        const interval = setInterval(() => {
            // Anti-Ban: Only poll if tab is visible
            if (!document.hidden) {
                fetchBatchPrices();
            }
        }, 1000); // 1.0s "Live" updates

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [watchlist]);

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
                    if (symbol === selectedSymbol) return;

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
    }, [watchlist, activeCategory, selectedSymbol]);

    return {
        stockData,
        newsData,
        summaries,
        loading,
        error,
        lastUpdated: stockData ? new Date() : null // Derived or could be state
    };
};
