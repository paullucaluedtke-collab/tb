import { ArrowUp, ArrowDown, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { StockDataPoint } from '@/lib/technical-analysis';
import { TradeRecommendation, SentimentResult } from '@/lib/analysis';

interface StockCardProps {
    symbol: string;
    data: StockDataPoint | null;
    recommendation: TradeRecommendation | null;
    sentiment: SentimentResult | null;
    loading: boolean;
    onSelect: () => void;
    selected: boolean;
    onRemove: (e: React.MouseEvent) => void;
    lang?: 'en' | 'de';
}

const StockCard = ({ symbol, data, recommendation, sentiment, loading, onSelect, selected, onRemove, lang = 'en' }: StockCardProps) => {
    if (loading) {
        return (
            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-5 animate-pulse h-40 flex flex-col justify-between border border-gray-100">
                <div className="space-y-2">
                    <div className="h-5 bg-gray-200/50 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200/50 rounded w-1/4"></div>
                </div>
                <div className="h-8 bg-gray-200/50 rounded w-1/2"></div>
            </div>
        );
    }

    // Translations
    const t = {
        LONG: lang === 'de' ? 'KAUFEN' : 'LONG',
        SHORT: lang === 'de' ? 'VERKAUFEN' : 'SHORT',
        WAIT: lang === 'de' ? 'WARTEN' : 'WAIT',
        Bullish: lang === 'de' ? 'Bullisch' : 'Bullish',
        Bearish: lang === 'de' ? 'Bärisch' : 'Bearish',
    };

    // Determine Recommendation Badge Color
    let recBg = 'bg-gray-100 text-gray-600';
    let RecIcon = Minus;
    if (recommendation?.action === 'LONG') {
        recBg = 'bg-green-500/10 text-green-700'; // Soft green background
        RecIcon = TrendingUp;
    } else if (recommendation?.action === 'SHORT') {
        recBg = 'bg-red-500/10 text-red-700'; // Soft red background
        RecIcon = TrendingDown;
    }

    // Determine Sentiment Icon
    let SentimentIcon = ArrowRight;
    let sentColor = 'text-gray-400';
    if (sentiment?.label === 'Bullish') {
        SentimentIcon = ArrowUp;
        sentColor = 'text-green-500';
    } else if (sentiment?.label === 'Bearish') {
        SentimentIcon = ArrowDown;
        sentColor = 'text-red-500';
    }

    const locale = lang === 'de' ? 'de-DE' : 'en-US';

    return (
        <div
            onClick={onSelect}
            className={`relative group rounded-2xl p-5 flex flex-col justify-between h-full transition-all duration-300 cursor-pointer
                ${selected
                    ? 'bg-white shadow-lg ring-1 ring-black/5 scale-[1.02]'
                    : 'bg-white/60 hover:bg-white hover:shadow-md border border-gray-100/50 hover:border-transparent'}
            `}
        >
            {/* Header: Symbol & Price */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 tracking-tight">{symbol}</h3>
                    {data && data.close !== undefined ? (
                        <p className="text-2xl font-medium text-gray-900 tracking-tight mt-1">
                            {data.close.toLocaleString(locale, { style: 'currency', currency: 'USD' })}
                        </p>
                    ) : (
                        <p className="text-sm text-gray-400 mt-1">--</p>
                    )}
                </div>

                {/* Sentiment Indicator (Right Top) */}
                {sentiment && (
                    <div className="flex flex-col items-end">
                        <div className={`p-1.5 rounded-full ${sentiment.label === 'Bullish' ? 'bg-green-50' : sentiment.label === 'Bearish' ? 'bg-red-50' : 'bg-gray-50'}`}>
                            <SentimentIcon size={16} className={sentColor} strokeWidth={2.5} />
                        </div>
                    </div>
                )}
            </div>

            {/* Footer: Recommendation & Patterns */}
            <div className="mt-4 flex items-center justify-between">
                {recommendation && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${recBg}`}>
                        <RecIcon size={14} strokeWidth={2.5} />
                        <span>{t[recommendation.action as keyof typeof t] || recommendation.action}</span>
                    </div>
                )}

                {/* Pattern Indicator Dot */}
                {recommendation?.patterns && recommendation.patterns.length > 0 && (
                    <span className="flex h-3 w-3 relative" title="Pattern Detected">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                    </span>
                )}
            </div>

            {/* Remove Button (Hover only) */}
            <button
                onClick={onRemove}
                className="absolute -top-2 -right-2 bg-white rounded-full p-1.5 shadow-sm text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all scale-90 hover:scale-100"
                title="Remove from watchlist"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
    );
};

export default StockCard;
