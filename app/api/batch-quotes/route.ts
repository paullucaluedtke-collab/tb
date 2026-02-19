import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { symbols } = body;

        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return NextResponse.json({ error: 'No symbols provided' }, { status: 400 });
        }

        // Fetch quotes in batch
        const results = await yahooFinance.quote(symbols);

        // Map to a lightweight format for the frontend
        const data = results.map((q: any) => ({
            symbol: q.symbol,
            price: q.regularMarketPrice || q.postMarketPrice || q.price,
            change: q.regularMarketChangePercent,
            displayName: q.shortName || q.longName
        }));

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('Batch fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch batch data' }, { status: 500 });
    }
}
