'use client';

import { useState, useMemo } from 'react';
import { X, Search, TrendingUp, TrendingDown, Minus, ArrowUpRight, Filter } from 'lucide-react';
import { TradeRecommendation, SentimentResult } from '@/lib/analysis';
import { Asset } from '@/config/assets';
import { relativeStrength, getBenchmark } from '@/lib/benchmarks';

type Summary = {
    price: number;
    change?: number;
    changePercent?: number;
    recommendation: TradeRecommendation;
    sentiment: SentimentResult;
};

interface Props {
    assets: Asset[];
    summaries: Record<string, Summary>;
    onPick: (symbol: string) => void;
    onClose: () => void;
}

const ACTION_COLORS: Record<string, string> = {
    LONG: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    SHORT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    WAIT: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
};

const CONFIDENCE_SCORE: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export default function ScreenerModal({ assets, summaries, onPick, onClose }: Props) {
    const [actionFilter, setActionFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
    const [confidenceFilter, setConfidenceFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('ALL');
    const [categoryFilter, setCategoryFilter] = useState<'All' | 'Stock' | 'Crypto' | 'Index' | 'Forex'>('All');
    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState<'confidence' | 'change' | 'rs'>('confidence');

    const rows = useMemo(() => {
        const spyPct = summaries['SPY']?.changePercent;
        const btcPct = summaries['BTC-USD']?.changePercent;

        const enriched = assets
            .map(a => {
                const s = summaries[a.symbol];
                if (!s?.recommendation) return null;
                const benchSym = getBenchmark(a);
                const benchPct = benchSym === 'BTC-USD' ? btcPct : spyPct;
                const rs = relativeStrength(s.changePercent, benchPct);
                return {
                    asset: a,
                    summary: s,
                    rs,
                    benchSym,
                    confScore: CONFIDENCE_SCORE[s.recommendation.confidence] ?? 0,
                };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);

        const filtered = enriched.filter(r => {
            if (actionFilter !== 'ALL' && r.summary.recommendation.action !== actionFilter) return false;
            if (actionFilter === 'ALL' && r.summary.recommendation.action === 'WAIT') return false;
            if (confidenceFilter === 'HIGH' && r.summary.recommendation.confidence !== 'HIGH') return false;
            if (confidenceFilter === 'MEDIUM' && !['HIGH', 'MEDIUM'].includes(r.summary.recommendation.confidence)) return false;
            if (categoryFilter !== 'All' && r.asset.category !== categoryFilter) return false;
            if (query) {
                const q = query.toLowerCase();
                if (!r.asset.symbol.toLowerCase().includes(q) && !r.asset.name.toLowerCase().includes(q)) return false;
            }
            return true;
        });

        filtered.sort((a, b) => {
            if (sortBy === 'confidence') {
                if (b.confScore !== a.confScore) return b.confScore - a.confScore;
                return Math.abs(b.summary.changePercent ?? 0) - Math.abs(a.summary.changePercent ?? 0);
            }
            if (sortBy === 'change') {
                return (b.summary.changePercent ?? 0) - (a.summary.changePercent ?? 0);
            }
            // rs
            return (b.rs ?? -Infinity) - (a.rs ?? -Infinity);
        });

        return filtered;
    }, [assets, summaries, actionFilter, confidenceFilter, categoryFilter, query, sortBy]);

    const highLongs = rows.filter(r => r.summary.recommendation.action === 'LONG' && r.summary.recommendation.confidence === 'HIGH').length;
    const highShorts = rows.filter(r => r.summary.recommendation.action === 'SHORT' && r.summary.recommendation.confidence === 'HIGH').length;

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-indigo-500" />
                        <h2 className="text-base font-black text-gray-900 dark:text-gray-100">Signal Screener</h2>
                        <span className="text-xs text-gray-400">
                            {highLongs} HIGH LONG · {highShorts} HIGH SHORT
                        </span>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                        <X size={18} />
                    </button>
                </div>

                {/* Filters */}
                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search ticker or name..."
                                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-gray-100"
                            />
                        </div>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="px-3 py-2 text-xs font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-gray-100"
                        >
                            <option value="confidence">Sort: Confidence</option>
                            <option value="change">Sort: % Change</option>
                            <option value="rs">Sort: Rel. Strength</option>
                        </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {(['ALL', 'LONG', 'SHORT'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setActionFilter(v)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-full ${actionFilter === v
                                    ? v === 'LONG' ? 'bg-green-500 text-white'
                                        : v === 'SHORT' ? 'bg-red-500 text-white'
                                            : 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                    }`}
                            >
                                {v}
                            </button>
                        ))}
                        <span className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
                        {(['HIGH', 'MEDIUM', 'ALL'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setConfidenceFilter(v)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-full ${confidenceFilter === v
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                    }`}
                            >
                                {v === 'ALL' ? 'ANY' : v}+
                            </button>
                        ))}
                        <span className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
                        {(['All', 'Stock', 'Crypto', 'Index', 'Forex'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setCategoryFilter(v)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-full ${categoryFilter === v
                                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                    }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-3 py-3">
                    {rows.length === 0 ? (
                        <div className="text-center py-10 text-sm text-gray-400">
                            No results match these filters.
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {rows.map(r => {
                                const action = r.summary.recommendation.action;
                                const conf = r.summary.recommendation.confidence;
                                const chg = r.summary.changePercent;
                                return (
                                    <button
                                        key={r.asset.symbol}
                                        onClick={() => { onPick(r.asset.symbol); onClose(); }}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left group"
                                    >
                                        <div className={`p-1.5 rounded-lg ${ACTION_COLORS[action]} flex-shrink-0`}>
                                            {action === 'LONG' ? <TrendingUp size={14} /> : action === 'SHORT' ? <TrendingDown size={14} /> : <Minus size={14} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-sm text-gray-900 dark:text-gray-100">{r.asset.symbol}</span>
                                                <span className="text-[11px] text-gray-500 truncate">{r.asset.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ACTION_COLORS[action]}`}>
                                                    {action} · {conf}
                                                </span>
                                                {r.rs !== null && (
                                                    <span className={`text-[10px] font-bold ${r.rs >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        RS vs {r.benchSym}: {r.rs >= 0 ? '+' : ''}{r.rs.toFixed(2)}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-black text-gray-900 dark:text-gray-100">
                                                ${r.summary.price?.toFixed(2)}
                                            </div>
                                            {typeof chg === 'number' && (
                                                <div className={`text-[11px] font-bold ${chg >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                                                </div>
                                            )}
                                        </div>
                                        <ArrowUpRight size={14} className="text-gray-300 group-hover:text-indigo-500" />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
