'use client';

import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Zap, Volume2 } from 'lucide-react';
import { TradeRecommendation, SentimentResult } from '@/lib/analysis';
import { Asset } from '@/config/assets';

type Summary = {
    price: number;
    changePercent?: number;
    recommendation: TradeRecommendation;
    sentiment: SentimentResult;
    unusualVolume?: number | null;
};

interface Props {
    assets: Asset[];
    summaries: Record<string, Summary>;
    onPick: (symbol: string) => void;
    lang: 'en' | 'de';
}

export default function DashboardSummary({ assets, summaries, onPick, lang }: Props) {
    const data = useMemo(() => {
        let longCount = 0, shortCount = 0, waitCount = 0;
        let highLong: { symbol: string; changePercent?: number }[] = [];
        let highShort: { symbol: string; changePercent?: number }[] = [];
        let unusualVol: { symbol: string; ratio: number; changePercent?: number }[] = [];

        for (const asset of assets) {
            const s = summaries[asset.symbol];
            if (!s?.recommendation) continue;

            const action = s.recommendation.action;
            if (action === 'LONG') longCount++;
            else if (action === 'SHORT') shortCount++;
            else waitCount++;

            if (s.recommendation.confidence === 'HIGH') {
                if (action === 'LONG') highLong.push({ symbol: asset.symbol, changePercent: s.changePercent });
                else if (action === 'SHORT') highShort.push({ symbol: asset.symbol, changePercent: s.changePercent });
            }

            if (s.unusualVolume && s.unusualVolume >= 2) {
                unusualVol.push({ symbol: asset.symbol, ratio: s.unusualVolume, changePercent: s.changePercent });
            }
        }

        // Sort: strongest momentum first
        highLong.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
        highShort.sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0));
        unusualVol.sort((a, b) => b.ratio - a.ratio);

        return {
            longCount, shortCount, waitCount,
            total: longCount + shortCount + waitCount,
            topLongs: highLong.slice(0, 3),
            topShorts: highShort.slice(0, 3),
            topVolume: unusualVol.slice(0, 3),
        };
    }, [assets, summaries]);

    if (data.total === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                {/* Signal counts */}
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">
                        {lang === 'de' ? 'Marktüberblick' : 'Market Pulse'}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-black">
                        <span className="bg-green-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 text-xs">
                            <TrendingUp size={12} /> {data.longCount}
                        </span>
                        <span className="bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 text-xs">
                            <TrendingDown size={12} /> {data.shortCount}
                        </span>
                        <span className="bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full flex items-center gap-1 text-xs">
                            <Minus size={12} /> {data.waitCount}
                        </span>
                    </span>
                </div>

                {/* Top Longs */}
                {data.topLongs.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                            <Zap size={11} /> {lang === 'de' ? 'Top Long' : 'Top Long'}
                        </span>
                        {data.topLongs.map(x => (
                            <button
                                key={x.symbol}
                                onClick={() => onPick(x.symbol)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-xs font-black text-green-700 dark:text-green-400 transition-colors"
                            >
                                {x.symbol}
                                {typeof x.changePercent === 'number' && (
                                    <span className="font-semibold opacity-70">
                                        {x.changePercent >= 0 ? '+' : ''}{x.changePercent.toFixed(1)}%
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Top Shorts */}
                {data.topShorts.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                            <Zap size={11} /> {lang === 'de' ? 'Top Short' : 'Top Short'}
                        </span>
                        {data.topShorts.map(x => (
                            <button
                                key={x.symbol}
                                onClick={() => onPick(x.symbol)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-xs font-black text-red-700 dark:text-red-400 transition-colors"
                            >
                                {x.symbol}
                                {typeof x.changePercent === 'number' && (
                                    <span className="font-semibold opacity-70">
                                        {x.changePercent >= 0 ? '+' : ''}{x.changePercent.toFixed(1)}%
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Unusual Volume */}
                {data.topVolume.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-orange-500 flex items-center gap-1">
                            <Volume2 size={11} /> {lang === 'de' ? 'Volumen-Spike' : 'Vol Spike'}
                        </span>
                        {data.topVolume.map(x => (
                            <button
                                key={x.symbol}
                                onClick={() => onPick(x.symbol)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-xs font-black text-orange-700 dark:text-orange-400 transition-colors"
                            >
                                {x.symbol}
                                <span className="font-semibold opacity-70">{x.ratio.toFixed(1)}x</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
