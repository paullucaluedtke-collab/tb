'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { TradeRecommendation } from '@/lib/analysis';

export interface SignalRecord {
    symbol: string;
    action: 'LONG' | 'SHORT' | 'WAIT';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    startedAt: number; // timestamp ms
    closedAt?: number;
    closePrice?: number;
    closeReason?: 'TP_HIT' | 'SL_HIT' | 'SIGNAL_FLIP' | 'EXPIRED';
    pnlPct?: number;
}

const STORAGE_KEY = 'sb_signal_records';
const MAX_RECORDS = 500;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const EXPIRY_MS = 14 * 24 * 60 * 60 * 1000; // auto-expire open signals after 14 days

/**
 * Enhanced signal accuracy tracker:
 * - Stores TP/SL from signal recommendations
 * - Auto-closes signals when price hits TP or SL
 * - Auto-expires signals older than 14 days
 * - Closes on signal flip (previous behavior)
 * - Rolling 30-day stats with per-confidence breakdown
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

    // TP/SL price monitoring — runs on every summaries update
    useEffect(() => {
        if (Object.keys(summaries).length === 0) return;

        setRecords(prev => {
            let changed = false;
            const next = prev.map(r => {
                if (r.closedAt) return r;
                const s = summaries[r.symbol];
                if (!s || typeof s.price !== 'number') return r;
                const price = s.price;
                const now = Date.now();

                // Auto-expire after 14 days
                if (now - r.startedAt > EXPIRY_MS) {
                    changed = true;
                    const pnlPct = r.action === 'LONG'
                        ? ((price - r.entryPrice) / r.entryPrice) * 100
                        : ((r.entryPrice - price) / r.entryPrice) * 100;
                    return { ...r, closedAt: now, closePrice: price, closeReason: 'EXPIRED' as const, pnlPct };
                }

                // Check Take Profit hit
                if (r.takeProfit) {
                    const tpHit = r.action === 'LONG' ? price >= r.takeProfit : price <= r.takeProfit;
                    if (tpHit) {
                        changed = true;
                        const pnlPct = r.action === 'LONG'
                            ? ((r.takeProfit - r.entryPrice) / r.entryPrice) * 100
                            : ((r.entryPrice - r.takeProfit) / r.entryPrice) * 100;
                        return { ...r, closedAt: now, closePrice: r.takeProfit, closeReason: 'TP_HIT' as const, pnlPct };
                    }
                }

                // Check Stop Loss hit
                if (r.stopLoss) {
                    const slHit = r.action === 'LONG' ? price <= r.stopLoss : price >= r.stopLoss;
                    if (slHit) {
                        changed = true;
                        const pnlPct = r.action === 'LONG'
                            ? ((r.stopLoss - r.entryPrice) / r.entryPrice) * 100
                            : ((r.entryPrice - r.stopLoss) / r.entryPrice) * 100;
                        return { ...r, closedAt: now, closePrice: r.stopLoss, closeReason: 'SL_HIT' as const, pnlPct };
                    }
                }

                return r;
            });

            if (!changed) return prev;
            const trimmed = next.slice(-MAX_RECORDS);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { }
            return trimmed;
        });
    }, [summaries]);

    // Track signal changes (opens + signal-flip closes)
    useEffect(() => {
        if (Object.keys(summaries).length === 0) return;

        // Seed on first run
        if (!initialized.current) {
            initialized.current = true;
            setRecords(prev => {
                const openSymbols = new Set(prev.filter(r => !r.closedAt).map(r => r.symbol));
                const seeded: SignalRecord[] = [...prev];
                Object.entries(summaries).forEach(([sym, s]) => {
                    const rec = s.recommendation;
                    if (!rec || rec.action === 'WAIT') return;
                    if (openSymbols.has(sym)) return;
                    if (typeof s.price !== 'number') return;
                    seeded.push({
                        symbol: sym,
                        action: rec.action,
                        confidence: rec.confidence,
                        entryPrice: s.price,
                        stopLoss: rec.stopLoss,
                        takeProfit: rec.takeProfit,
                        startedAt: Date.now(),
                    });
                });
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
                const rec = s.recommendation;
                if (!rec) return;
                const action = rec.action;
                const price = s.price;
                if (typeof price !== 'number') return;

                const openIdx = openByS[sym];
                const openRec = openIdx !== undefined ? next[openIdx] : undefined;

                // Signal changed: close previous via SIGNAL_FLIP, open new
                if (openRec && openRec.action !== action) {
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
                        closeReason: 'SIGNAL_FLIP',
                        pnlPct,
                    };
                    changed = true;

                    if (action !== 'WAIT') {
                        next.push({
                            symbol: sym,
                            action,
                            confidence: rec.confidence,
                            entryPrice: price,
                            stopLoss: rec.stopLoss,
                            takeProfit: rec.takeProfit,
                            startedAt: Date.now(),
                        });
                    }
                } else if (!openRec && action !== 'WAIT') {
                    next.push({
                        symbol: sym,
                        action,
                        confidence: rec.confidence,
                        entryPrice: price,
                        stopLoss: rec.stopLoss,
                        takeProfit: rec.takeProfit,
                        startedAt: Date.now(),
                    });
                    changed = true;
                }
            });

            if (!changed) return prev;
            const trimmed = next.slice(-MAX_RECORDS);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { }
            return trimmed;
        });
    }, [summaries]);

    // Compute stats for the 30-day rolling window
    const stats = useMemo(() => {
        const cutoff = Date.now() - WINDOW_MS;
        const closed = records.filter(r => r.closedAt && r.startedAt >= cutoff && typeof r.pnlPct === 'number');
        const open = records.filter(r => !r.closedAt);

        const longs = closed.filter(r => r.action === 'LONG');
        const shorts = closed.filter(r => r.action === 'SHORT');

        const winsL = longs.filter(r => (r.pnlPct ?? 0) > 0).length;
        const winsS = shorts.filter(r => (r.pnlPct ?? 0) > 0).length;
        const wins = winsL + winsS;

        const avgPnl = closed.length > 0
            ? closed.reduce((a, r) => a + (r.pnlPct ?? 0), 0) / closed.length
            : 0;

        const tpHits = closed.filter(r => r.closeReason === 'TP_HIT').length;
        const slHits = closed.filter(r => r.closeReason === 'SL_HIT').length;
        const flips = closed.filter(r => r.closeReason === 'SIGNAL_FLIP').length;
        const expired = closed.filter(r => r.closeReason === 'EXPIRED').length;

        // Per-confidence breakdown
        const byConf = (['HIGH', 'MEDIUM', 'LOW'] as const).map(c => {
            const subset = closed.filter(r => r.confidence === c);
            const w = subset.filter(r => (r.pnlPct ?? 0) > 0).length;
            return {
                confidence: c,
                total: subset.length,
                wins: w,
                winRate: subset.length > 0 ? (w / subset.length) * 100 : null,
                avgPnl: subset.length > 0 ? subset.reduce((a, r) => a + (r.pnlPct ?? 0), 0) / subset.length : 0,
            };
        });

        // Best and worst trade
        const best = closed.length > 0 ? closed.reduce((a, b) => ((a.pnlPct ?? 0) > (b.pnlPct ?? 0) ? a : b)) : null;
        const worst = closed.length > 0 ? closed.reduce((a, b) => ((a.pnlPct ?? 0) < (b.pnlPct ?? 0) ? a : b)) : null;

        return {
            totalClosed: closed.length,
            openCount: open.length,
            wins,
            losses: closed.length - wins,
            winRate: closed.length > 0 ? (wins / closed.length) * 100 : null,
            longCount: longs.length,
            longWinRate: longs.length > 0 ? (winsL / longs.length) * 100 : null,
            shortCount: shorts.length,
            shortWinRate: shorts.length > 0 ? (winsS / shorts.length) * 100 : null,
            avgPnl,
            tpHits,
            slHits,
            flips,
            expired,
            byConfidence: byConf,
            bestTrade: best,
            worstTrade: worst,
        };
    }, [records]);

    // Recent trade log (last 20 closed)
    const recentTrades = useMemo(() => {
        return records
            .filter(r => r.closedAt)
            .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
            .slice(0, 20);
    }, [records]);

    const reset = () => {
        setRecords([]);
        try { localStorage.removeItem(STORAGE_KEY); } catch { }
        initialized.current = false;
    };

    return { stats, records, recentTrades, reset };
}
