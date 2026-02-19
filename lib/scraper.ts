import * as cheerio from 'cheerio';

export async function scrapeArticle(url: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return null; // Failed to load
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove unwanted elements
        $('script, style, nav, header, footer, iframe, .ad, .advertisement').remove();

        // Try to find the main article content first
        let content = '';
        const selectors = ['article', 'main', '.content', '#content', '.post-content', '.article-body'];

        for (const selector of selectors) {
            const el = $(selector);
            if (el.length > 0) {
                content = el.text();
                break;
            }
        }

        // Fallback to paragraphs if no main container found
        if (!content || content.length < 200) {
            content = $('p').map((i, el) => $(el).text()).get().join('\n\n');
        }

        // Clean up whitespace
        content = content.replace(/\s+/g, ' ').trim();

        // Check for "Paywall" / "Subscribe" patterns (simple heuristic)
        if (content.length < 500 || content.includes('Subscribe to read') || content.includes('Sign in to continue')) {
            // Likely a paywall or failed scrape
            return null;
        }

        return content.slice(0, 15000); // Limit to ~15k chars for token safety

    } catch (error) {
        console.error(`Scrape failed for ${url}:`, error);
        return null;
    }
}
