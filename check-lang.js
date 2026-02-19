const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

// Suppress notices
yahooFinance.setGlobalConfig({ validation: { logErrors: false } });

async function check() {
    try {
        console.log("--- AAPL (German Attempt) ---");
        // Try passing lang option in queueOptions if supported, or via setGlobalConfig?
        // documentation says queryOptions often take `lang`

        const aapl = await yahooFinance.quoteSummary('AAPL', {
            modules: ['summaryProfile'],
        }, { lang: 'de-DE', region: 'DE' }); // options argument is 3rd?

        // Actually, for quoteSummary, the second arg is queryOptions. 
        // Let's try passing it there.
        // YahooFinance2 structure: quoteSummary(symbol, queryOptions)

        // Let's rely on standard search

        // Strategy 2: Trying distinct call
        const res = await yahooFinance.quoteSummary('AAPL', { modules: ['summaryProfile'] }, { validateResult: false });
        // Note: yahoo-finance2 might not support lang param directly in quoteSummary signature in all versions.
        // Let's try to set it globally if possible or just use the fetch options.

        // Let's try a direct search for news in German?
        const news = await yahooFinance.search('AAPL', { lang: 'de-DE', region: 'DE', newsCount: 1 });
        console.log("News Title:", news.news?.[0]?.title);

    } catch (e) {
        console.error("Error:", e.message);
    }
}

check();
