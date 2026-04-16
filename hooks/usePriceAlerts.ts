'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PriceAlert {
    id: string;
    symbol: string;
    direction: 'above' | 'below';
    price: number;
    createdAt: number;
    triggeredAt?: number;
    active: boolean;
}

const STORAGE_KEY = 'sb_price_alerts';

export function usePriceAlerts(
    summaries: Record<string, { price: number }>,
    notifPermission: NotificationPermission
) {
    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
    const [triggered, setTriggered] = useState<PriceAlert[]>([]);
    const lastPrices = useRef<Record<string, number>>({});

    // Load persisted alerts
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setAlerts(JSON.parse(saved));
        } catch { }
    }, []);

    const persist = (next: PriceAlert[]) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { }
    };

    const addAlert = useCallback((symbol: string, direction: 'above' | 'below', price: number) => {
        const alert: PriceAlert = {
            id: `${symbol}-${direction}-${price}-${Date.now()}`,
            symbol,
            direction,
            price,
            createdAt: Date.now(),
            active: true,
        };
        setAlerts(prev => {
            const next = [alert, ...prev];
            persist(next);
            return next;
        });
    }, []);

    const removeAlert = useCallback((id: string) => {
        setAlerts(prev => {
            const next = prev.filter(a => a.id !== id);
            persist(next);
            return next;
        });
    }, []);

    const toggleAlert = useCallback((id: string) => {
        setAlerts(prev => {
            const next = prev.map(a => a.id === id ? { ...a, active: !a.active } : a);
            persist(next);
            return next;
        });
    }, []);

    const clearTriggered = useCallback((id: string) => {
        setTriggered(prev => prev.filter(t => t.id !== id));
    }, []);

    // Watch prices for crossings
    useEffect(() => {
        if (alerts.length === 0) return;
        if (Object.keys(summaries).length === 0) return;

        const fired: PriceAlert[] = [];
        setAlerts(prev => {
            let changed = false;
            const next = prev.map(a => {
                if (!a.active || a.triggeredAt) return a;
                const curr = summaries[a.symbol]?.price;
                if (typeof curr !== 'number' || isNaN(curr)) return a;

                const last = lastPrices.current[a.symbol];
                lastPrices.current[a.symbol] = curr;

                // First price seen — establish baseline, no trigger yet
                if (typeof last !== 'number') return a;

                const crossedAbove = a.direction === 'above' && last < a.price && curr >= a.price;
                const crossedBelow = a.direction === 'below' && last > a.price && curr <= a.price;

                if (crossedAbove || crossedBelow) {
                    const fire = { ...a, triggeredAt: Date.now(), active: false };
                    fired.push(fire);
                    changed = true;

                    // Browser notification
                    if (notifPermission === 'granted' && typeof window !== 'undefined') {
                        try {
                            new Notification(`${a.symbol}: Price Alert`, {
                                body: `Crossed ${a.direction} ${a.price.toFixed(2)} — now ${curr.toFixed(2)}`,
                                icon: '/favicon.ico',
                                tag: `price-${a.symbol}-${a.direction}-${a.price}`,
                            });
                        } catch { }
                    }

                    return fire;
                }
                return a;
            });

            if (changed) {
                persist(next);
                return next;
            }
            return prev;
        });

        if (fired.length > 0) {
            setTriggered(t => [...fired, ...t].slice(0, 10));
        }
    }, [summaries, alerts.length, notifPermission]);

    const alertsForSymbol = useCallback(
        (symbol: string) => alerts.filter(a => a.symbol === symbol),
        [alerts]
    );

    return {
        alerts,
        triggered,
        addAlert,
        removeAlert,
        toggleAlert,
        clearTriggered,
        alertsForSymbol,
    };
}
