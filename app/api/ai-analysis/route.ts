import { NextResponse } from 'next/server';
import { scrapeArticle } from '@/lib/scraper';
import { analyzeWithClaude, PositionContext, TechnicalContext } from '@/lib/llm';

export const maxDuration = 45;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { symbol, newsItems, position, technicals } = body;

        if (!symbol || !newsItems || !Array.isArray(newsItems)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('ANTHROPIC_API_KEY is missing in server environment');
            return NextResponse.json({
                error: 'Configuration Error',
                message: 'Internal Server Error: Missing API Key. Did you restart the server?'
            }, { status: 500 });
        }

        const targetArticles = newsItems.slice(0, 5);
        let fullText = "";

        await Promise.all(targetArticles.map(async (item: any) => {
            let articleText = null;
            if (item.link) {
                articleText = await scrapeArticle(item.link);
            }

            if (articleText) {
                fullText += `\n\n--- Article: ${item.title} ---\n${articleText}`;
            } else {
                fullText += `\n\n--- Article (Summary): ${item.title} ---\n${item.title}. ${item.description || ''}`;
            }
        }));

        let geoContext: string | undefined;
        try {
            const geoRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/geo-news`);
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                const headlines: string[] = (geoData.news || []).slice(0, 5).map((n: any) => `- ${n.title}`);
                if (headlines.length > 0) geoContext = headlines.join('\n');
            }
        } catch (_) {}

        const posCtx: PositionContext | undefined = position ? {
            side: position.side,
            entryPrice: position.entryPrice,
            quantity: position.quantity,
            pnlPercent: position.pnlPercent ?? 0,
            holdingDays: position.holdingDays ?? 0,
        } : undefined;

        const techCtx: TechnicalContext | undefined = technicals ? {
            price: technicals.price,
            change: technicals.change ?? 0,
            rsi: technicals.rsi,
            macdSignal: technicals.macdSignal,
            trend: technicals.trend,
            sma50: technicals.sma50,
            sma200: technicals.sma200,
            atr: technicals.atr,
            volume: technicals.volume,
            stopLoss: technicals.stopLoss,
            takeProfit: technicals.takeProfit,
        } : undefined;

        const result = await analyzeWithClaude(fullText, symbol, geoContext, posCtx, techCtx);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('AI Analysis Error:', error);
        return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }
}
