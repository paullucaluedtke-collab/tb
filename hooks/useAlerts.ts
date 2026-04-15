'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TradeRecommendation } from '@/lib/analysis';

export interface AlertEvent {
    id: string;
    symbol: string;
    from: string;
    to: string;
    confidence: string;
    reason: string;
    timestamp: Date;
}

const STORAGE_KEY = 'sb_followed';
const ALERTS_KEY = 'sb_alert_history';

export function useAlerts(
    summaries: Record<string, { recommendation: TradeRecommendation }>
) {
    const [followedSymbols, setFollowedSymbols] = useState<string[]>([]);
    const [toasts, setToasts] = useState<AlertEvent[]>([]);
    const [alertHistory, setAlertHistory] = useState<AlertEvent[]>([]);
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

    // Store previous actions to detect changes; skip the very first run
    const prevActions = useRef<Record<string, string>>({});
    const initialized = useRef(false);

    // Load persisted state on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setFollowedSymbols(JSON.parse(saved));
            const hist = localStorage.getItem(ALERTS_KEY);
            if (hist) {
                const parsed = JSON.parse(hist).map((a: any) => ({ ...a, timestamp: new Date(a.timestamp) }));
                setAlertHistory(parsed);
            }
        } catch { }
        if ('Notification' in window) setNotifPermission(Notification.permission);
    }, []);

    const requestPermission = useCallback(async () => {
        if (!('Notification' in window)) return;
        const p = await Notification.requestPermission();
        setNotifPermission(p);
    }, []);

    const toggleFollow = useCallback((symbol: string) => {
        setFollowedSymbols(prev => {
            const next = prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const isFollowed = useCallback((symbol: string) => followedSymbols.includes(symbol), [followedSymbols]);

    // Detect signal changes for followed symbols
    useEffect(() => {
        if (Object.keys(summaries).length === 0) return;

        if (!initialized.current) {
            // Seed baseline — no alerts on first load
            followedSymbols.forEach(sym => {
                const action = summaries[sym]?.recommendation?.action;
                if (action) prevActions.current[sym] = action;
            });
            initialized.current = true;
            return;
        }

        followedSymbols.forEach(sym => {
            const rec = summaries[sym]?.recommendation;
            if (!rec) return;
            const prev = prevActions.current[sym];
            if (prev && prev !== rec.action) {
                const event: AlertEvent = {
                    id: `${sym}-${Date.now()}`,
                    symbol: sym,
                    from: prev,
                    to: rec.action,
                    confidence: rec.confidence,
                    reason: rec.reason || '',
                    timestamp: new Date(),
                };

                // In-app toast
                setToasts(t => [event, ...t].slice(0, 5));

                // Persist to alert history (last 50)
                setAlertHistory(h => {
                    const next = [event, ...h].slice(0, 50);
                    try { localStorage.setItem(ALERTS_KEY, JSON.stringify(next)); } catch { }
                    return next;
                });

                // Browser push notification
                if (notifPermission === 'granted') {
                    try {
                        new Notification(`${sym}: Signal Changed`, {
                            body: `${prev} → ${rec.action} · ${rec.confidence} confidence`,
                            icon: '/favicon.ico',
                            tag: sym, // deduplicates per symbol
                        });
                    } catch { }
                }
            }
            prevActions.current[sym] = rec.action;
        });
    }, [summaries, followedSymbols, notifPermission]);

    // Update baseline when new symbols are followed
    useEffect(() => {
        if (!initialized.current) return;
        followedSymbols.forEach(sym => {
            if (!(sym in prevActions.current)) {
                const action = summaries[sym]?.recommendation?.action;
                if (action) prevActions.current[sym] = action;
            }
        });
    }, [followedSymbols, summaries]);

    const dismissToast = useCallback((id: string) => {
        setToasts(t => t.filter(a => a.id !== id));
    }, []);

    const clearHistory = useCallback(() => {
        setAlertHistory([]);
        try { localStorage.removeItem(ALERTS_KEY); } catch { }
    }, []);

    return {
        followedSymbols,
        isFollowed,
        toggleFollow,
        toasts,
        dismissToast,
        alertHistory,
        clearHistory,
        notifPermission,
        requestPermission,
    };
}
