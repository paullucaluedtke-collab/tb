// POST /api/portfolio/import
// Body: { csv: string }
// Returns: { imported: Holding[], errors: { line, message }[] }
//
// Uses lib/portfolio.parseHoldingsCsv → upserts each row (so re-importing the
// same CSV averages-up instead of duplicating).

import { NextResponse } from 'next/server';
import { parseHoldingsCsv, upsertHolding } from '@/lib/portfolio';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const csv: string = body.csv || '';
        if (!csv.trim()) return NextResponse.json({ error: 'Empty CSV' }, { status: 400 });

        const { rows, errors } = parseHoldingsCsv(csv);
        const imported = [];
        for (const row of rows) {
            try {
                imported.push(upsertHolding({ ...row, broker: row.broker || 'csv' }));
            } catch (e: any) {
                errors.push({ line: 0, message: `${row.symbol}: ${e.message}` });
            }
        }
        return NextResponse.json({ imported, errors });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to import' }, { status: 500 });
    }
}
