'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import StockChart from '@/components/StockChart';
import NewsFeed from '@/components/NewsFeed';
import StockCard from '@/components/StockCard';
import DeepAnalysisCard from '@/components/DeepAnalysisCard';
import PositionCalculator from '@/components/PositionCalculator';
import ErrorBoundary from '@/components/ErrorBoundary';
import AlertToastContainer from '@/components/AlertToast';
import PriceAlertsPanel from '@/components/PriceAlertsPanel';
import PaperTradesPanel from '@/components/PaperTradesPanel';
import ScreenerModal from '@/components/ScreenerModal';
import DashboardSummary from '@/components/DashboardSummary';
import SignalAccuracyPanel from '@/components/SignalAccuracyPanel';
import GeoRiskPanel from '@/components/GeoRiskPanel';
import { useAlerts } from '@/hooks/useAlerts';
import { useSignalHistory } from '@/hooks/useSignalHistory';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { useSignalAccuracy } from '@/hooks/useSignalAccuracy';
import { usePaperTrades } from '@/hooks/usePaperTrades';
import { relativeStrength, getBenchmark } from '@/lib/benchmarks';
import { getMarketStatus } from '@/lib/marketHours';
import { StockDataPoint } from '@/lib/technical-analysis';
import { TradeRecommendation, SentimentResult } from '@/lib/analysis';
import {
  LayoutDashboard, TrendingUp, TrendingDown, Activity,
  Search, Filter, ArrowUpDown, RefreshCw, Smartphone, Menu, X, Moon, Sun, Layers, LogOut,
  Bell, BellOff, BellRing, History, RotateCcw, Clock, Target, SlidersHorizontal,
  CalendarClock, Volume2, AlertTriangle
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

import { resolveCurrency, localeFor } from '@/lib/format';

// Helper: Format price with correct currency.
// EUR for European market suffixes (.DE / .PA / etc.), otherwise lang-driven
// (de → EUR, en → USD). Forex pairs render the raw rate.
const formatPrice = (price: number, symbol: string, lang: 'en' | 'de'): string => {
  if (symbol.endsWith('=X')) return price.toFixed(4);
  const currency = resolveCurrency(lang, symbol);
  return price.toLocaleString(localeFor(lang), { style: 'currency', currency });
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
  const mode = 'swing' as const;

  // Use Custom Hook for Data Fetching
  const { stockData, newsData, summaries, aiInsights, loading: dataLoading, aiLoading, lastUpdated, triggerAiAnalysis, multiTimeframe, fetchMultiTimeframe } = useMarketData(selectedSymbol, watchlist, activeCategory, mode);

  // Alerts + Follow system
  const { followedSymbols, isFollowed, toggleFollow, toasts, dismissToast, alertHistory, clearHistory, notifPermission, requestPermission } = useAlerts(summaries);
  const [showAlertHistory, setShowAlertHistory] = useState(false);

  // Signal history
  const { getDuration } = useSignalHistory(summaries);

  // Signal accuracy tracker (30-day rolling win rate)
  const { stats: accuracyStats, recentTrades, reset: resetAccuracy } = useSignalAccuracy(summaries);

  // Price alerts
  const { alerts: priceAlerts, triggered: triggeredAlerts, addAlert: addPriceAlert, removeAlert: removePriceAlert, toggleAlert: togglePriceAlert, clearTriggered: clearTriggeredAlert, alertsForSymbol } = usePriceAlerts(summaries, notifPermission);
  const [showPriceAlerts, setShowPriceAlerts] = useState(false);

  // Paper trades + screener modals
  const [showPaperTrades, setShowPaperTrades] = useState(false);
  const [showScreener, setShowScreener] = useState(false);
  const { openTrades: paperOpenTrades } = usePaperTrades(summaries);

  const activePositionForSymbol = useMemo(() => {
    const trade = paperOpenTrades.find(t => t.symbol === selectedSymbol);
    if (!trade) return null;
    return {
      side: trade.side,
      entryPrice: trade.entryPrice,
      quantity: trade.quantity,
      pnlPercent: trade.pnlPct ?? 0,
      holdingDays: Math.max(1, Math.round((Date.now() - trade.openedAt) / 86400000)),
    };
  }, [paperOpenTrades, selectedSymbol]);

  // Dark Mode
  const [darkMode, setDarkMode] = useState(false);

  // Signal filter in sidebar (null = show all)
  const [signalFilter, setSignalFilter] = useState<'LONG' | 'SHORT' | 'WAIT' | null>(null);

  // Hydration guard: only compute time-dependent values after mount to avoid SSR mismatch
  const [mounted, setMounted] = useState(false);
  const [marketTick, setMarketTick] = useState(0);
  useEffect(() => {
    setMounted(true);
    // Re-check market status every minute
    const id = setInterval(() => setMarketTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Per-symbol market status — recomputes on symbol change or every minute
  const currentMarketStatus = useMemo(() => {
    if (!mounted) return null;
    const asset = watchlist.find(a => a.symbol === selectedSymbol);
    return getMarketStatus(selectedSymbol, asset?.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, selectedSymbol, watchlist, marketTick]);

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
    const savedSort = localStorage.getItem('sb_sort') as SortOption | null;
    if (savedLang) setLang(savedLang);
    if (savedSort) setSortOption(savedSort);
  }, []);
  useEffect(() => { localStorage.setItem('sb_lang', lang); }, [lang]);
  useEffect(() => { localStorage.setItem('sb_sort', sortOption); }, [sortOption]);

  // Auto-fetch multi-timeframe whenever the selected symbol changes
  useEffect(() => {
    if (selectedSymbol) fetchMultiTimeframe();
  }, [selectedSymbol]);

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

    // 3. Signal filter
    if (signalFilter) {
      result = result.filter(a => summaries[a.symbol]?.recommendation?.action === signalFilter);
    }

    // 4. Sort
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
  }, [watchlist, activeCategory, searchQuery, signalFilter, sortOption, summaries, aiInsights]);

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

  // Relative strength vs benchmark
  const selectedAsset = watchlist.find(a => a.symbol === selectedSymbol);
  const benchmarkSym = selectedAsset ? getBenchmark(selectedAsset) : 'SPY';
  const rs = relativeStrength(
    summaries[selectedSymbol]?.changePercent,
    summaries[benchmarkSym]?.changePercent
  );

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

          {/* Signal Filter Pills */}
          <div className="flex gap-1.5 mt-3 px-1">
            {([null, 'LONG', 'SHORT', 'WAIT'] as const).map(sig => {
              const active = signalFilter === sig;
              const colors = sig === 'LONG' ? 'bg-green-500 text-white' : sig === 'SHORT' ? 'bg-red-500 text-white' : sig === 'WAIT' ? 'bg-gray-400 text-white' : '';
              return (
                <button
                  key={sig ?? 'all'}
                  onClick={() => setSignalFilter(sig)}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all border
                    ${active
                      ? (sig ? colors : 'bg-indigo-600 text-white border-indigo-600')
                      : (darkMode ? 'border-gray-600 text-gray-400 hover:text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300')
                    }`}
                >
                  {sig ?? (lang === 'de' ? 'Alle' : 'All')}
                </button>
              );
            })}
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
        <div className={`p-4 border-t text-xs text-gray-400 flex flex-col gap-2 ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50/50'}`}>
          {/* Mobile-only quick action buttons */}
          <div className="flex gap-2 sm:hidden">
            <button
              onClick={() => { setShowScreener(true); setShowMobileSidebar(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
            >
              <SlidersHorizontal size={13} /> Screener
            </button>
            <button
              onClick={() => { setShowPaperTrades(true); setShowMobileSidebar(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
            >
              <Target size={13} /> Trades
            </button>
          </div>
          <div className="flex justify-between items-center">
            <span>
              {currentMarketStatus ? (
                <>
                  {currentMarketStatus.exchange}:{' '}
                  <span className={`font-bold ${
                    currentMarketStatus.session === 'regular' || currentMarketStatus.session === 'always'
                      ? 'text-green-600'
                      : currentMarketStatus.session === 'pre' || currentMarketStatus.session === 'after'
                        ? 'text-yellow-500'
                        : 'text-red-500'
                  }`}>
                    {currentMarketStatus.label}
                  </span>
                </>
              ) : (
                <>{t.marketStatus}: <span className="text-gray-400">—</span></>
              )}
            </span>
            <div className="flex items-center gap-3">
              <span>v3.1 {t.pro}</span>
              <button
                onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.href = '/login'; }}
                className="text-gray-400 hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
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
            {currentMarketStatus && (
              <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                currentMarketStatus.session === 'regular' || currentMarketStatus.session === 'always'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : currentMarketStatus.session === 'pre' || currentMarketStatus.session === 'after'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500'
                    : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  currentMarketStatus.session === 'regular' || currentMarketStatus.session === 'always'
                    ? 'bg-green-500' : currentMarketStatus.session === 'pre' || currentMarketStatus.session === 'after'
                    ? 'bg-yellow-500' : 'bg-red-500'
                } ${currentMarketStatus.isOpen ? 'animate-pulse' : ''}`} />
                {currentMarketStatus.exchange} · {currentMarketStatus.label}
              </span>
            )}
            {/* Follow / Alert button */}
            {selectedSymbol && (
              <button
                onClick={() => {
                  if (notifPermission === 'default') requestPermission();
                  toggleFollow(selectedSymbol);
                }}
                title={isFollowed(selectedSymbol) ? 'Stop following' : 'Follow — get notified when signal changes'}
                className={`p-1.5 rounded-lg transition-all ${isFollowed(selectedSymbol)
                  ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'
                  : (darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')}`}
              >
                {isFollowed(selectedSymbol) ? <BellRing size={16} /> : <Bell size={16} />}
              </button>
            )}
            {stockData && (
              <div className="flex items-center gap-2">
                <span className={`text-xl font-mono font-medium tracking-tight
                           ${stockData.latest.close > stockData.latest.open ? 'text-green-600' : 'text-red-500'}
                       `}>
                  {formatPrice(stockData.latest.close, selectedSymbol, lang)}
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
                {rs !== null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full hidden md:inline-flex items-center gap-1 ${rs >= 0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                    }`}
                    title={`Relative strength vs ${benchmarkSym}`}
                  >
                    RS {rs >= 0 ? '+' : ''}{rs.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Screener */}
            <button
              onClick={() => setShowScreener(true)}
              className={`p-1.5 rounded-lg transition-all hidden sm:flex items-center gap-1 text-xs font-bold ${darkMode ? 'bg-gray-700 text-gray-300 hover:text-white' : 'bg-gray-100 text-gray-500 hover:text-indigo-600'}`}
              title="Signal Screener"
            >
              <SlidersHorizontal size={14} />
              <span className="hidden md:inline">{lang === 'de' ? 'Screener' : 'Screener'}</span>
            </button>
            {/* Paper Trades */}
            <button
              onClick={() => setShowPaperTrades(true)}
              className={`p-1.5 rounded-lg transition-all hidden sm:flex items-center gap-1 text-xs font-bold ${darkMode ? 'bg-gray-700 text-gray-300 hover:text-white' : 'bg-gray-100 text-gray-500 hover:text-indigo-600'}`}
              title="Paper Trading"
            >
              <Target size={14} />
              <span className="hidden md:inline">{lang === 'de' ? 'Trades' : 'Trades'}</span>
            </button>
            {/* Alert History Button */}
            <button
              onClick={() => setShowAlertHistory(v => !v)}
              className={`relative p-1.5 rounded-lg transition-all ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
              title="Alert history"
            >
              <History size={16} />
              {alertHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {alertHistory.length > 9 ? '9+' : alertHistory.length}
                </span>
              )}
            </button>
            {mounted && lastUpdated && (
              <div className={`flex items-center gap-2 text-xs font-medium text-gray-400 px-3 py-1.5 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <RefreshCw size={12} className={dataLoading ? 'animate-spin' : ''} />
                {t.updated} {lastUpdated.toLocaleTimeString(locale)}
              </div>
            )}
          </div>
        </header>

        {/* Alert History Panel */}
        {showAlertHistory && (
          <div className={`border-b px-6 py-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                {lang === 'de' ? 'Signal-Verlauf' : 'Signal Alert History'}
                <span className="ml-2 text-xs font-normal text-gray-400">({lang === 'de' ? 'verfolgte Assets' : 'followed assets'})</span>
              </h3>
              <div className="flex gap-2">
                {alertHistory.length > 0 && (
                  <button onClick={clearHistory} className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
                    <RotateCcw size={11} /> {lang === 'de' ? 'Löschen' : 'Clear'}
                  </button>
                )}
                <button onClick={() => setShowAlertHistory(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
            </div>
            {alertHistory.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">
                {lang === 'de' ? 'Noch keine Signalwechsel. Klicke auf 🔔 um ein Asset zu verfolgen.' : 'No signal changes yet. Click 🔔 on any asset to follow it.'}
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                {alertHistory.slice(0, 15).map(a => (
                  <div key={a.id} className={`flex-shrink-0 rounded-xl px-3 py-2 border text-xs ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
                    <span className="font-black text-gray-700 dark:text-gray-200">{a.symbol}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-gray-400">{a.from}</span>
                      <span className="text-gray-400">→</span>
                      <span className={`font-bold ${a.to === 'LONG' ? 'text-green-600' : a.to === 'SHORT' ? 'text-red-500' : 'text-gray-500'}`}>{a.to}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{a.timestamp.toLocaleTimeString(locale)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

              {/* Geopolitical & Macro News */}
              <GeoRiskPanel lang={lang} />

              {/* Market Pulse Dashboard — shows signal counts, top longs/shorts, volume spikes */}
              <DashboardSummary
                assets={watchlist}
                summaries={summaries}
                onPick={(sym) => { setSelectedSymbol(sym); setShowMobileSidebar(false); }}
                lang={lang}
              />

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
                    {(() => {
                      const dur = getDuration(selectedSymbol);
                      if (!dur) return null;
                      return (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-400 font-medium">
                            {dur.action} {lang === 'de' ? 'seit' : 'for'} {dur.label}
                          </span>
                        </div>
                      );
                    })()}
                    {/* Contextual badges: earnings warning + unusual volume */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {stockData.nextEarnings && (() => {
                        const days = Math.ceil((new Date(stockData.nextEarnings).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                        if (days < 0 || days > 14) return null;
                        const urgent = days <= 3;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${urgent
                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                            }`}
                            title={new Date(stockData.nextEarnings).toLocaleDateString(locale)}
                          >
                            <CalendarClock size={11} />
                            {lang === 'de'
                              ? (days === 0 ? 'Earnings heute' : days === 1 ? 'Earnings morgen' : `Earnings in ${days}T`)
                              : (days === 0 ? 'Earnings today' : days === 1 ? 'Earnings tomorrow' : `Earnings in ${days}d`)}
                          </span>
                        );
                      })()}
                      {stockData.unusualVolume?.isUnusual && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800"
                          title={lang === 'de' ? 'Ungewöhnliches Volumen' : 'Unusual volume vs 20d avg'}
                        >
                          <Volume2 size={11} />
                          {stockData.unusualVolume.ratio.toFixed(1)}x {lang === 'de' ? 'Volumen' : 'volume'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold border
                                     ${stockData.recommendation.confidence === 'HIGH'
                        ? 'bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400'
                        : (darkMode ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500')}
                                 `}>
                      {stockData.recommendation.confidence} {t.confidence}
                    </span>
                    {stockData.recommendation.horizon && (
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold border
                        ${stockData.recommendation.horizon === 'long'
                          ? 'bg-purple-50 border-purple-100 text-purple-600 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400'
                          : stockData.recommendation.horizon === 'short'
                          ? 'bg-sky-50 border-sky-100 text-sky-600 dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-400'
                          : 'bg-teal-50 border-teal-100 text-teal-600 dark:bg-teal-900/20 dark:border-teal-800 dark:text-teal-400'
                        }`}>
                        {stockData.recommendation.horizon === 'long'
                          ? (lang === 'de' ? '📅 Langfristig' : '📅 Long-term')
                          : stockData.recommendation.horizon === 'short'
                          ? (lang === 'de' ? '⚡ Kurzfristig' : '⚡ Short-term')
                          : (lang === 'de' ? '📊 Mittelfristig' : '📊 Mid-term')}
                      </span>
                    )}
                  </div>
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
                          {formatPrice(stockData.recommendation.stopLoss, selectedSymbol, lang)}
                        </span>
                      </div>
                      <div className={`p-3 rounded-xl border flex flex-col ${darkMode ? 'bg-green-900/20 border-green-900/40' : 'bg-green-50 border-green-100'}`}>
                        <span className="text-xs font-bold text-green-400 uppercase tracking-wide mb-1">{t.takeProfit}</span>
                        <span className={`text-base font-bold ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                          {formatPrice(stockData.recommendation.takeProfit, selectedSymbol, lang)}
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

              {/* Price Alerts */}
              <div>
                <button
                  onClick={() => setShowPriceAlerts(v => !v)}
                  className={`flex items-center gap-2 text-xs font-bold mb-2 px-1 ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Bell size={13} className={priceAlerts.filter(a => a.symbol === selectedSymbol && a.active).length > 0 ? 'text-indigo-500' : ''} />
                  {lang === 'de' ? 'Preisalarme' : 'Price Alerts'}
                  {alertsForSymbol(selectedSymbol).length > 0 && (
                    <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full text-[10px]">
                      {alertsForSymbol(selectedSymbol).length}
                    </span>
                  )}
                  <span className="text-gray-400">{showPriceAlerts ? '▲' : '▼'}</span>
                </button>
                {showPriceAlerts && (
                  <PriceAlertsPanel
                    symbol={selectedSymbol}
                    currentPrice={summaries[selectedSymbol]?.price}
                    alerts={alertsForSymbol(selectedSymbol)}
                    onAdd={addPriceAlert}
                    onRemove={removePriceAlert}
                    onToggle={togglePriceAlert}
                    lang={lang}
                  />
                )}
              </div>

              {/* AI Deep Analysis — directly below signal, prominent position */}
              <DeepAnalysisCard
                symbol={selectedSymbol}
                lang={lang}
                result={aiInsights[selectedSymbol] || null}
                loading={aiLoading}
                onAnalyze={(posInfo?: any) => triggerAiAnalysis(undefined, posInfo || activePositionForSymbol || undefined)}
                hasNews={!!newsData?.news && newsData.news.length > 0}
                activePosition={activePositionForSymbol}
              />

              {/* Signal Tracking — rolling 30-day win rate + TP/SL monitoring + trade log */}
              <SignalAccuracyPanel
                stats={accuracyStats}
                recentTrades={recentTrades}
                onReset={resetAccuracy}
                lang={lang}
                darkMode={darkMode}
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

              {/* Signal Horizon — always-visible timeframe overview */}
              <div className={`rounded-3xl p-5 md:p-6 shadow-sm border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-indigo-500" />
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {lang === 'de' ? 'Signal-Horizont' : 'Signal Horizon'}
                    </h3>
                  </div>
                  <button
                    onClick={() => fetchMultiTimeframe()}
                    className={`p-1.5 rounded-lg transition-all ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Refresh"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
                {multiTimeframe ? (
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { key: 'scalp', label: lang === 'de' ? 'Kurzfristig' : 'Short-term', sub: lang === 'de' ? '1–5 Tage' : '1–5 days' },
                      { key: 'swing', label: lang === 'de' ? 'Mittelfristig' : 'Mid-term', sub: lang === 'de' ? '1–4 Wochen' : '1–4 weeks' },
                      { key: 'long_term', label: lang === 'de' ? 'Langfristig' : 'Long-term', sub: lang === 'de' ? '1–6 Monate' : '1–6 months' },
                    ] as const).map(({ key, label, sub }) => {
                      const rec = multiTimeframe[key];
                      if (!rec) return null;
                      return (
                        <div key={key} className={`p-3 rounded-xl border text-center ${darkMode ? 'border-gray-600 bg-gray-700/30' : 'border-gray-100 bg-gray-50/60'}`}>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
                          <div className={`text-base font-black ${rec.action === 'LONG' ? 'text-green-500' : rec.action === 'SHORT' ? 'text-red-500' : 'text-gray-400'}`}>
                            {lang === 'de' ? (rec.action === 'LONG' ? 'KAUFEN' : rec.action === 'SHORT' ? 'VERKAUFEN' : 'WARTEN') : rec.action}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{rec.confidence}</div>
                          <div className="text-[9px] text-gray-400 mt-0.5 opacity-70">{sub}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map(i => (
                      <div key={i} className={`p-3 rounded-xl border text-center animate-pulse ${darkMode ? 'border-gray-600 bg-gray-700/30' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="h-3 rounded bg-gray-300 dark:bg-gray-600 mb-2 mx-4" />
                        <div className="h-5 rounded bg-gray-200 dark:bg-gray-700 mx-2" />
                      </div>
                    ))}
                  </div>
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
                formatPrice={(p: number) => formatPrice(p, selectedSymbol, lang)}
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

      {/* Alert Toasts — fixed bottom-right */}
      <AlertToastContainer alerts={toasts} onDismiss={dismissToast} />

      {/* Paper Trades Modal */}
      {showPaperTrades && (
        <PaperTradesPanel
          summaries={summaries}
          watchlistSymbols={watchlist.map(a => a.symbol)}
          onClose={() => setShowPaperTrades(false)}
          lang={lang}
        />
      )}

      {/* Screener Modal */}
      {showScreener && (
        <ScreenerModal
          assets={watchlist}
          summaries={summaries}
          onPick={(sym) => { setSelectedSymbol(sym); setShowMobileSidebar(false); }}
          onClose={() => setShowScreener(false)}
          lang={lang}
        />
      )}
    </div>
  );
}
