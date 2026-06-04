// Aggregations over a list of Holdings + current market snapshots.
// Pure functions — no DB / no fetch. Used by both the UI panel and the
// AI coach so they always see the same numbers.

import type { Holding } from './portfolio';

export interface HoldingSnapshot {
    symbol: string;
    price?: number;
    changePercent?: number;
    sector?: string;
    sma50?: number;
    sma200?: number;
    rsi14?: number;
    macdBullish?: boolean;
    technicalAction?: 'LONG' | 'SHORT' | 'WAIT';
    technicalConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface EnrichedHolding extends Holding {
    currentPrice?: number;
    marketValue?: number;
    costBasis: number;
    unrealizedPnl?: number;
    unrealizedPnlPct?: number;
    dayPnl?: number;
    sector?: string;
    technicalAction?: 'LONG' | 'SHORT' | 'WAIT';
    technicalConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PortfolioSummary {
    totalValue: number;
    totalCost: number;
    totalPnl: number;
    totalPnlPct: number;
    dayPnl: number;
    dayPnlPct: number;
    positions: number;
    longSignals: number;
    shortSignals: number;
    waitSignals: number;
    topConcentration: { symbol: string; pctOfPortfolio: number }[];   // top 3
    sectorAllocation: { sector: string; value: number; pct: number }[];
    concentrationRisk: 'LOW' | 'MEDIUM' | 'HIGH';                      // single-position
    diversificationScore: number;                                       // 0-100 (HHI-based)
}

export function enrichHoldings(
    holdings: Holding[],
    snapshots: Record<string, HoldingSnapshot>,
): EnrichedHolding[] {
    return holdings.map(h => {
        const snap = snapshots[h.symbol];
        const costBasis = h.quantity * h.avgCost;
        if (!snap || typeof snap.price !== 'number') {
            return { ...h, costBasis };
        }
        const marketValue = h.quantity * snap.price;
        const unrealizedPnl = marketValue - costBasis;
        const unrealizedPnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
        const dayPnl = typeof snap.changePercent === 'number'
            ? marketValue * (snap.changePercent / (100 + snap.changePercent))
            : undefined;
        return {
            ...h,
            costBasis,
            currentPrice: snap.price,
            marketValue,
            unrealizedPnl,
            unrealizedPnlPct,
            dayPnl,
            sector: snap.sector,
            technicalAction: snap.technicalAction,
            technicalConfidence: snap.technicalConfidence,
        };
    });
}

export function summarizePortfolio(enriched: EnrichedHolding[]): PortfolioSummary {
    const totalCost = enriched.reduce((s, h) => s + h.costBasis, 0);
    const valued = enriched.filter(h => typeof h.marketValue === 'number');
    const totalValue = valued.reduce((s, h) => s + (h.marketValue || 0), 0);
    const totalPnl = totalValue - valued.reduce((s, h) => s + h.costBasis, 0);
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const dayPnl = valued.reduce((s, h) => s + (h.dayPnl || 0), 0);
    const dayPnlPct = totalValue > 0 ? (dayPnl / totalValue) * 100 : 0;

    let longSignals = 0, shortSignals = 0, waitSignals = 0;
    enriched.forEach(h => {
        if (h.technicalAction === 'LONG') longSignals++;
        else if (h.technicalAction === 'SHORT') shortSignals++;
        else if (h.technicalAction === 'WAIT') waitSignals++;
    });

    // Concentration: top 3 positions by % of portfolio value
    const topConcentration = valued
        .map(h => ({
            symbol: h.symbol,
            pctOfPortfolio: totalValue > 0 ? ((h.marketValue || 0) / totalValue) * 100 : 0,
        }))
        .sort((a, b) => b.pctOfPortfolio - a.pctOfPortfolio)
        .slice(0, 3);

    // Sector allocation
    const sectorMap = new Map<string, number>();
    valued.forEach(h => {
        const s = h.sector || 'Unknown';
        sectorMap.set(s, (sectorMap.get(s) || 0) + (h.marketValue || 0));
    });
    const sectorAllocation = Array.from(sectorMap.entries())
        .map(([sector, value]) => ({ sector, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
        .sort((a, b) => b.pct - a.pct);

    // Single-position concentration risk: > 30% one stock = HIGH, > 20% = MEDIUM
    const maxPct = topConcentration[0]?.pctOfPortfolio || 0;
    const concentrationRisk: 'LOW' | 'MEDIUM' | 'HIGH' =
        maxPct > 30 ? 'HIGH' : maxPct > 20 ? 'MEDIUM' : 'LOW';

    // Diversification score via inverted Herfindahl–Hirschman Index.
    // HHI = sum(pct^2); 0 = perfectly diversified, 10000 = single stock.
    const hhi = valued.reduce((s, h) => {
        const p = totalValue > 0 ? ((h.marketValue || 0) / totalValue) * 100 : 0;
        return s + p * p;
    }, 0);
    // Normalize: 100 best (n positions evenly = 10000/n), 0 worst (single 100% = 10000)
    const n = valued.length || 1;
    const idealHhi = 10000 / n;
    const diversificationScore = Math.max(0, Math.min(100, Math.round(100 * (1 - (hhi - idealHhi) / (10000 - idealHhi)))));

    return {
        totalValue, totalCost, totalPnl, totalPnlPct, dayPnl, dayPnlPct,
        positions: enriched.length,
        longSignals, shortSignals, waitSignals,
        topConcentration, sectorAllocation,
        concentrationRisk, diversificationScore,
    };
}
