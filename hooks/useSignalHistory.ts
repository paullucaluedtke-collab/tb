'use client';

import { useState, useEffect } from 'react';
import { TradeRecommendation } from '@/lib/analysis';

interface SignalHistoryEntry {
    action: string;
    since: number; // timestamp ms
}

const STORAGE_KEY = 'sb_signal_history';

export function useSignalHistory(
    summaries: Record<string, { recommendation: TradeRecommendation }>
) {
    const [history, setHistory] = useState<Record<string, SignalHistoryEntry>>({});

    // Load persisted history
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setHistory(JSON.parse(saved));
        } catch { }
    }, []);

    // Update whenever an action changes
    useEffect(() => {
        if (Object.keys(summaries).length === 0) return;
        setHistory(prev => {
            let changed = false;
            const next = { ...prev };
            Object.entries(summaries).forEach(([sym, sum]) => {
                const action = sum?.recommendation?.action;
                if (!action) return;
                if (!next[sym] || next[sym].action !== action) {
                    next[sym] = { action, since: Date.now() };
                    changed = true;
                }
            });
            if (changed) {
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { }
                return next;
            }
            return prev;
        });
    }, [summaries]);

    const getDuration = (symbol: string): { action: string; label: string } | null => {
        const entry = history[symbol];
        if (!entry) return null;
        const ms = Date.now() - entry.since;
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        let label: string;
        if (minutes < 2) label = 'just now';
        else if (hours < 1) label = `${minutes}m`;
        else if (days < 1) label = `${hours}h`;
        else label = `${days}d`;

        return { action: entry.action, label };
    };

    return { getDuration };
}
