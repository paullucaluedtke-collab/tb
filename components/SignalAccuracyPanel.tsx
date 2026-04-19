'use client';

import { Target, RotateCcw } from 'lucide-react';

interface Stats {
    totalClosed: number;
    wins: number;
    losses: number;
    winRate: number | null;
    longCount: number;
    longWinRate: number | null;
    shortCount: number;
    shortWinRate: number | null;
    avgPnl: number;
}

interface Props {
    stats: Stats;
    onReset: () => void;
    lang: 'en' | 'de';
}

function formatPct(n: number | null, placeholder = '—') {
    if (n === null || isNaN(n)) return placeholder;
    return `${n.toFixed(1)}%`;
}

function formatSignedPct(n: number) {
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
}

export default function SignalAccuracyPanel({ stats, onReset, lang }: Props) {
    const hasData = stats.totalClosed > 0;
    const winRateColor =
        stats.winRate === null ? 'text-gray-400'
            : stats.winRate >= 55 ? 'text-green-600'
                : stats.winRate >= 45 ? 'text-yellow-500'
                    : 'text-red-500';

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 md:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Target size={16} className="text-indigo-500" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {lang === 'de' ? 'Signal-Genauigkeit' : 'Signal Accuracy'}
                    </h3>
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                        {lang === 'de' ? '30 Tage' : '30 days'}
                    </span>
                </div>
                {hasData && (
                    <button
                        onClick={onReset}
                        className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                        title={lang === 'de' ? 'Statistik zurücksetzen' : 'Reset stats'}
                    >
                        <RotateCcw size={11} /> {lang === 'de' ? 'Reset' : 'Reset'}
                    </button>
                )}
            </div>

            {!hasData ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
                    {lang === 'de'
                        ? 'Noch keine abgeschlossenen Signale. Statistik baut sich auf, sobald Signale wechseln.'
                        : 'No closed signals yet. Stats build up as signals flip over time.'}
                </p>
            ) : (
                <>
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
                            <div className={`text-lg font-black ${stats.avgPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
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
                </>
            )}
        </div>
    );
}
