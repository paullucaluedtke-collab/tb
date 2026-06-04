'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { AlertEvent } from './useAlerts';
import type { TradeRecommendation } from '@/lib/analysis';

// Watches the technical signal of every *held* symbol and fires an alert when
// the signal turns adverse for a (long) position:
//   - any → SHORT         → "consider closing / hedging your long"
//   - LONG → WAIT         → "momentum lost"
// Holdings have no explicit side in the DB, so we treat them as long (the normal
// case for a retail Trade Republic portfolio).
//
// Reuses the AlertEvent shape + AlertToastContainer so portfolio alerts render
// identically to follow-list alerts; page.tsx merges both toast streams.

export function usePortfolioAlerts(
    heldSymbols: string[],
    summaries: Record<string, { recommendation?: TradeRecommendation }>,
    notifPermission: NotificationPermission,
    lang: 'en' | 'de' = 'en',
) {
    const [toasts, setToasts] = useState<AlertEvent[]>([]);
    const prevActions = useRef<Record<string, string>>({});
    const initialized = useRef(false);

    const dismissToast = useCallback((id: string) => {
        setToasts(t => t.filter(a => a.id !== id));
    }, []);

    useEffect(() => {
        if (heldSymbols.length === 0) return;
        if (Object.keys(summaries).length === 0) return;

        // Seed baseline on first pass — never alert on initial load.
        if (!initialized.current) {
            heldSymbols.forEach(sym => {
                const a = summaries[sym]?.recommendation?.action;
                if (a) prevActions.current[sym] = a;
            });
            initialized.current = true;
            return;
        }

        heldSymbols.forEach(sym => {
            const rec = summaries[sym]?.recommendation;
            if (!rec?.action) return;
            const prev = prevActions.current[sym];
            const next = rec.action;

            if (prev && prev !== next) {
                const adverse = next === 'SHORT' || (prev === 'LONG' && next === 'WAIT');
                if (adverse) {
                    const reason = next === 'SHORT'
                        ? (lang === 'de'
                            ? `Position dreht bärisch — Schließen/Absichern erwägen. ${rec.reason || ''}`
                            : `Signal turned bearish — consider closing/hedging. ${rec.reason || ''}`)
                        : (lang === 'de'
                            ? `Momentum verloren — beobachten. ${rec.reason || ''}`
                            : `Momentum lost — watch closely. ${rec.reason || ''}`);

                    const event: AlertEvent = {
                        id: `pf-${sym}-${Date.now()}`,
                        symbol: sym,
                        from: prev,
                        to: next,
                        confidence: rec.confidence || 'LOW',
                        reason: reason.trim(),
                        timestamp: new Date(),
                    };
                    setToasts(t => [event, ...t].slice(0, 5));

                    if (notifPermission === 'granted' && typeof window !== 'undefined') {
                        try {
                            new Notification(
                                lang === 'de' ? `${sym}: Portfolio-Warnung` : `${sym}: Portfolio alert`,
                                {
                                    body: `${prev} → ${next} · ${rec.confidence || ''}`,
                                    icon: '/favicon.ico',
                                    tag: `portfolio-${sym}`,
                                },
                            );
                        } catch { }
                    }
                }
            }
            prevActions.current[sym] = next;
        });
    }, [heldSymbols, summaries, notifPermission, lang]);

    // Clean up unheld symbols so a re-buy can alert again.
    useEffect(() => {
        const set = new Set(heldSymbols);
        for (const sym of Object.keys(prevActions.current)) {
            if (!set.has(sym)) delete prevActions.current[sym];
        }
    }, [heldSymbols]);

    return { toasts, dismissToast };
}
