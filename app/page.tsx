'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import StockChart from '@/components/StockChart';
import NewsFeed from '@/components/NewsFeed';
import StockCard from '@/components/StockCard';
import DeepAnalysisCard from '@/components/DeepAnalysisCard';
import PositionCalculator from '@/components/PositionCalculator';
import ErrorBoundary from '@/components/ErrorBoundary';
import { StockDataPoint } from '@/lib/technical-analysis';
import { TradeRecommendation, SentimentResult } from '@/lib/analysis';
import {
  LayoutDashboard, TrendingUp, TrendingDown, Activity,
  Search, Filter, ArrowUpDown, RefreshCw, Smartphone, Menu, X, Moon, Sun, Layers, LogOut
} from 'lucide-react';
import { ASSETS, Asset } from '@/config/assets';

// Types


type Category = 'All' | 'Stock' | 'Crypto' | 'Index' | 'Forex';
type SortOption = 'Symbol' | 'Price' | 'Sentiment' | 'Recommendation' | 'Combined';

// Translations
const TRANSLATIONS = {
  en: {
    searchPlaceholder: "Search assets...",
    all: "All",
    stock: "Stocks",
    crypto: "Crypto",
    index: "Indices",
    forex: "Forex",
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
    sortOptions: {
      Symbol: "Symbol",
      Price: "Price",
      Sentiment: "Market Hype",
      Recommendation: "Signal Strength",
      Combined: "Top Opportunities"
    },
    stopLoss: "Stop Loss",
    takeProfit: "Take Profit",
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
    },
    mode: {
      swing: "Swing",
      scalp: "Day Trade",
      long_term: "Long Term",
      label: "Mode"
    }
  },
  de: {
    searchPlaceholder: "Assets suchen...",
    all: "Alle",
    stock: "Aktien",
    crypto: "Krypto",
    index: "Indizes",
    forex: "Devisen",
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
    sortOptions: {
      Symbol: "Symbol",
      Price: "Preis",
      Sentiment: "Markt-Hype",
      Recommendation: "Signal-Stärke",
      Combined: "Top-Chancen"
    },
    stopLoss: "Stop-Loss",
    takeProfit: "Gewinnziel",
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
    },
    mode: {
      swing: "Swing",
      scalp: "Day Trade",
      long_term: "Langfristig",
      label: "Modus"
    }
  }
};

import { useMarketData, StockData, NewsResponse } from '@/hooks/useMarketData';

// Helper: Get currency for a symbol
const getCurrencyForSymbol = (symbol: string): string => {
  if (symbol.endsWith('.DE') || symbol.endsWith('.PA')) return 'EUR';
  if (symbol.endsWith('.L')) return 'GBP';
  if (symbol.endsWith('=X')) return ''; // Forex pairs
  return 'USD';
};

// Helper: Format price with correct currency
const formatPrice = (price: number, symbol: string, locale: string): string => {
  const currency = getCurrencyForSymbol(symbol);
  if (!currency) return price.toFixed(4); // Forex
  return price.toLocaleString(locale, { style: 'currency', currency });
};

// Helper: Detect if market is currently open (US Eastern Time)
const isMarketOpen = (): boolean => {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  return timeInMinutes >= 570 && timeInMinutes < 960; // 9:30 AM - 4:00 PM ET
};

// Helper: Calculate Risk/Reward ratio
const getRiskRewardRatio = (price: number, stopLoss: number, takeProfit: number): string => {
  const risk = Math.abs(price - stopLoss);
  const reward = Math.abs(takeProfit - price);
  if (risk === 0) return 'N/A';
  const ratio = reward / risk;
  return `1:${ratio.toFixed(1)}`;
};

