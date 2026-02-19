'use client';

import { useState, useEffect, useMemo } from 'react';
import StockChart from '@/components/StockChart';
import NewsFeed from '@/components/NewsFeed';
import StockCard from '@/components/StockCard';
import { StockDataPoint } from '@/lib/technical-analysis';
import { TradeRecommendation, SentimentResult } from '@/lib/analysis';
// Icons
import {
  LayoutDashboard, TrendingUp, TrendingDown, Activity,
  Search, Filter, ArrowUpDown, RefreshCw, Smartphone
} from 'lucide-react';
// Asset Config
import { ASSETS, Asset } from '@/config/assets';

// Types
interface StockData {
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

interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: any;
}

interface NewsResponse {
  symbol: string;
  news: NewsItem[];
  sentiment: SentimentResult;
}

type Category = 'All' | 'Stock' | 'Crypto' | 'Index';
type SortOption = 'Symbol' | 'Price' | 'Sentiment' | 'Recommendation';

// Translations
const TRANSLATIONS = {
  en: {
    searchPlaceholder: "Search assets...",
    all: "All",
    stock: "Stocks",
    crypto: "Crypto",
    index: "Indices",
    sortBy: "Sort by",
    assets: "Assets",
    marketStatus: "Market Status",
    open: "OPEN",
    closed: "CLOSED",
    technicalSignal: "Technical Signal",
    confidence: "CONFIDENCE",
    marketHype: "Market Hype (News AI)",
    force: "Force",
    about: "About",
    priceAction: "Price Action",
    latestIntel: "Latest Intelligence",
    articles: "Articles",
    updated: "Updated",
    analyzing: "Analyzing",
    selectAsset: "Select an asset to view analysis.",
    noAssets: "No assets found.",
    pro: "Pro",
    profileLink: "All Company Info",
    noData: "Insufficient news data.",
    noDescription: "No description available.",
    signal: {
      LONG: "LONG",
      SHORT: "SHORT",
      WAIT: "WAIT"
    },
    sentiment: {
      Bullish: "Bullish",
      Bearish: "Bearish"
    }
  },
  de: {
    searchPlaceholder: "Assets suchen...",
    all: "Alle",
    stock: "Aktien",
    crypto: "Krypto",
    index: "Indizes",
    sortBy: "Sortieren:",
    assets: "Werte",
    marketStatus: "Marktstatus",
    open: "GEÖFFNET",
    closed: "GESCHLOSSEN",
    technicalSignal: "Technisches Signal",
    confidence: "KONFIDENZ",
    marketHype: "Marktstimmung (News AI)",
    force: "Stärke",
    about: "Über",
    priceAction: "Kursentwicklung",
    latestIntel: "Neueste Nachrichten",
    articles: "Artikel",
    updated: "Aktualisiert",
    analyzing: "Analysiere",
    selectAsset: "Bitte ein Asset auswählen.",
    noAssets: "Keine Assets gefunden.",
    pro: "Pro",
    profileLink: "Alle Infos",
    noData: "Keine News-Daten verfügbar.",
    noDescription: "Keine Beschreibung verfügbar.",
    signal: {
      LONG: "KAUFEN",
      SHORT: "VERKAUFEN",
      WAIT: "WARTEN"
    },
    sentiment: {
      Bullish: "Bullisch",
      Bearish: "Bärisch"
    }
  }
};

