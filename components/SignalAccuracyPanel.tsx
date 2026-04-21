'use client';

import { useState } from 'react';
import { Target, RotateCcw, ChevronDown, ChevronUp, Trophy, AlertTriangle } from 'lucide-react';
import { SignalRecord } from '@/hooks/useSignalAccuracy';

interface ConfidenceBreakdown {
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    total: number;
    wins: number;
    winRate: number | null;
    avgPnl: number;
}

interface Stats {
    totalClosed: number;
    openCount: number;
    wins: number;
    losses: number;
    winRate: number | null;
    longCount: number;
    longWinRate: number | null;
    shortCount: number;
    shortWinRate: number | null;
    avgPnl: number;
    tpHits: number;
    slHits: number;
    flips: number;
    expired: number;
    byConfidence: ConfidenceBreakdown[];
    bestTrade: SignalRecord | null;
    worstTrade: SignalRecord | null;
}

interface Props {
    stats: Stats;
    recentTrades: SignalRecord[];
    onReset: () => void;
    lang: 'en' | 'de';
    darkMode?: boolean;
}

function formatPct(n: number | null, placeholder = '—') {
    if (n === null || isNaN(n)) return placeholder;
    return `${n.toFixed(1)}%`;
}

function formatSignedPct(n: number) {
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
}

function reasonLabel(reason?: string, lang: 'en' | 'de' = 'en'): string {
    switch (reason) {
        case 'TP_HIT': return lang === 'de' ? 'TP getroffen' : 'TP Hit';
        case 'SL_HIT': return lang === 'de' ? 'SL getroffen' : 'SL Hit';
        case 'SIGNAL_FLIP': return lang === 'de' ? 'Signal gewechselt' : 'Signal Flip';
        case 'EXPIRED': return lang === 'de' ? 'Abgelaufen' : 'Expired';
        default: return '—';
    }
}

function reasonColor(reason?: string): string {
    switch (reason) {
        case 'TP_HIT': return 'text-green-600 dark:text-green-400';
        case 'SL_HIT': return 'text-red-500 dark:text-red-400';
        case 'EXPIRED': return 'text-gray-400';
        default: return 'text-gray-500';
    }
}

