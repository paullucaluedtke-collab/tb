// PUT    /api/portfolio/:id  → overwrite a holding (no averaging)
// DELETE /api/portfolio/:id  → remove a single holding

import { NextResponse } from 'next/server';
import { replaceHolding, deleteHolding } from '@/lib/portfolio';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const numId = parseInt(id, 10);
        if (!Number.isFinite(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        const body = await req.json();
        const holding = replaceHolding(numId, {
            symbol: body.symbol,
            quantity: Number(body.quantity),
            avgCost: Number(body.avgCost ?? body.avg_cost),
            currency: body.currency,
            broker: body.broker,
            notes: body.notes ?? null,
        });
        if (!holding) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ holding });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to update holding' }, { status: 400 });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const numId = parseInt(id, 10);
        if (!Number.isFinite(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
        const ok = deleteHolding(numId);
        if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ removed: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to delete holding' }, { status: 500 });
    }
}
