// POST /api/portfolio/analyze
// Body: { snapshots: Record<symbol, { price?, changePercent?, sector?, technicalAction?, technicalConfidence? }>, lang?: 'en' | 'de' }
//
// Server reads the user's holdings, enriches them with the client-provided
// snapshots, computes the aggregate summary, then sends both to Claude.
//
// Why client-provided snapshots? Each stock costs a Yahoo fetch — the client
// already has them in `summaries` from useMarketData. Re-fetching server-side
// would double the rate-limit pressure.

import { NextResponse } from 'next/server';
import { listHoldings } from '@/lib/portfolio';
import { enrichHoldings, summarizePortfolio, type HoldingSnapshot } from '@/lib/portfolioAnalysis';
import { analyzePortfolioWithClaude } from '@/lib/llm';

export const maxDuration = 45;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const snapshots: Record<string, HoldingSnapshot> = body.snapshots || {};
        const lang: 'en' | 'de' = body.lang === 'de' ? 'de' : 'en';

        const holdings = listHoldings();
        if (holdings.length === 0) {
            return NextResponse.json({ error: 'Portfolio is empty — add holdings first.' }, { status: 400 });
        }

        const enriched = enrichHoldings(holdings, snapshots);
        const summary = summarizePortfolio(enriched);

        // Pull recent geo-news for macro context (best-effort).
        let geoContext: string | undefined;
        try {
            const geoRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/geo-news`);
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                const headlines: string[] = (geoData.news || []).slice(0, 5).map((n: any) => `- ${n.title}`);
                if (headlines.length > 0) geoContext = headlines.join('\n');
            }
        } catch (_) {}

        const coach = await analyzePortfolioWithClaude(
            enriched.map(h => ({
                symbol: h.symbol,
                quantity: h.quantity,
                avgCost: h.avgCost,
                currentPrice: h.currentPrice,
                marketValue: h.marketValue,
                unrealizedPnlPct: h.unrealizedPnlPct,
                sector: h.sector,
                technicalAction: h.technicalAction,
                technicalConfidence: h.technicalConfidence,
            })),
            {
                totalValue: summary.totalValue,
                totalPnlPct: summary.totalPnlPct,
                dayPnlPct: summary.dayPnlPct,
                concentrationRisk: summary.concentrationRisk,
                diversificationScore: summary.diversificationScore,
                topConcentration: summary.topConcentration,
                sectorAllocation: summary.sectorAllocation,
            },
            geoContext,
            lang,
        );

        return NextResponse.json({ summary, holdings: enriched, coach });
    } catch (e: any) {
        console.error('Portfolio analysis error:', e);
        return NextResponse.json({ error: e.message || 'Analysis failed' }, { status: 500 });
    }
}
