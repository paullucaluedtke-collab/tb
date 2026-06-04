'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { TradeRecommendation } from '@/lib/analysis';

export interface SignalRecord {
    symbol: string;
    action: 'LONG' | 'SHORT';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    startedAt: number;
    closedAt?: number;
    closePrice?: number;
    closeReason?: 'TP_HIT' | 'SL_HIT' | 'SIGNAL_FLIP' | 'EXPIRED';
    pnlPct?: number;
}

const STORAGE_KEY = 'sb_signal_records';
const MAX_RECORDS = 500;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

function safePnl(entry: number, exit: number, action: 'LONG' | 'SHORT'): number {
    if (!entry || entry <= 0) return 0;
    return action === 'LONG'
        ? ((exit - entry) / entry) * 100
        : ((entry - exit) / entry) * 100;
}

function persistRecords(records: SignalRecord[]) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch { }
}

export function useSignalAccuracy(
    summaries: Record<string, { price: number; recommendation: TradeRecommendation }>
) {
    const [records, setRecords] = useState<SignalRecord[]>([]);
    const initialized = useRef(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setRecords(JSON.parse(saved));
        } catch { }
    }, []);

    // Single unified effect: handles seeding, TP/SL monitoring, signal flips, and expiry
    useEffect(() => {
        if (Object.keys(summaries).length === 0) return;

        setRecords(prev => {
            let changed = false;
            const next = [...prev];

            // Seed on first run
            if (!initialized.current) {
                initialized.current = true;
                const openSymbols = new Set(next.filter(r => !r.closedAt).map(r => r.symbol));
                Object.entries(summaries).forEach(([sym, s]) => {
                    const rec = s.recommendation;
                    if (!rec || rec.action === 'WAIT') return;
                    if (openSymbols.has(sym)) return;
                    if (typeof s.price !== 'number' || s.price <= 0) return;
                    next.push({
                        symbol: sym, action: rec.action, confidence: rec.confidence,
                        entryPrice: s.price, stopLoss: rec.stopLoss, takeProfit: rec.takeProfit,
                        startedAt: Date.now(),
                    });
                });
                persistRecords(next.slice(-MAX_RECORDS));
                return next.slice(-MAX_RECORDS);
            }

            // Build index of open records
            const openBySymbol: Record<string, number> = {};
            next.forEach((r, i) => { if (!r.closedAt) openBySymbol[r.symbol] = i; });
            const now = Date.now();

            // Process each open record: check expiry, TP/SL, and signal flips
            Object.entries(summaries).forEach(([sym, s]) => {
                const price = s.price;
                const rec = s.recommendation;
                if (typeof price !== 'number' || price <= 0) return;

                const openIdx = openBySymbol[sym];
                const openRec = openIdx !== undefined ? next[openIdx] : undefined;

                if (openRec) {
                    // 1. Auto-expire
                    if (now - openRec.startedAt > EXPIRY_MS) {
                        next[openIdx] = { ...openRec, closedAt: now, closePrice: price, closeReason: 'EXPIRED', pnlPct: safePnl(openRec.entryPrice, price, openRec.action) };
                        changed = true;
                        delete openBySymbol[sym];
                        return;
                    }

                    // 2. TP hit
                    if (openRec.takeProfit) {
                        const tpHit = openRec.action === 'LONG' ? price >= openRec.takeProfit : price <= openRec.takeProfit;
                        if (tpHit) {
                            next[openIdx] = { ...openRec, closedAt: now, closePrice: openRec.takeProfit, closeReason: 'TP_HIT', pnlPct: safePnl(openRec.entryPrice, openRec.takeProfit, openRec.action) };
                            changed = true;
                            delete openBySymbol[sym];
                            return;
                        }
                    }

                    // 3. SL hit
                    if (openRec.stopLoss) {
                        const slHit = openRec.action === 'LONG' ? price <= openRec.stopLoss : price >= openRec.stopLoss;
                        if (slHit) {
                            next[openIdx] = { ...openRec, closedAt: now, closePrice: openRec.stopLoss, closeReason: 'SL_HIT', pnlPct: safePnl(openRec.entryPrice, openRec.stopLoss, openRec.action) };
                            changed = true;
                            delete openBySymbol[sym];
                            return;
                        }
                    }

                    // 4. Signal flip
                    if (rec && openRec.action !== rec.action) {
                        next[openIdx] = { ...openRec, closedAt: now, closePrice: price, closeReason: 'SIGNAL_FLIP', pnlPct: safePnl(openRec.entryPrice, price, openRec.action) };
                        changed = true;
                        delete openBySymbol[sym];

                        if (rec.action !== 'WAIT') {
                            next.push({
                                symbol: sym, action: rec.action, confidence: rec.confidence,
                                entryPrice: price, stopLoss: rec.stopLoss, takeProfit: rec.takeProfit,
                                startedAt: now,
                            });
                        }
                        return;
                    }
                } else if (rec && rec.action !== 'WAIT') {
                    // No open record — start tracking
                    next.push({
                        symbol: sym, action: rec.action, confidence: rec.confidence,
                        entryPrice: price, stopLoss: rec.stopLoss, takeProfit: rec.takeProfit,
                        startedAt: now,
                    });
                    changed = true;
                }
            });

            if (!changed) return prev;
            const trimmed = next.slice(-MAX_RECORDS);
            persistRecords(trimmed);
            return trimmed;
        });
    }, [summaries]);

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

        const byConf = (['HIGH', 'MEDIUM', 'LOW'] as const).map(c => {
            const subset = closed.filter(r => r.confidence === c);
            const w = subset.filter(r => (r.pnlPct ?? 0) > 0).length;
            return {
                confidence: c, total: subset.length, wins: w,
                winRate: subset.length > 0 ? (w / subset.length) * 100 : null,
                avgPnl: subset.length > 0 ? subset.reduce((a, r) => a + (r.pnlPct ?? 0), 0) / subset.length : 0,
            };
        });

        const best = closed.length > 0 ? closed.reduce((a, b) => ((a.pnlPct ?? 0) > (b.pnlPct ?? 0) ? a : b)) : null;
        const worst = closed.length > 0 ? closed.reduce((a, b) => ((a.pnlPct ?? 0) < (b.pnlPct ?? 0) ? a : b)) : null;

        return {
            totalClosed: closed.length, openCount: open.length, wins, losses: closed.length - wins,
            winRate: closed.length > 0 ? (wins / closed.length) * 100 : null,
            longCount: longs.length, longWinRate: longs.length > 0 ? (winsL / longs.length) * 100 : null,
            shortCount: shorts.length, shortWinRate: shorts.length > 0 ? (winsS / shorts.length) * 100 : null,
            avgPnl, tpHits, slHits, flips, expired, byConfidence: byConf, bestTrade: best, worstTrade: worst,
        };
    }, [records]);

    const recentTrades = useMemo(() => {
        return records.filter(r => r.closedAt).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)).slice(0, 20);
    }, [records]);

    const reset = () => {
        setRecords([]);
        try { localStorage.removeItem(STORAGE_KEY); } catch { }
        initialized.current = false;
    };

    return { stats, records, recentTrades, reset };
}
