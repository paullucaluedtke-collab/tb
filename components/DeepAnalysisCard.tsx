'use client';

import { Brain, Sparkles, Loader2, Play } from 'lucide-react';

interface DeepAnalysisCardProps {
    symbol: string;
    lang: 'en' | 'de';
    result?: AIResult | null;
    loading?: boolean;
    onAnalyze?: () => void;
    hasNews?: boolean;
}

interface AIResult {
    score: number;
    summary: string;
    reasoning: string;
}

export default function DeepAnalysisCard({ symbol, lang = 'en', result, loading, onAnalyze, hasNews }: DeepAnalysisCardProps) {
    const t = {
        title: lang === 'de' ? 'KI Tiefen-Analyse' : 'AI Deep Analysis',
        button: lang === 'de' ? 'Analyse starten' : 'Run Analysis',
        analyzing: lang === 'de' ? 'Lese Artikel...' : 'Reading articles...',
        score: lang === 'de' ? 'KI Score' : 'AI Score',
        reasoning: lang === 'de' ? 'Begründung' : 'Reasoning',
        summary: lang === 'de' ? 'Zusammenfassung' : 'Summary',
        power: lang === 'de' ? 'Powered by Anthropic Claude Sonnet' : 'Powered by Anthropic Claude Sonnet',
        noNews: lang === 'de' ? 'Keine News verfügbar für Analyse' : 'No news available for analysis',
        rerun: lang === 'de' ? 'Erneut analysieren' : 'Re-analyze',
    };

    const getScoreColor = (s: number) => {
        if (s >= 8) return 'text-green-600';
        if (s >= 6) return 'text-green-500';
        if (s <= 3) return 'text-red-600';
        if (s <= 5) return 'text-red-500';
        return 'text-yellow-500';
    };

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-4 md:p-6 shadow-xl border border-indigo-500/30 text-white relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Brain size={120} />
            </div>

            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                    <Sparkles className="text-yellow-400" size={20} />
                    <h3 className="text-lg font-bold tracking-wide">{t.title}</h3>
                </div>
                {/* Re-analyze button when result already exists */}
                {result && !loading && onAnalyze && hasNews && (
                    <button
                        onClick={onAnalyze}
                        className="text-xs font-medium text-indigo-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-indigo-500/30 hover:border-indigo-400/50 hover:bg-white/5"
                    >
                        {t.rerun}
                    </button>
                )}
            </div>

            {/* Initial state: Show analyze button */}
            {!result && !loading && (
                <div className="text-center py-8 relative z-10">
                    {hasNews ? (
                        <button
                            onClick={onAnalyze}
                            className="group inline-flex items-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/50 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Play size={18} className="group-hover:scale-110 transition-transform" />
                            {t.button}
                        </button>
                    ) : (
                        <p className="text-indigo-300/60 text-sm">{t.noNews}</p>
                    )}
                </div>
            )}

            {/* Loading state */}
            {loading && (
                <div className="text-center py-10 relative z-10 animate-pulse">
                    <Loader2 className="animate-spin mx-auto mb-3 text-indigo-300" size={32} />
                    <p className="text-indigo-200 font-medium">{t.analyzing}</p>
                </div>
            )}

            {/* Result state */}
            {result && !loading && (
                <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-end gap-3 mb-4">
                        <span className={`text-5xl font-black ${getScoreColor(result.score)} drop-shadow-lg`}>
                            {result.score}<span className="text-2xl text-indigo-300/50">/10</span>
                        </span>
                        <span className="text-indigo-200 font-medium mb-1.5">{t.score}</span>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 mb-4 border border-white/10">
                        <h4 className="text-xs font-bold text-indigo-300 uppercase mb-2">{t.summary}</h4>
                        <p className="text-sm leading-relaxed text-slate-100">{result.summary}</p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/5">
                        <h4 className="text-xs font-bold text-indigo-300 uppercase mb-2">{t.reasoning}</h4>
                        <div className="text-xs leading-relaxed text-slate-300 space-y-1">
                            {result.reasoning}
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-6 text-center">
                <p className="text-[10px] text-indigo-400/50 uppercase tracking-widest">{t.power}</p>
            </div>
        </div>
    );
}
