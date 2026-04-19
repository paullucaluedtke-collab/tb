'use client';

import { useState, useEffect, useCallback } from 'react';
import { Globe, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { GeoNewsItem } from '@/app/api/geo-news/route';
import { formatDistanceToNow } from 'date-fns';

interface Props {
    lang: 'en' | 'de';
}

const TAG_COLORS: Record<string, string> = {
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    red:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    sky:    'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    amber:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
};

export default function GeoRiskPanel({ lang }: Props) {
    const [news, setNews] = useState<GeoNewsItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
    const [open, setOpen] = useState(true);

    const fetchNews = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/geo-news');
            if (!res.ok) return;
            const json = await res.json();
            if (Array.isArray(json.news)) setNews(json.news);
            if (json.fetchedAt) setFetchedAt(new Date(json.fetchedAt));
        } catch (_) {
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews();
        const id = setInterval(fetchNews, 10 * 60 * 1000);
        return () => clearInterval(id);
    }, [fetchNews]);

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Globe size={15} className="text-indigo-500 flex-shrink-0" />
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {lang === 'de' ? 'Globale Makro & Geopolitik' : 'Global Macro & Geopolitics'}
                    </span>
                    {news.length > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            {news.length} {lang === 'de' ? 'Meldungen' : 'items'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {fetchedAt && (
                        <span className="text-[10px] text-gray-400 hidden sm:inline">
                            {formatDistanceToNow(fetchedAt, { addSuffix: true })}
                        </span>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); fetchNews(); }}
                        className="p-1 text-gray-400 hover:text-indigo-500 transition-colors"
                        title={lang === 'de' ? 'Aktualisieren' : 'Refresh'}
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
            </button>

            {/* News list */}
            {open && (
                <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {loading && news.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-gray-400 animate-pulse">
                            {lang === 'de' ? 'Lade Nachrichten...' : 'Loading news...'}
                        </div>
                    ) : news.length === 0 ? (
                        <div className="px-4 py-4 text-sm text-gray-400">
                            {lang === 'de' ? 'Keine Meldungen gefunden.' : 'No news found.'}
                        </div>
                    ) : (
                        news.map(item => (
                            <a
                                key={item.uuid}
                                href={item.link || '#'}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2">
                                        {item.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        <span className="text-[11px] text-gray-400">{item.publisher}</span>
                                        {item.providerPublishTime && (
                                            <span className="text-[11px] text-gray-400">
                                                · {formatDistanceToNow(new Date(item.providerPublishTime), { addSuffix: true })}
                                            </span>
                                        )}
                                        {item.impact && item.impact.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${TAG_COLORS[item.impact!.color] ?? TAG_COLORS.indigo}`}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <ExternalLink size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-400 flex-shrink-0 mt-0.5" />
                            </a>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
