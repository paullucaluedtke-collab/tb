'use client';

import { Brain, Sparkles, Loader2, Play, TrendingUp, TrendingDown, Shield, Target, AlertTriangle, Zap } from 'lucide-react';

type AIAction = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SCALE_IN' | 'TRIM' | 'SELL' | 'WAIT';

interface DeepAnalysisCardProps {
    symbol: string;
    lang: 'en' | 'de';
    result?: AIResult | null;
    loading?: boolean;
    onAnalyze?: (positionInfo?: any) => void;
    hasNews?: boolean;
    activePosition?: {
        side: 'LONG' | 'SHORT';
        entryPrice: number;
        quantity: number;
        pnlPercent: number;
        holdingDays: number;
    } | null;
}

interface AIResult {
    score: number;
    action?: AIAction;
    summary: string;
    reasoning: string;
    timing?: string;
    risks?: string;
    keyLevels?: {
        support: number | null;
        resistance: number | null;
        idealEntry: number | null;
    };
    positionAdvice?: string;
    catalysts?: string;
    conviction?: 'HIGH' | 'MEDIUM' | 'LOW';
}

const ACTION_CONFIG: Record<AIAction, { label: { en: string; de: string }; bg: string; text: string; border: string; icon: any }> = {
    STRONG_BUY: { label: { en: 'STRONG BUY', de: 'STARKER KAUF' }, bg: 'bg-green-500/25', text: 'text-green-300', border: 'border-green-400/40', icon: Zap },
    BUY: { label: { en: 'BUY', de: 'KAUFEN' }, bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: TrendingUp },
    HOLD: { label: { en: 'HOLD', de: 'HALTEN' }, bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: Shield },
    SCALE_IN: { label: { en: 'SCALE IN', de: 'AUFSTOCKEN' }, bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: TrendingUp },
    TRIM: { label: { en: 'TRIM', de: 'TEILVERKAUF' }, bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: Target },
    SELL: { label: { en: 'SELL', de: 'VERKAUFEN' }, bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: TrendingDown },
    WAIT: { label: { en: 'WAIT', de: 'WARTEN' }, bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30', icon: Shield },
};

export default function DeepAnalysisCard({ symbol, lang = 'en', result, loading, onAnalyze, hasNews, activePosition }: DeepAnalysisCardProps) {
    const t = {
        title: lang === 'de' ? 'KI Trade-Analyse' : 'AI Trade Analysis',
        button: lang === 'de' ? 'Analyse starten' : 'Run Analysis',
        buttonPos: lang === 'de' ? 'Position analysieren' : 'Analyze Position',
        analyzing: lang === 'de' ? 'Analysiere Artikel & Technicals...' : 'Analyzing articles & technicals...',
        score: lang === 'de' ? 'Einstiegs-Qualität' : 'Entry Quality',
        scorePos: lang === 'de' ? 'Positions-Qualität' : 'Position Health',
        reasoning: lang === 'de' ? 'Analyse-Faktoren' : 'Analysis Factors',
        summary: lang === 'de' ? 'Einschätzung' : 'Assessment',
        timing: lang === 'de' ? 'Timing' : 'Entry Timing',
        risks: lang === 'de' ? 'Risiken' : 'Risks',
        keyLevels: lang === 'de' ? 'Schlüsselniveaus' : 'Key Levels',
        support: lang === 'de' ? 'Support' : 'Support',
        resistance: lang === 'de' ? 'Widerstand' : 'Resistance',
        idealEntry: lang === 'de' ? 'Idealer Einstieg' : 'Ideal Entry',
        posAdvice: lang === 'de' ? 'Positions-Empfehlung' : 'Position Advice',
        catalysts: lang === 'de' ? 'Nächster Katalysator' : 'Next Catalyst',
        conviction: lang === 'de' ? 'Überzeugung' : 'Conviction',
        power: 'Powered by Anthropic Claude Sonnet',
        noNews: lang === 'de' ? 'Keine News verfügbar für Analyse' : 'No news available for analysis',
        rerun: lang === 'de' ? 'Erneut analysieren' : 'Re-analyze',
        activePos: lang === 'de' ? 'Aktive Position' : 'Active Position',
    };

    const getScoreColor = (s: number) => {
        if (s >= 8) return 'text-green-400';
        if (s >= 6) return 'text-green-500';
        if (s === 5) return 'text-yellow-400';
        if (s >= 3) return 'text-orange-400';
        return 'text-red-500';
    };

    const getConvictionStyle = (c?: string) => {
        if (c === 'HIGH') return 'bg-green-500/20 text-green-400 border-green-500/30';
        if (c === 'MEDIUM') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    };

    const handleAnalyze = () => {
        if (activePosition && onAnalyze) {
            onAnalyze(activePosition);
        } else if (onAnalyze) {
            onAnalyze();
        }
    };

    const actionCfg = result?.action ? ACTION_CONFIG[result.action] || ACTION_CONFIG.WAIT : null;

    const formatReasoning = (text: string) => {
        const lines = text.split(/\n|•|·|—|- /).filter(l => l.trim());
        if (lines.length <= 1) return <p className="text-xs leading-relaxed text-slate-300">{text}</p>;
        return (
            <ul className="space-y-1.5">
                {lines.map((line, i) => (
                    <li key={i} className="text-xs leading-relaxed text-slate-300 flex gap-2">
                        <span className="text-indigo-400 mt-0.5 shrink-0">▸</span>
                        <span>{line.trim()}</span>
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-4 md:p-6 shadow-xl border border-indigo-500/30 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Brain size={120} />
            </div>

            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                    <Sparkles className="text-yellow-400" size={20} />
                    <h3 className="text-lg font-bold tracking-wide">{t.title}</h3>
                </div>
                {result && !loading && onAnalyze && hasNews && (
                    <button
                        onClick={handleAnalyze}
                        className="text-xs font-medium text-indigo-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-indigo-500/30 hover:border-indigo-400/50 hover:bg-white/5"
                    >
                        {t.rerun}
                    </button>
                )}
            </div>

            {/* Active Position Badge */}
            {activePosition && !result && !loading && (
                <div className="mb-4 relative z-10 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5 flex items-center gap-3">
                    <Shield size={16} className="text-blue-400" />
                    <div className="text-xs">
                        <span className="text-blue-300 font-semibold">{t.activePos}:</span>
                        <span className={`ml-2 font-bold ${activePosition.side === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                            {activePosition.side}
                        </span>
                        <span className="text-slate-400 ml-2">@ ${activePosition.entryPrice.toFixed(2)}</span>
                        <span className={`ml-2 font-bold ${activePosition.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {activePosition.pnlPercent >= 0 ? '+' : ''}{activePosition.pnlPercent.toFixed(2)}%
                        </span>
                    </div>
                </div>
            )}

            {/* Initial state */}
            {!result && !loading && (
                <div className="text-center py-8 relative z-10">
                    {hasNews ? (
                        <button
                            onClick={handleAnalyze}
                            className="group inline-flex items-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/50 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Play size={18} className="group-hover:scale-110 transition-transform" />
                            {activePosition ? t.buttonPos : t.button}
                        </button>
                    ) : (
                        <p className="text-indigo-300/60 text-sm">{t.noNews}</p>
                    )}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="text-center py-10 relative z-10 animate-pulse">
                    <Loader2 className="animate-spin mx-auto mb-3 text-indigo-300" size={32} />
                    <p className="text-indigo-200 font-medium">{t.analyzing}</p>
                </div>
            )}

            {/* Result */}
            {result && !loading && (
                <div className="relative z-10 space-y-3">
                    {/* Score + Action + Conviction */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-end gap-2">
                            <span className={`text-5xl font-black ${getScoreColor(result.score)} drop-shadow-lg`}>
                                {result.score}<span className="text-2xl text-indigo-300/50">/10</span>
                            </span>
                            <span className="text-indigo-200 font-medium mb-1.5 text-sm">
                                {activePosition ? t.scorePos : t.score}
                            </span>
                        </div>
                        {actionCfg && result.action && (
                            <span className={`px-4 py-1.5 rounded-full text-sm font-black tracking-wide flex items-center gap-1.5 ${actionCfg.bg} ${actionCfg.text} border ${actionCfg.border}`}>
                                <actionCfg.icon size={14} />
                                {actionCfg.label[lang]}
                            </span>
                        )}
                        {result.conviction && (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getConvictionStyle(result.conviction)}`}>
                                {t.conviction}: {result.conviction}
                            </span>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                        <h4 className="text-xs font-bold text-indigo-300 uppercase mb-2">{t.summary}</h4>
                        <p className="text-sm leading-relaxed text-slate-100">{result.summary}</p>
                    </div>

                    {/* Position Advice (only when invested) */}
                    {result.positionAdvice && (
                        <div className="bg-blue-500/10 backdrop-blur-md rounded-xl p-4 border border-blue-500/20">
                            <h4 className="text-xs font-bold text-blue-400 uppercase mb-2 flex items-center gap-1.5">
                                <Shield size={12} /> {t.posAdvice}
                            </h4>
                            <p className="text-sm leading-relaxed text-slate-100">{result.positionAdvice}</p>
                        </div>
                    )}

                    {/* Key Levels */}
                    {result.keyLevels && (result.keyLevels.support || result.keyLevels.resistance || result.keyLevels.idealEntry) && (
                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/5">
                            <h4 className="text-xs font-bold text-indigo-300 uppercase mb-3 flex items-center gap-1.5">
                                <Target size={12} /> {t.keyLevels}
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                                {result.keyLevels.support != null && (
                                    <div className="text-center">
                                        <p className="text-[10px] text-slate-400 uppercase">{t.support}</p>
                                        <p className="text-sm font-bold text-green-400">${result.keyLevels.support.toFixed(2)}</p>
                                    </div>
                                )}
                                {result.keyLevels.resistance != null && (
                                    <div className="text-center">
                                        <p className="text-[10px] text-slate-400 uppercase">{t.resistance}</p>
                                        <p className="text-sm font-bold text-red-400">${result.keyLevels.resistance.toFixed(2)}</p>
                                    </div>
                                )}
                                {result.keyLevels.idealEntry != null && (
                                    <div className="text-center">
                                        <p className="text-[10px] text-slate-400 uppercase">{t.idealEntry}</p>
                                        <p className="text-sm font-bold text-yellow-400">${result.keyLevels.idealEntry.toFixed(2)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Timing */}
                    {result.timing && (
                        <div className="bg-emerald-500/10 backdrop-blur-md rounded-xl p-4 border border-emerald-500/20">
                            <h4 className="text-xs font-bold text-emerald-400 uppercase mb-2">{t.timing}</h4>
                            <p className="text-sm leading-relaxed text-slate-100">{result.timing}</p>
                        </div>
                    )}

                    {/* Catalysts */}
                    {result.catalysts && (
                        <div className="bg-purple-500/10 backdrop-blur-md rounded-xl p-4 border border-purple-500/20">
                            <h4 className="text-xs font-bold text-purple-400 uppercase mb-2 flex items-center gap-1.5">
                                <Zap size={12} /> {t.catalysts}
                            </h4>
                            <p className="text-sm leading-relaxed text-slate-100">{result.catalysts}</p>
                        </div>
                    )}

                    {/* Risks */}
                    {result.risks && (
                        <div className="bg-red-500/10 backdrop-blur-md rounded-xl p-4 border border-red-500/20">
                            <h4 className="text-xs font-bold text-red-400 uppercase mb-2 flex items-center gap-1.5">
                                <AlertTriangle size={12} /> {t.risks}
                            </h4>
                            <p className="text-sm leading-relaxed text-slate-200">{result.risks}</p>
                        </div>
                    )}

                    {/* Reasoning */}
                    <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/5">
                        <h4 className="text-xs font-bold text-indigo-300 uppercase mb-2">{t.reasoning}</h4>
                        {formatReasoning(result.reasoning)}
                    </div>
                </div>
            )}

            <div className="mt-6 text-center">
                <p className="text-[10px] text-indigo-400/50 uppercase tracking-widest">{t.power}</p>
            </div>
        </div>
    );
}