export default function Home() {
  // --- State ---

  // Watchlist: Initialize with all default assets
  const [watchlist, setWatchlist] = useState<Asset[]>(ASSETS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('AAPL');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Ensure watchlist is populated (Hydration fix)
  useEffect(() => {
    if (watchlist.length === 0 && ASSETS.length > 0) {
      setWatchlist(ASSETS);
    }
  }, [watchlist]);

  // Language State
  const [lang, setLang] = useState<'en' | 'de'>('en');
  const t = TRANSLATIONS[lang];

  // Filtering & Sorting
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [sortOption, setSortOption] = useState<SortOption>('Combined');
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<'swing' | 'scalp' | 'long_term'>('swing');

  // Use Custom Hook for Data Fetching
  const { stockData, newsData, summaries, aiInsights, loading: dataLoading, aiLoading, lastUpdated, triggerAiAnalysis, multiTimeframe, fetchMultiTimeframe } = useMarketData(selectedSymbol, watchlist, activeCategory, mode);

  // Dark Mode
  const [darkMode, setDarkMode] = useState(false);

  // Multi-Timeframe toggle
  const [showMultiTF, setShowMultiTF] = useState(false);

  // Hydration guard: only compute time-dependent values after mount to avoid SSR mismatch
  const [mounted, setMounted] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  useEffect(() => {
    setMounted(true);
    setMarketOpen(isMarketOpen());
    // Re-check market status every minute
    const id = setInterval(() => setMarketOpen(isMarketOpen()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Translation State
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  // --- Effects ---

  // DARK MODE: Apply to <html> + persist
  useEffect(() => {
    const saved = localStorage.getItem('sb_darkMode');
    if (saved === 'true') setDarkMode(true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('sb_darkMode', String(darkMode));
  }, [darkMode]);

  // LOCALSTORAGE: Persist preferences
  useEffect(() => {
    const savedLang = localStorage.getItem('sb_lang') as 'en' | 'de' | null;
    const savedMode = localStorage.getItem('sb_mode') as 'swing' | 'scalp' | 'long_term' | null;
    const savedSort = localStorage.getItem('sb_sort') as SortOption | null;
    if (savedLang) setLang(savedLang);
    if (savedMode) setMode(savedMode);
    if (savedSort) setSortOption(savedSort);
  }, []);
  useEffect(() => { localStorage.setItem('sb_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('sb_mode', mode); }, [mode]);
  useEffect(() => { localStorage.setItem('sb_sort', sortOption); }, [sortOption]);

  // 3. TRANSLATION EFFECT (Keep specific UI logic here)
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
    const sorted = [...result].sort((a, b) => { // Create copy
      const sumA = summaries[a.symbol];
      const sumB = summaries[b.symbol];

      // Safety check: If price data missing, push to bottom or keep stable?
      // We keep stable for now to avoid jumping.
      if (!sumA || !sumB) return 0;

      try {
        switch (sortOption) {
          case 'Price':
            return (sumB?.price ?? 0) - (sumA?.price ?? 0);
          case 'Sentiment':
            return (sumB?.sentiment?.score ?? 0) - (sumA?.sentiment?.score ?? 0);
          case 'Recommendation':
            const getSignalWeight = (rec: TradeRecommendation | undefined) => {
              if (!rec) return 0;
              if (rec.action === 'LONG' && rec.confidence === 'HIGH') return 5;
              if (rec.action === 'SHORT' && rec.confidence === 'HIGH') return 4;
              if (rec.action === 'LONG') return 3;
              if (rec.action === 'SHORT') return 2;
              return 1;
            };
            return getSignalWeight(sumB?.recommendation) - getSignalWeight(sumA?.recommendation);
          case 'Combined':
            const getCombinedScore = (sum: any, sym: string) => {
              if (!sum?.recommendation || !sum?.sentiment) return 0;
              let signalScore = 0;
              if (sum.recommendation.action === 'LONG') {
                signalScore = sum.recommendation.confidence === 'HIGH' ? 3 : 1.5;
              } else if (sum.recommendation.action === 'SHORT') {
                signalScore = sum.recommendation.confidence === 'HIGH' ? 3 : 1.5;
              }
              const sentimentScore = Math.abs(sum.sentiment.score || 0);
              // Factor in AI score (0-10, normalized to 0-2)
              const ai = aiInsights[sym]?.score;
              const aiBonus = ai ? Math.abs(ai - 5) / 2.5 : 0; // Distance from neutral, normalized
              return signalScore + sentimentScore + aiBonus;
            };
            return getCombinedScore(sumB, b.symbol) - getCombinedScore(sumA, a.symbol);
          case 'Symbol':
          default:
            return a.symbol.localeCompare(b.symbol);
        }
      } catch (e) {
        console.error("Sort Error", e);
        return 0;
      }
    });

    // console.log("Filtered Assets:", sorted.length);
    return sorted;
  }, [watchlist, activeCategory, searchQuery, sortOption, summaries, aiInsights]);

  // KEYBOARD NAVIGATION: Arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIdx = filteredAndSortedAssets.findIndex(a => a.symbol === selectedSymbol);
        let nextIdx = currentIdx;
        if (e.key === 'ArrowDown') nextIdx = Math.min(currentIdx + 1, filteredAndSortedAssets.length - 1);
        if (e.key === 'ArrowUp') nextIdx = Math.max(currentIdx - 1, 0);
        if (nextIdx !== currentIdx && filteredAndSortedAssets[nextIdx]) {
          setSelectedSymbol(filteredAndSortedAssets[nextIdx].symbol);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSymbol, filteredAndSortedAssets]);

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
    if (cat === 'Forex') return t.forex;
    return cat;
  };

  const locale = lang === 'de' ? 'de-DE' : 'en-US';

  return (
    <div className={`flex h-screen font-sans overflow-hidden relative ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-[#F5F5F7] text-slate-800'}`}>

      {/* --- Mobile Sidebar Overlay --- */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* --- Sidebar (Watchlist) --- */}
      <aside className={`absolute z-50 md:relative w-full sm:w-[400px] md:w-[400px] h-full flex flex-col border-r backdrop-blur-xl transition-transform duration-300 ease-in-out ${darkMode ? 'border-gray-700 bg-gray-800/95 md:bg-gray-800/80' : 'border-gray-200 bg-white/95 md:bg-white/80'} ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        {/* Sidebar Header */}
        <div className="p-4 md:p-6 pb-2">
          <div className="flex justify-between items-start mb-4">
            <h1 className={`text-xl font-bold flex items-center gap-2 tracking-tight ${darkMode ? 'text-gray-100' : 'text-slate-800'}`}>
              <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                <TrendingUp size={20} />
              </div>
              Swing Bot <span className="text-gray-400 font-light ml-1 text-sm">{t.pro}</span>
            </h1>

            <div className="flex items-center gap-2">
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-1.5 rounded-lg transition-all ${darkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-400 hover:text-gray-600'}`}
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              {/* Language Toggle */}
              <div className={`p-1 rounded-lg flex text-xs font-bold ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <button
                  onClick={() => setLang('en')}
                  className={`px-2 py-1 rounded-md transition-all ${lang === 'en' ? (darkMode ? 'bg-gray-600 shadow text-indigo-400' : 'bg-white shadow text-indigo-600') : 'text-gray-400 hover:text-gray-600'}`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLang('de')}
                  className={`px-2 py-1 rounded-md transition-all ${lang === 'de' ? (darkMode ? 'bg-gray-600 shadow text-indigo-400' : 'bg-white shadow text-indigo-600') : 'text-gray-400 hover:text-gray-600'}`}
                >
                  DE
                </button>
              </div>
              {/* Mobile Close Sidebar Button */}
              <button
                className="md:hidden p-1 text-gray-400 hover:text-gray-800 bg-gray-100 rounded-lg"
                onClick={() => setShowMobileSidebar(false)}
              >
                <X size={24} />
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
              className={`w-full rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium ${darkMode ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100'}`}
            />
          </div>

          {/* Mode Toggle */}
          <div className={`flex p-1 rounded-xl mt-4 mx-1 gap-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <button
              onClick={() => setMode('swing')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'swing' ? (darkMode ? 'bg-gray-600 shadow text-indigo-400' : 'bg-white shadow text-indigo-600') : 'text-gray-400 hover:text-gray-600'}`}
            >
              {t.mode.swing}
            </button>
            <button
              onClick={() => setMode('scalp')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'scalp' ? (darkMode ? 'bg-gray-600 shadow text-indigo-400' : 'bg-white shadow text-indigo-600') : 'text-gray-400 hover:text-gray-600'}`}
            >
              {t.mode.scalp}
            </button>
            <button
              onClick={() => setMode('long_term')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === 'long_term' ? (darkMode ? 'bg-gray-600 shadow text-indigo-400' : 'bg-white shadow text-indigo-600') : 'text-gray-400 hover:text-gray-600'}`}
            >
              {t.mode.long_term}
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 px-1 sm:px-0 scrollbar-none snap-x h-7">
            {['All', 'Stock', 'Crypto', 'Index', 'Forex'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as Category)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap snap-start shrink-0
                            ${activeCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : darkMode ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}
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
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="bg-transparent text-xs font-bold text-indigo-600 focus:outline-none cursor-pointer"
              >
                {(Object.keys(t.sortOptions) as SortOption[]).map((key) => (
                  <option key={key} value={key}>
                    {t.sortOptions[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Asset List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 custom-scrollbar">
          {filteredAndSortedAssets.map(asset => (
            <div key={asset.symbol} className="min-h-[160px]"> {/* Dynamic height for layout stability */}
              <StockCard
                symbol={asset.symbol}
                data={summaries[asset.symbol] ? { ...summaries[asset.symbol], close: summaries[asset.symbol].price } as any : null}
                recommendation={summaries[asset.symbol]?.recommendation}
                sentiment={summaries[asset.symbol]?.sentiment}
                aiScore={aiInsights[asset.symbol]?.score}
                changePercent={summaries[asset.symbol]?.changePercent}
                fiftyTwoWeekHigh={summaries[asset.symbol]?.fiftyTwoWeekHigh}
                fiftyTwoWeekLow={summaries[asset.symbol]?.fiftyTwoWeekLow}
                selected={selectedSymbol === asset.symbol}
                onSelect={() => { setSelectedSymbol(asset.symbol); setShowMobileSidebar(false); }}
                onRemove={(e) => removeAsset(e, asset.symbol)}
                lang={lang}
                loading={!summaries[asset.symbol]}
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
        <div className={`p-4 border-t text-xs text-gray-400 flex justify-between items-center ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50/50'}`}>
          <span>{t.marketStatus}: <span className={`font-bold ${marketOpen ? 'text-green-600' : 'text-red-500'}`}>{mounted ? (marketOpen ? t.open : t.closed) : '—'}</span></span>
          <div className="flex items-center gap-3">
            <span>v3.0 {t.pro}</span>
            <button
              onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.href = '/login'; }}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>


      {/* --- Main Content --- */}
      <main className={`flex-1 flex flex-col overflow-hidden ${darkMode ? 'bg-gray-900' : 'bg-[#F5F5F7]'}`}>
        {/* Top Bar */}
        <header className={`h-16 flex items-center justify-between px-4 md:px-8 border-b backdrop-blur-md z-10 sticky top-0 ${darkMode ? 'border-gray-700/50 bg-gray-800/50' : 'border-gray-200/50 bg-white/50'}`}>
          <div className="flex items-center gap-3 md:gap-4">
            <button
              className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => setShowMobileSidebar(true)}
            >
              <Menu size={24} />
            </button>
            <h2 className={`text-xl md:text-2xl font-black tracking-tight ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
              {selectedSymbol}
            </h2>
            {stockData && (
              <div className="flex items-center gap-2">
                <span className={`text-xl font-mono font-medium tracking-tight
                           ${stockData.latest.close > stockData.latest.open ? 'text-green-600' : 'text-red-500'}
                       `}>
                  {formatPrice(stockData.latest.close, selectedSymbol, locale)}
                </span>
                {summaries[selectedSymbol]?.changePercent !== undefined && (
                  <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${summaries[selectedSymbol].changePercent! >= 0
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                    }`}>
                    {summaries[selectedSymbol].changePercent! >= 0 ? '+' : ''}
                    {summaries[selectedSymbol].changePercent!.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>
          <div>
            {mounted && lastUpdated && (
              <div className={`flex items-center gap-2 text-xs font-medium text-gray-400 px-3 py-1.5 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} />
                {t.updated} {lastUpdated.toLocaleTimeString(locale)}
              </div>
            )}
          </div>
        </header>

        {/* Content Scroll View */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {dataLoading && !stockData ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
              <p>{t.analyzing} {selectedSymbol}...</p>
            </div>
          ) : selectedSymbol && stockData && stockData.latest && stockData.recommendation && Array.isArray(stockData.data) && stockData.data.length > 0 ? (
            <ErrorBoundary>
            <div className="max-w-6xl mx-auto space-y-6">

              {/* Technical Signal Card — full width */}
              <div className={`rounded-3xl p-5 md:p-8 shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0 mb-5">
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t.technicalSignal}</h3>
                    <h4 className={`text-4xl font-black mt-1
                                       ${stockData.recommendation.action === 'LONG' ? 'text-green-600' :
                        stockData.recommendation.action === 'SHORT' ? 'text-red-600' : 'text-gray-500'}
                                   `}>
                      {t.signal[stockData.recommendation.action as keyof typeof t.signal] || stockData.recommendation.action}
                    </h4>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold border
                                   ${stockData.recommendation.confidence === 'HIGH'
                      ? 'bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400'
                      : (darkMode ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500')}
                               `}>
                    {stockData.recommendation.confidence} {t.confidence}
                  </span>
                </div>

                <p className={`font-medium leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {stockData.recommendation.reason}.
                </p>

                {/* Trading Plan + Patterns in a row */}
                <div className="mt-6 flex flex-col lg:flex-row gap-6">
                  {/* SL / TP / R:R */}
                  {stockData.recommendation.stopLoss && stockData.recommendation.takeProfit && (
                    <div className="grid grid-cols-3 gap-3 flex-1">
                      <div className={`p-3 rounded-xl border flex flex-col ${darkMode ? 'bg-red-900/20 border-red-900/40' : 'bg-red-50 border-red-100'}`}>
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wide mb-1">{t.stopLoss}</span>
                        <span className={`text-base font-bold ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
                          {formatPrice(stockData.recommendation.stopLoss, selectedSymbol, locale)}
                        </span>
                      </div>
                      <div className={`p-3 rounded-xl border flex flex-col ${darkMode ? 'bg-green-900/20 border-green-900/40' : 'bg-green-50 border-green-100'}`}>
                        <span className="text-xs font-bold text-green-400 uppercase tracking-wide mb-1">{t.takeProfit}</span>
                        <span className={`text-base font-bold ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                          {formatPrice(stockData.recommendation.takeProfit, selectedSymbol, locale)}
                        </span>
                      </div>
                      <div className={`p-3 rounded-xl border flex flex-col ${darkMode ? 'bg-indigo-900/20 border-indigo-900/40' : 'bg-indigo-50 border-indigo-100'}`}>
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide mb-1">Risk:Reward</span>
                        <span className={`text-base font-bold ${darkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                          {getRiskRewardRatio(stockData.latest.close, stockData.recommendation.stopLoss, stockData.recommendation.takeProfit)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* AI Pattern Chips */}
                  {stockData.recommendation.patterns && stockData.recommendation.patterns.length > 0 && (
                    <div className={`pt-4 lg:pt-0 lg:pl-6 lg:border-l flex-shrink-0 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600">
                          <Smartphone size={13} />
                        </div>
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase">Pattern</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {stockData.recommendation.patterns.map(p => (
                          <span key={p} className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40 rounded-lg text-xs font-bold">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Deep Analysis — directly below signal, prominent position */}
              <DeepAnalysisCard
                symbol={selectedSymbol}
                lang={lang}
                result={aiInsights[selectedSymbol] || null}
                loading={aiLoading}
                onAnalyze={() => triggerAiAnalysis()}
                hasNews={!!newsData?.news && newsData.news.length > 0}
              />

              {/* About Section */}
              {stockData.profile && (
                <div className={`rounded-3xl p-5 md:p-8 shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                    <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{t.about} {stockData.symbol}</h3>
                    <div className="flex gap-2">
                      {stockData.profile.sector && (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                          {stockData.profile.sector}
                        </span>
                      )}
                      {stockData.profile.industry && (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold hidden sm:inline-block ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                          {stockData.profile.industry}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm leading-relaxed max-h-40 overflow-y-auto custom-scrollbar pr-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
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
                    <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
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

              {/* Multi-Timeframe Overview */}
              <div className={`rounded-3xl p-5 md:p-8 shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers size={18} className="text-indigo-500" />
                    <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                      {lang === 'de' ? 'Multi-Timeframe Signale' : 'Multi-Timeframe Signals'}
                    </h3>
                  </div>
                  <button
                    onClick={() => { setShowMultiTF(!showMultiTF); if (!multiTimeframe) fetchMultiTimeframe(); }}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${showMultiTF ? 'bg-indigo-600 text-white border-indigo-600' : (darkMode ? 'border-gray-600 text-gray-400 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-indigo-600')}`}
                  >
                    {showMultiTF ? (lang === 'de' ? 'Ausblenden' : 'Hide') : (lang === 'de' ? 'Anzeigen' : 'Show')}
                  </button>
                </div>
                {showMultiTF && multiTimeframe && (
                  <div className="grid grid-cols-3 gap-3">
                    {(['scalp', 'swing', 'long_term'] as const).map(m => {
                      const rec = multiTimeframe[m];
                      if (!rec) return null;
                      const modeLabel = m === 'scalp' ? 'Day Trade' : m === 'swing' ? 'Swing' : 'Long Term';
                      return (
                        <div key={m} className={`p-3 rounded-xl border text-center ${darkMode ? 'border-gray-600' : 'border-gray-100'}`}>
                          <div className="text-xs font-bold text-gray-400 uppercase mb-2">{modeLabel}</div>
                          <div className={`text-lg font-black ${rec.action === 'LONG' ? 'text-green-500' : rec.action === 'SHORT' ? 'text-red-500' : 'text-gray-400'}`}>
                            {rec.action}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">{rec.confidence}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {showMultiTF && !multiTimeframe && (
                  <div className="text-center py-4 text-gray-400 text-sm animate-pulse">{lang === 'de' ? 'Lade...' : 'Loading...'}</div>
                )}
              </div>

              {/* Chart Section */}
              <div className={`rounded-3xl p-3 sm:p-5 md:p-8 shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <h3 className={`text-lg font-bold mb-4 sm:mb-6 px-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{t.priceAction}</h3>
                <StockChart data={stockData.data} mode={mode} />
              </div>

              {/* Position Calculator */}
              <PositionCalculator
                symbol={selectedSymbol}
                entryPrice={stockData.latest.close}
                stopLoss={stockData.recommendation.stopLoss}
                takeProfit={stockData.recommendation.takeProfit}
                action={stockData.recommendation.action}
                reason={stockData.recommendation.reason}
                confidence={stockData.recommendation.confidence}
                lang={lang}
                formatPrice={(p: number) => formatPrice(p, selectedSymbol, locale)}
              />

              {/* News Section */}
              <div className={`rounded-3xl p-5 md:p-8 shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{t.latestIntel}</h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                    {newsData?.news?.length} {t.articles}
                  </span>
                </div>
                <NewsFeed news={newsData?.news || []} sentimentDetails={newsData?.sentiment?.details} />
              </div>

            </div>
            </ErrorBoundary>
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
