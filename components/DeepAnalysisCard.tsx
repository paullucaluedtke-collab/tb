'use client';

import { useState } from 'react';
import { Brain, Sparkles, Loader2, AlertCircle } from 'lucide-react';

interface DeepAnalysisCardProps {
    symbol: string;
    newsItems: any[];
    lang: 'en' | 'de';
}

interface AIResult {
    score: number;
    summary: string;
    reasoning: string;
}

export default function DeepAnalysisCard({ symbol, newsItems, lang = 'en' }: DeepAnalysisCardProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AIResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/ai-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    newsItems: newsItems.map(n => ({ title: n.title, link: n.link, description: n.publisher }))
                })
            });

            if (!res.ok) throw new Error('Analysis failed');

            const data = await res.json();
            setResult(data);
        } catch (e) {
            setError(lang === 'de' ? 'Analyse fehlgeschlagen.' : 'Analysis failed.');
        } finally {
            setLoading(false);
        }
    };

    const t = {
        title: lang === 'de' ? 'KI Tiefen-Analyse' : 'AI Deep Analysis',
        button: lang === 'de' ? 'Analysieren mit Claude 3' : 'Analyze with Claude 3',
        analyzing: lang === 'de' ? 'Lese Artikel...' : 'Reading articles...',
        score: lang === 'de' ? 'KI Score' : 'AI Score',
        reasoning: lang === 'de' ? 'Begründung' : 'Reasoning',
        summary: lang === 'de' ? 'Zusammenfassung' : 'Summary',
        power: lang === 'de' ? 'Powered by Anthropic Claude 3 Haiku' : 'Powered by Anthropic Claude 3 Haiku',
    };

    // Determine color based on 1-10 score
    const getScoreColor = (s: number) => {
        if (s >= 8) return 'text-green-600';
        if (s >= 6) return 'text-green-500';
        if (s <= 3) return 'text-red-600';
        if (s <= 5) return 'text-red-500';
        return 'text-yellow-500';
    };

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 shadow-xl border border-indigo-500/30 text-white relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Brain size={120} />
            </div>

            <div className="flex items-center gap-2 mb-4 relative z-10">
                <Sparkles className="text-yellow-400" size={20} />
                <h3 className="text-lg font-bold tracking-wide">{t.title}</h3>
            </div>

            {!result && !loading && (
                <div className="text-center py-6 relative z-10">
                    <p className="text-indigo-200 mb-6 text-sm">
                        {lang === 'de'
                            ? 'Lass die KI den Volltext der aktuellen Nachrichten lesen und bewerten.'
                            : 'Let the AI read the full text of recent news and rate this asset.'}
                    </p>
                    <button
                        onClick={handleAnalyze}
                        className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 mx-auto shadow-lg hover:shadow-indigo-500/50"
                    >
                        <Brain size={18} />
                        {t.button}
                    </button>
                    {error && <p className="text-red-400 mt-4 text-sm flex items-center justify-center gap-1"><AlertCircle size={14} /> {error}</p>}
                </div>
            )}

            {loading && (
                <div className="text-center py-10 relative z-10 animate-pulse">
                    <Loader2 className="animate-spin mx-auto mb-3 text-indigo-300" size={32} />
                    <p className="text-indigo-200 font-medium">{t.analyzing}</p>
                </div>
            )}

            {result && (
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
