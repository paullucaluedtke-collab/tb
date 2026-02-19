const yahooFinance = require('yahoo-finance2').default;

async function check() {
    try {
        console.log("--- AAPL (German News Check) ---");
        // 'search' supports newsCount, enableNav, etc.
        const search = await yahooFinance.search('AAPL', { newsCount: 1 }, { lang: 'de-DE', region: 'DE' });
        console.log("News Title:", search.news?.[0]?.title);

        console.log("\n--- AAPL (Profile Check) ---");
        // quoteSummary options are tricky. Let's try to see if default returns English or if we can influence it.
        // There is no documented 'lang' option for quoteSummary in standard docs, but we can try queryOptions?
        // Actually, usually it's based on the query symbol (e.g. AAPL.DE) to get German profile?
        // Let's try AAPL.DE

        const aaplDe = await yahooFinance.quoteSummary('AAPL.DE', { modules: ['summaryProfile'] });
        console.log("Desc (AAPL.DE):", aaplDe.summaryProfile?.longBusinessSummary?.slice(0, 50));

    } catch (e) {
        console.error("Error:", e.message);
    }
}

check();
