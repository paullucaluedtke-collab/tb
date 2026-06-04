// Thin client hook over /api/portfolio. Re-fetches after every mutation so
// the panel always shows DB-consistent state. Holdings are cheap to list
// (single SQLite query) so no caching layer needed yet.

import { useCallback, useEffect, useState } from 'react';

export interface Holding {
    id: number;
    userId: string;
    symbol: string;
    quantity: number;
    avgCost: number;
    currency: string;
    broker: string;
    notes: string | null;
    addedAt: number;
    updatedAt: number;
}

export interface HoldingInput {
    symbol: string;
    quantity: number;
    avgCost: number;
    currency?: string;
    broker?: string;
    notes?: string | null;
}

export function usePortfolio() {
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/portfolio');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load portfolio');
            setHoldings(data.holdings || []);
            setError(null);
        } catch (e: any) {
            setError(e.message || 'Failed to load portfolio');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const addHolding = useCallback(async (input: HoldingInput) => {
        const res = await fetch('/api/portfolio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add holding');
        await refresh();
        return data.holding as Holding;
    }, [refresh]);

    const updateHolding = useCallback(async (id: number, input: HoldingInput) => {
        const res = await fetch(`/api/portfolio/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update holding');
        await refresh();
        return data.holding as Holding;
    }, [refresh]);

    const removeHolding = useCallback(async (id: number) => {
        const res = await fetch(`/api/portfolio/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to remove holding');
        await refresh();
    }, [refresh]);

    const clearAll = useCallback(async () => {
        const res = await fetch('/api/portfolio', { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to clear portfolio');
        await refresh();
    }, [refresh]);

    const importCsv = useCallback(async (csv: string) => {
        const res = await fetch('/api/portfolio/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csv }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to import');
        await refresh();
        return data as { imported: Holding[]; errors: { line: number; message: string }[] };
    }, [refresh]);

    return { holdings, loading, error, refresh, addHolding, updateHolding, removeHolding, clearAll, importCsv };
}
