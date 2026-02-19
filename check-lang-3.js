const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function check() {
    try {
        console.log("--- News (de-DE) ---");
        // Try to fetch news in German
        const results = await yahooFinance.search('Apple', { newsCount: 1 }, { lang: 'de-DE', region: 'DE' });
        if (results.news && results.news.length > 0) {
            console.log("Title:", results.news[0].title);
        } else {
            console.log("No news found");
        }

        console.log("--- Symbol (AAPL.DE) ---");
        // Fetching profile for AAPL.DE (Xetra) should be in German
        const profile = await yahooFinance.quoteSummary('AAPL.DE', { modules: ['summaryProfile'] });
        console.log("Desc:", profile.summaryProfile?.longBusinessSummary?.slice(0, 50));

    } catch (e) {
        console.log("Error:", e.message);
    }
}
check();
