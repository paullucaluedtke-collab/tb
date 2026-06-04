// GET   /api/portfolio          → list all holdings (current user)
// POST  /api/portfolio          → add or update a holding (weighted-average upsert)
// DELETE /api/portfolio         → clear all holdings (admin-style nuke)

import { NextResponse } from 'next/server';
import { listHoldings, upsertHolding, clearAllHoldings } from '@/lib/portfolio';

export async function GET() {
    try {
        return NextResponse.json({ holdings: listHoldings() });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to list holdings' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const holding = upsertHolding({
            symbol: body.symbol,
            quantity: Number(body.quantity),
            avgCost: Number(body.avgCost ?? body.avg_cost),
            currency: body.currency,
            broker: body.broker,
            notes: body.notes ?? null,
        });
        return NextResponse.json({ holding });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to add holding' }, { status: 400 });
    }
}

export async function DELETE() {
    try {
        const removed = clearAllHoldings();
        return NextResponse.json({ removed });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to clear holdings' }, { status: 500 });
    }
}