function timeAgo(ts: number, lang: 'en' | 'de'): string {
    const mins = Math.floor((Date.now() - ts) / 60_000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}${lang === 'de' ? 'T' : 'd'}`;
}

export default function SignalAccuracyPanel({ stats, recentTrades, onReset, lang, darkMode }: Props) {
    const [expanded, setExpanded] = useState(false);
    const [showLog, setShowLog] = useState(false);
    const hasData = stats.totalClosed > 0;
    const winRateColor =
        stats.winRate === null ? 'text-gray-400'
            : stats.winRate >= 55 ? 'text-green-600 dark:text-green-400'
                : stats.winRate >= 45 ? 'text-yellow-500'
                    : 'text-red-500';

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 md:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Target size={16} className="text-indigo-500" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {lang === 'de' ? 'Signal-Tracking' : 'Signal Tracking'}
                    </h3>
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                        {lang === 'de' ? '30 Tage' : '30 days'}
                    </span>
                    {stats.openCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold">
                            {stats.openCount} {lang === 'de' ? 'offen' : 'open'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {hasData && (
                        <button
                            onClick={onReset}
                            className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                            title={lang === 'de' ? 'Statistik zurücksetzen' : 'Reset stats'}
                        >
                            <RotateCcw size={11} />
                        </button>
                    )}
                    {hasData && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                </div>
            </div>

            {!hasData ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
                    {lang === 'de'
                        ? 'Noch keine abgeschlossenen Signale. Tracking startet automatisch — TP/SL werden live überwacht.'
                        : 'No closed signals yet. Tracking starts automatically — TP/SL monitored live.'}
                </p>
            ) : (
                <>
                    {/* Main stats row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                                {lang === 'de' ? 'Trefferquote' : 'Win Rate'}
                            </div>
                            <div className={`text-lg font-black ${winRateColor}`}>
                                {formatPct(stats.winRate)}
                            </div>
                            <div className="text-[10px] text-gray-400">
                                {stats.wins}W / {stats.losses}L
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                                Ø P&L
                            </div>
                            <div className={`text-lg font-black ${stats.avgPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                {formatSignedPct(stats.avgPnl)}
                            </div>
                            <div className="text-[10px] text-gray-400">
                                {lang === 'de' ? 'pro Signal' : 'per signal'}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-green-600 dark:text-green-400 font-bold">
                                LONG
                            </div>
                            <div className="text-lg font-black text-gray-900 dark:text-gray-100">
                                {formatPct(stats.longWinRate)}
                            </div>
                            <div className="text-[10px] text-gray-400">
                                {stats.longCount} {lang === 'de' ? 'Signale' : 'signals'}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-red-600 dark:text-red-400 font-bold">
                                SHORT
                            </div>
                            <div className="text-lg font-black text-gray-900 dark:text-gray-100">
                                {formatPct(stats.shortWinRate)}
                            </div>
                            <div className="text-[10px] text-gray-400">
                                {stats.shortCount} {lang === 'de' ? 'Signale' : 'signals'}
                            </div>
                        </div>
                    </div>

                    {/* Close reason breakdown */}
                    <div className="flex gap-3 mt-3 text-[10px]">
                        <span className="text-green-600 dark:text-green-400 font-bold">
                            TP: {stats.tpHits}
                        </span>
                        <span className="text-red-500 font-bold">
                            SL: {stats.slHits}
                        </span>
                        <span className="text-gray-500 font-bold">
                            Flip: {stats.flips}
                        </span>
                        {stats.expired > 0 && (
                            <span className="text-gray-400 font-bold">
                                Exp: {stats.expired}
                            </span>
                        )}
                    </div>

                    {/* Expanded: confidence breakdown + best/worst */}
                    {expanded && (
                        <div className="mt-4 space-y-3">
                            {/* Per-confidence */}
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">
                                    {lang === 'de' ? 'Nach Konfidenz' : 'By Confidence'}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {stats.byConfidence.map(c => (
                                        <div key={c.confidence} className={`rounded-lg p-2 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                                            <div className={`text-[10px] font-bold ${c.confidence === 'HIGH' ? 'text-green-600 dark:text-green-400' : c.confidence === 'MEDIUM' ? 'text-yellow-500' : 'text-gray-400'}`}>
                                                {c.confidence}
                                            </div>
                                            <div className="text-sm font-black text-gray-900 dark:text-gray-100">
                                                {formatPct(c.winRate)}
                                            </div>
                                            <div className="text-[10px] text-gray-400">
                                                {c.total} trades · {formatSignedPct(c.avgPnl)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Best / Worst */}
                            <div className="grid grid-cols-2 gap-2">
                                {stats.bestTrade && (
                                    <div className={`rounded-lg p-2 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                                        <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-bold">
                                            <Trophy size={10} /> {lang === 'de' ? 'Bester Trade' : 'Best Trade'}
                                        </div>
                                        <div className="text-sm font-black text-green-600 dark:text-green-400">
                                            {formatSignedPct(stats.bestTrade.pnlPct ?? 0)}
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            {stats.bestTrade.symbol} · {stats.bestTrade.action}
                                        </div>
                                    </div>
                                )}
                                {stats.worstTrade && (
                                    <div className={`rounded-lg p-2 ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                                        <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold">
                                            <AlertTriangle size={10} /> {lang === 'de' ? 'Schlechtester' : 'Worst Trade'}
                                        </div>
                                        <div className="text-sm font-black text-red-500">
                                            {formatSignedPct(stats.worstTrade.pnlPct ?? 0)}
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            {stats.worstTrade.symbol} · {stats.worstTrade.action}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Trade Log Toggle */}
                            <button
                                onClick={() => setShowLog(!showLog)}
                                className="text-xs text-indigo-500 hover:text-indigo-600 font-bold flex items-center gap-1"
                            >
                                {showLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {lang === 'de' ? `Trade-Log (${recentTrades.length})` : `Trade Log (${recentTrades.length})`}
                            </button>

                            {showLog && recentTrades.length > 0 && (
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    {recentTrades.map((t, i) => (
                                        <div key={`${t.symbol}-${t.startedAt}-${i}`}
                                            className={`flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg ${darkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${t.action === 'LONG' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                    {t.action}
                                                </span>
                                                <span className="font-bold text-gray-900 dark:text-gray-100">{t.symbol}</span>
                                                <span className={`text-[10px] ${reasonColor(t.closeReason)}`}>
                                                    {reasonLabel(t.closeReason, lang)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${(t.pnlPct ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                    {formatSignedPct(t.pnlPct ?? 0)}
                                                </span>
                                                <span className="text-gray-400">
                                                    {timeAgo(t.closedAt ?? t.startedAt, lang)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
