'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

export interface PaperTrade {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    quantity: number;
    openedAt: number;
    closedAt?: number;
    closePrice?: number;
    note?: string;
}

const STORAGE_KEY = 'sb_paper_trades';

export function usePaperTrades(
    summaries: Record<string, { price: number }>
) {
    const [trades, setTrades] = useState<PaperTrade[]>([]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setTrades(JSON.parse(saved));
        } catch { }
    }, []);

    const persist = (next: PaperTrade[]) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { }
    };

    const openTrade = useCallback((params: {
        symbol: string;
        side: 'LONG' | 'SHORT';
        entryPrice: number;
        quantity: number;
        note?: string;
    }) => {
        const trade: PaperTrade = {
            id: `${params.symbol}-${Date.now()}`,
            symbol: params.symbol,
            side: params.side,
            entryPrice: params.entryPrice,
            quantity: params.quantity,
            openedAt: Date.now(),
            note: params.note,
        };
        setTrades(prev => {
            const next = [trade, ...prev];
            persist(next);
            return next;
        });
    }, []);

    const closeTrade = useCallback((id: string, closePrice: number) => {
        setTrades(prev => {
            const next = prev.map(t =>
                t.id === id && !t.closedAt
                    ? { ...t, closedAt: Date.now(), closePrice }
                    : t
            );
            persist(next);
            return next;
        });
    }, []);

    const deleteTrade = useCallback((id: string) => {
        setTrades(prev => {
            const next = prev.filter(t => t.id !== id);
            persist(next);
            return next;
        });
    }, []);

    const clearAll = useCallback(() => {
        setTrades([]);
        persist([]);
    }, []);

    // Compute open trades with live P&L
    const openTrades = useMemo(() => {
        return trades
            .filter(t => !t.closedAt)
            .map(t => {
                const currentPrice = summaries[t.symbol]?.price;
                let pnl: number | null = null;
                let pnlPct: number | null = null;
                if (typeof currentPrice === 'number' && !isNaN(currentPrice)) {
                    const diff = t.side === 'LONG'
                        ? currentPrice - t.entryPrice
                        : t.entryPrice - currentPrice;
                    pnl = diff * t.quantity;
                    pnlPct = (diff / t.entryPrice) * 100;
                }
                return { ...t, currentPrice, pnl, pnlPct };
            });
    }, [trades, summaries]);

    const closedTrades = useMemo(() => {
        return trades
            .filter(t => t.closedAt && typeof t.closePrice === 'number')
            .map(t => {
                const diff = t.side === 'LONG'
                    ? (t.closePrice as number) - t.entryPrice
                    : t.entryPrice - (t.closePrice as number);
                const pnl = diff * t.quantity;
                const pnlPct = (diff / t.entryPrice) * 100;
                return { ...t, pnl, pnlPct };
            });
    }, [trades]);

    const stats = useMemo(() => {
        const closed = closedTrades;
        const wins = closed.filter(t => (t.pnl ?? 0) > 0).length;
        const losses = closed.filter(t => (t.pnl ?? 0) < 0).length;
        const totalPnl = closed.reduce((a, t) => a + (t.pnl ?? 0), 0);
        const openPnl = openTrades.reduce((a, t) => a + (t.pnl ?? 0), 0);
        const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
        return {
            totalTrades: trades.length,
            openCount: openTrades.length,
            closedCount: closed.length,
            wins,
            losses,
            winRate,
            closedPnl: totalPnl,
            openPnl,
            totalPnl: totalPnl + openPnl,
        };
    }, [openTrades, closedTrades, trades.length]);

    return {
        trades,
        openTrades,
        closedTrades,
        stats,
        openTrade,
        closeTrade,
        deleteTrade,
        clearAll,
    };
}
