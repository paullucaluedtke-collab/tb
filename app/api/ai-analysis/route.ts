import { NextResponse } from 'next/server';
import { scrapeArticle } from '@/lib/scraper';
import { analyzeWithClaude } from '@/lib/llm';

export const maxDuration = 30; // Allow 30s for scraping

export async function POST(request: Request) {
    try {
        const { symbol, newsItems } = await request.json();

        if (!symbol || !newsItems || !Array.isArray(newsItems)) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        // 1. Check for API Key
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('ANTHROPIC_API_KEY is missing in server environment');
            return NextResponse.json({
                error: 'Configuration Error',
                message: 'Internal Server Error: Missing API Key. Did you restart the server?'
            }, { status: 500 });
        }

        // 2. Select top 3-5 articles to analyze
        const targetArticles = newsItems.slice(0, 3);
        let fullText = "";

        // 3. Scrape & Aggregate
        await Promise.all(targetArticles.map(async (item: any) => {
            let articleText = null;
            if (item.link) {
                articleText = await scrapeArticle(item.link);
            }

            if (articleText) {
                fullText += `\n\n--- Article: ${item.title} ---\n${articleText}`;
            } else {
                // Fallback: Use Title + Description if scraping failed/paywalled
                fullText += `\n\n--- Article (Summary): ${item.title} ---\n${item.title}. ${item.description || ''}`;
            }
        }));

        // 4. Send to Claude
        const result = await analyzeWithClaude(fullText, symbol);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('AI Analysis Error:', error);
        return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }
}
