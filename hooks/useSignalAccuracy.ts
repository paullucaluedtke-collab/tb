'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { TradeRecommendation } from '@/lib/analysis';

interface SignalRecord {
    symbol: string;
    action: 'LONG' | 'SHORT' | 'WAIT';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    entryPrice: number;
    startedAt: number; // timestamp ms
    closedAt?: number;
    closePrice?: number;
    pnlPct?: number; // evaluated on close
}

const STORAGE_KEY = 'sb_signal_records';
const MAX_RECORDS = 500;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Tracks each signal change as a record with entry price. When a signal flips to a new
 * action, the previous record is closed at the current price and its P&L evaluated.
 * WAIT signals are not scored (neutral). Returns rolling 30-day accuracy stats.
 */
export function useSignalAccuracy(
    summaries: Record<string, { price: number; recommendation: TradeRecommendation }>
) {
    const [records, setRecords] = useState<SignalRecord[]>([]);
    const initialized = useRef(false);

    // Load from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setRecords(JSON.parse(saved));
        } catch { }
    }, []);

    // Track signal changes
    useEffect(() => {
        if (Object.keys(summaries).length === 0) return;

        // Seed on first run — don't score the historical baseline
        if (!initialized.current) {
            initialized.current = true;
            setRecords(prev => {
                const openSymbols = new Set(prev.filter(r => !r.closedAt).map(r => r.symbol));
                const seeded: SignalRecord[] = [...prev];
                Object.entries(summaries).forEach(([sym, s]) => {
                    const action = s.recommendation?.action;
                    if (!action || action === 'WAIT') return;
                    if (openSymbols.has(sym)) return;
                    if (typeof s.price !== 'number') return;
                    seeded.push({
                        symbol: sym,
                        action,
                        confidence: s.recommendation.confidence,
                        entryPrice: s.price,
                        startedAt: Date.now(),
                    });
                });
                // Don't persist yet — wait for real changes
                return seeded;
            });
            return;
        }

        setRecords(prev => {
            let changed = false;
            const next = [...prev];
            const openByS: Record<string, number> = {};
            next.forEach((r, i) => { if (!r.closedAt) openByS[r.symbol] = i; });

            Object.entries(summaries).forEach(([sym, s]) => {
                const action = s.recommendation?.action;
                if (!action) return;
                const price = s.price;
                if (typeof price !== 'number') return;

                const openIdx = openByS[sym];
                const openRec = openIdx !== undefined ? next[openIdx] : undefined;

                // Signal changed: close previous, open new
                if (openRec && openRec.action !== action) {
                    // Score the closed record
                    let pnlPct = 0;
                    if (openRec.action === 'LONG') {
                        pnlPct = ((price - openRec.entryPrice) / openRec.entryPrice) * 100;
                    } else if (openRec.action === 'SHORT') {
                        pnlPct = ((openRec.entryPrice - price) / openRec.entryPrice) * 100;
                    }
                    next[openIdx] = {
                        ...openRec,
                        closedAt: Date.now(),
                        closePrice: price,
                        pnlPct,
                    };
                    changed = true;

                    // Open new record if not WAIT
                    if (action !== 'WAIT') {
                        next.push({
                            symbol: sym,
                            action,
                            confidence: s.recommendation.confidence,
                            entryPrice: price,
                            startedAt: Date.now(),
                        });
                    }
                } else if (!openRec && action !== 'WAIT') {
                    // No open record yet — start tracking this signal
                    next.push({
                        symbol: sym,
                        action,
                        confidence: s.recommendation.confidence,
                        entryPrice: price,
                        startedAt: Date.now(),
                    });
                    changed = true;
                }
            });

            if (!changed) return prev;

            // Trim oldest
            const trimmed = next.slice(-MAX_RECORDS);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { }
            return trimmed;
        });
    }, [summaries]);

    // Compute stats for the 30-day rolling window
    const stats = useMemo(() => {
        const cutoff = Date.now() - WINDOW_MS;
        const closed = records.filter(r => r.closedAt && r.startedAt >= cutoff && typeof r.pnlPct === 'number');

        const longs = closed.filter(r => r.action === 'LONG');
        const shorts = closed.filter(r => r.action === 'SHORT');

        const winsL = longs.filter(r => (r.pnlPct ?? 0) > 0).length;
        const winsS = shorts.filter(r => (r.pnlPct ?? 0) > 0).length;
        const wins = winsL + winsS;

        const avgPnl = closed.length > 0
            ? closed.reduce((a, r) => a + (r.pnlPct ?? 0), 0) / closed.length
            : 0;

        return {
            totalClosed: closed.length,
            wins,
            losses: closed.length - wins,
            winRate: closed.length > 0 ? (wins / closed.length) * 100 : null,
            longCount: longs.length,
            longWinRate: longs.length > 0 ? (winsL / longs.length) * 100 : null,
            shortCount: shorts.length,
            shortWinRate: shorts.length > 0 ? (winsS / shorts.length) * 100 : null,
            avgPnl,
        };
    }, [records]);

    const reset = () => {
        setRecords([]);
        try { localStorage.removeItem(STORAGE_KEY); } catch { }
        initialized.current = false;
    };

    return { stats, records, reset };
}