export default function Home() {
  // --- State ---

  // Watchlist: Initialize with all default assets
  const [watchlist, setWatchlist] = useState<Asset[]>(ASSETS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('AAPL');

  // Language State
  const [lang, setLang] = useState<'en' | 'de'>('en');
  const t = TRANSLATIONS[lang];

  // Filtering & Sorting
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [sortOption, setSortOption] = useState<SortOption>('Symbol');
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [newsData, setNewsData] = useState<NewsResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Summaries for sidebar / grid
  const [summaries, setSummaries] = useState<Record<string, { price: number, recommendation: TradeRecommendation, sentiment: SentimentResult }>>({});

  const [loading, setLoading] = useState(false);

  // Translation State
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  // --- Effects ---

  // 1. FAST LOOP: Refresh Selected Asset (Every 3.5 seconds)
  useEffect(() => {
    if (!selectedSymbol) return;

    // Reset translation on symbol change
    setTranslatedDesc(null);
    setTranslationError(null);

    // Initial fetch
    fetchDetailedData(selectedSymbol);

    const interval = setInterval(() => {
      fetchDetailedData(selectedSymbol);
    }, 3500); // 3.5s - Real-time feel

    return () => clearInterval(interval);
  }, [selectedSymbol]);

  // 3. TRANSLATION EFFECT
  useEffect(() => {
    // If language is English, or no description, or it's the default "No description available."
    if (lang === 'en' || !stockData?.profile?.description || stockData.profile.description === 'No description available.') {
      setTranslatedDesc(null);
      setTranslationError(null);
      return;
    }

    // If language is German and we have a description, translate it
    const translateText = async () => {
      setIsTranslating(true);
      setTranslationError(null);
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: stockData.profile!.description,
            targetLang: 'de'
          })
        });

        if (!res.ok) throw new Error(`Status: ${res.status}`);

        const json = await res.json();
        if (json.translatedText) {
          setTranslatedDesc(json.translatedText);
        } else {
          throw new Error("No text returned");
        }
      } catch (e: any) {
        console.error("Translation client error:", e);
        setTranslationError(e.message || "Unknown error");
      } finally {
        setIsTranslating(false);
      }
    };

    // Debounce slightly to avoid hammering on rapid switches
    const timer = setTimeout(translateText, 500);
    return () => clearTimeout(timer);

  }, [lang, stockData?.profile?.description]);


  // 2. BACKGROUND LOOP: Refresh Watchlist Summaries (Every 15-20 seconds)
  useEffect(() => {
    const fetchVisibleSummaries = async () => {
      // Prioritize assets in the ACTIVE category to save bandwidth
      const targetAssets = activeCategory === 'All'
        ? watchlist
        : watchlist.filter(a => a.category === activeCategory);

      // Limit to first 20 if "All" is selected to avoid massive hammer
      const assetsToFetch = activeCategory === 'All' ? targetAssets.slice(0, 20) : targetAssets;

      const symbols = assetsToFetch.map(a => a.symbol);

      // Batch fetch in chunks of 5
      const chunk = 5;
      for (let i = 0; i < symbols.length; i += chunk) {
        const batch = symbols.slice(i, i + chunk);
        await Promise.all(batch.map(async (symbol) => {
          // If it's the selected symbol, skip (handled by fast loop)
          if (symbol === selectedSymbol) return;

          try {
            const [stockRes, newsRes] = await Promise.all([
              fetch(`/api/stock/${symbol}`),
              fetch(`/api/news/${symbol}`)
            ]);
            const stockJson = await stockRes.json();
            const newsJson = await newsRes.json();

            if (!stockJson.error && !newsJson.error) {
              setSummaries(prev => ({
                ...prev,
                [symbol]: {
                  price: stockJson.latest.close,
                  recommendation: stockJson.recommendation,
                  sentiment: newsJson.sentiment
                }
              }));
            }
          } catch (e) { /* ignore */ }
        }));
        // Small delay between chunks to be nice to API
        await new Promise(r => setTimeout(r, 500));
      }
    };

    fetchVisibleSummaries(); // Initial

    const interval = setInterval(fetchVisibleSummaries, 15000); // 15s Background Cycle

    return () => clearInterval(interval);
  }, [watchlist, activeCategory, selectedSymbol]); // Re-run when filter changes

  // Fetch Detailed Data Function
  const fetchDetailedData = async (symbol: string) => {
    // Don't set global loading on background refreshes, only initial selection
    // We can check if we already have data to decide on spinner

    try {
      const [stockRes, newsRes] = await Promise.all([
        fetch(`/api/stock/${symbol}`),
        fetch(`/api/news/${symbol}`)
      ]);
      const stockJson = await stockRes.json();
      const newsJson = await newsRes.json();

      if (stockJson.error) throw new Error(stockJson.error);

      setStockData(stockJson);
      setNewsData(newsJson);
      setLastUpdated(new Date());
    } catch (error) {
      console.error(error);
      // Don't clear data on transient error to prevent flickering
    } finally {
      setLoading(false);
    }
  };

  // --- Computed ---

  const filteredAndSortedAssets = useMemo(() => {
    let result = watchlist;

    // 1. Filter by Category
    if (activeCategory !== 'All') {
      result = result.filter(a => a.category === activeCategory);
    }

    // 2. Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
    }

    // 3. Sort
    return [...result].sort((a, b) => { // Create copy
      const sumA = summaries[a.symbol];
      const sumB = summaries[b.symbol];

      if (!sumA || !sumB) return 0; // Keep order if loading

      switch (sortOption) {
        case 'Price':
          return sumB.price - sumA.price; // Descending
        case 'Sentiment':
          // Sort by score
          return (sumB.sentiment.score || 0) - (sumA.sentiment.score || 0);
        case 'Recommendation':
          // Assign weight: STRONG BUY > BUY > WAIT > SELL > STRONG SELL
          // Simple hack: LONG=2, WAIT=1, SHORT=0?
          const getScore = (rec: TradeRecommendation) => {
            if (rec.action === 'LONG' && rec.confidence === 'HIGH') return 4;
            if (rec.action === 'LONG') return 3;
            if (rec.action === 'WAIT') return 2;
            if (rec.action === 'SHORT') return 1;
            return 0;
          };
          return getScore(sumB.recommendation) - getScore(sumA.recommendation);
        case 'Symbol':
        default:
          return a.symbol.localeCompare(b.symbol);
      }
    });
  }, [watchlist, activeCategory, searchQuery, sortOption, summaries]);

  // --- handlers ---

  const removeAsset = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    setWatchlist(prev => prev.filter(a => a.symbol !== symbol));
    if (selectedSymbol === symbol) setSelectedSymbol('');
  };

  const getCategoryLabel = (cat: string) => {
    if (cat === 'All') return t.all;
    if (cat === 'Stock') return t.stock;
    if (cat === 'Crypto') return t.crypto;
    if (cat === 'Index') return t.index;
    return cat;
  };

  const locale = lang === 'de' ? 'de-DE' : 'en-US';

  return (
    <div className="flex h-screen bg-[#F5F5F7] font-sans text-slate-800 overflow-hidden">

      {/* --- Sidebar (Watchlist) --- */}
      <aside className="w-[400px] flex flex-col border-r border-gray-200 bg-white/80 backdrop-blur-xl">

        {/* Sidebar Header */}
        <div className="p-6 pb-2">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 tracking-tight">
              <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                <TrendingUp size={20} />
              </div>
              Swing Bot <span className="text-gray-400 font-light ml-1 text-sm">{t.pro}</span>
            </h1>

            {/* Language Toggle */}
            <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-bold">
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded-md transition-all ${lang === 'en' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('de')}
                className={`px-2 py-1 rounded-md transition-all ${lang === 'de' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                DE
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-2 relative group">
            <Search className="absolute left-3 top-2.5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-none">
            {['All', 'Stock', 'Crypto', 'Index'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as Category)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap
                            ${activeCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}
                        `}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
          </div>

          {/* Sort Controls */}
          <div className="flex justify-between items-center mt-2 px-1">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {filteredAndSortedAssets.length} {t.assets}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{t.sortBy}</span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="bg-transparent text-xs font-bold text-indigo-600 focus:outline-none cursor-pointer"
              >
                <option value="Symbol">Symbol</option>
                <option value="Price">{t.signal.LONG === 'KAUFEN' ? 'Preis' : 'Price'}</option>
                <option value="Sentiment">{t.marketHype.split('(')[0]}</option>
                <option value="Recommendation">{t.technicalSignal}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Asset List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 custom-scrollbar">
          {filteredAndSortedAssets.map(asset => (
            <div key={asset.symbol} className="h-[160px]"> {/* Fixed height for layout stability */}
              <StockCard
                symbol={asset.symbol}
                data={summaries[asset.symbol] ? { close: summaries[asset.symbol].price } as any : null}
                recommendation={summaries[asset.symbol]?.recommendation}
                sentiment={summaries[asset.symbol]?.sentiment}
                loading={!summaries[asset.symbol]}
                selected={selectedSymbol === asset.symbol}
                onSelect={() => setSelectedSymbol(asset.symbol)}
                onRemove={(e) => removeAsset(e, asset.symbol)}
                lang={lang}
              />
            </div>
          ))}

          {/* Empty State */}
          {filteredAndSortedAssets.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              {t.noAssets}
            </div>
          )}
        </div>

        {/* Status Footer */}
        <div className="p-4 border-t border-gray-100 text-xs text-gray-400 flex justify-between bg-gray-50/50">
          <span>{t.marketStatus}: <span className="text-green-600 font-bold">{t.open}</span></span>
          <span>v2.1 {t.pro}</span>
        </div>
      </aside>


      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col bg-[#F5F5F7] overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-gray-200/50 bg-white/50 backdrop-blur-md z-10">
          <div className="flex items-baseline gap-4">
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">
              {selectedSymbol}
            </h2>
            {stockData && (
              <span className={`text-xl font-mono font-medium tracking-tight
                         ${stockData.latest.close > stockData.latest.open ? 'text-green-600' : 'text-red-500'}
                     `}>
                {stockData.latest.close.toLocaleString(locale, { style: 'currency', currency: 'USD' })}
              </span>
            )}
          </div>
          <div>
            {lastUpdated && (
              <div className="flex items-center gap-2 text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                {t.updated} {lastUpdated.toLocaleTimeString(locale)}
              </div>
            )}
          </div>
        </header>

        {/* Content Scroll View */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading && !stockData ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
              <p>{t.analyzing} {selectedSymbol}...</p>
            </div>
          ) : selectedSymbol && stockData ? (
            <div className="max-w-6xl mx-auto space-y-6">

              {/* Analysis Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Technical Signal Card */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t.technicalSignal}</h3>
                      <h4 className={`text-3xl font-black mt-1
                                         ${stockData.recommendation.action === 'LONG' ? 'text-green-600' :
                          stockData.recommendation.action === 'SHORT' ? 'text-red-600' : 'text-gray-600'}
                                     `}>
                        {t.signal[stockData.recommendation.action as keyof typeof t.signal] || stockData.recommendation.action}
                      </h4>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold border
                                     ${stockData.recommendation.confidence === 'HIGH' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-50 border-gray-100 text-gray-500'}
                                 `}>
                      {stockData.recommendation.confidence} {t.confidence}
                    </span>
                  </div>

                  <p className="text-gray-600 font-medium leading-relaxed">
                    {stockData.recommendation.reason}.
                  </p>

                  {/* AI Pattern Chips */}
                  {stockData.recommendation.patterns && stockData.recommendation.patterns.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1 bg-purple-100 rounded-lg text-purple-600">
                          <Smartphone size={14} />
                        </div>
                        <span className="text-xs font-bold text-purple-700 uppercase">AI Pattern Recognition</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {stockData.recommendation.patterns.map(p => (
                          <span key={p} className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg text-xs font-bold shadow-sm">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Sentiment Card */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t.marketHype}</h3>

                  {newsData?.sentiment ? (
                    <div>
                      <div className="flex items-end gap-3 mb-6">
                        <span className={`text-4xl font-black
                                            ${newsData.sentiment.label === 'Bullish' ? 'text-green-600' :
                            newsData.sentiment.label === 'Bearish' ? 'text-red-600' : 'text-gray-600'}
                                         `}>
                          {t.sentiment[newsData.sentiment.label as keyof typeof t.sentiment] || newsData.sentiment.label}
                        </span>
                        <span className="text-sm font-medium text-gray-400 mb-2">
                          {t.force}: {newsData.sentiment.score > 0 ? '+' : ''}{newsData.sentiment.score.toFixed(2)}
                        </span>
                      </div>

                      {/* Custom Progress Bar */}
                      <div className="h-4 bg-gray-100 rounded-full w-full overflow-hidden relative mb-4">
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-400 z-10"></div>
                        <div
                          className={`absolute top-0 bottom-0 transition-all duration-500 rounded-full
                                                ${newsData.sentiment.score > 0 ? 'bg-gradient-to-r from-green-300 to-green-500' : 'bg-gradient-to-r from-red-500 to-red-300'}
                                            `}
                          style={{
                            left: newsData.sentiment.score < 0 ? `${50 + (newsData.sentiment.score / 3) * 50}%` : '50%',
                            width: `${Math.abs(newsData.sentiment.score / 3) * 50}%`
                          }}
                        />
                      </div>
                      <p className="text-sm text-gray-500 italic">
                        "{newsData.sentiment.summary}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-400">{t.noData}</p>
                  )}
                </div>
              </div>

              {/* About Section */}
              {stockData.profile && (
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{t.about} {stockData.symbol}</h3>
                    <div className="flex gap-2">
                      {stockData.profile.sector && (
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-600">
                          {stockData.profile.sector}
                        </span>
                      )}
                      {stockData.profile.industry && (
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-600 hidden sm:inline-block">
                          {stockData.profile.industry}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed max-h-40 overflow-y-auto custom-scrollbar pr-2">
                    {/* Handle "No description available" specially */}
                    {stockData.profile.description === 'No description available.' ? (
                      <span className="italic text-gray-400">{t.noDescription}</span>
                    ) : isTranslating ? (
                      <span className="animate-pulse text-gray-400">Translating...</span>
                    ) : translationError ? (
                      <>
                        <span className="text-red-500 text-xs font-bold block mb-1">Translation Error: {translationError}</span>
                        {stockData.profile.description}
                      </>
                    ) : (
                      translatedDesc || stockData.profile.description
                    )}
                  </p>
                  {stockData.profile.website && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <a
                        href={stockData.profile.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 text-sm font-medium hover:underline flex items-center gap-1"
                      >
                        {t.profileLink} &rarr;
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Chart Section */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6">{t.priceAction}</h3>
                <StockChart data={stockData.data} />
              </div>

              {/* News Section */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">{t.latestIntel}</h3>
                  <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-gray-500">
                    {newsData?.news?.length} {t.articles}
                  </span>
                </div>
                <NewsFeed news={newsData?.news || []} sentimentDetails={newsData?.sentiment?.details} />
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-lg">
              {t.selectAsset}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
