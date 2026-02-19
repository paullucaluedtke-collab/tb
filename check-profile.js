const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function check() {
    try {
        console.log("--- AAPL ---");
        // Modules: summaryProfile is for stocks (sector, desc), assetProfile (sometimes for crypto), quoteType (for type)
        const aapl = await yahooFinance.quoteSummary('AAPL', { modules: ['summaryProfile', 'assetProfile', 'price'] });
        console.log("SummaryProfile:", aapl.summaryProfile ? 'Found' : 'Missing');
        if (aapl.summaryProfile) console.log("Desc:", aapl.summaryProfile.longBusinessSummary?.slice(0, 100));

        console.log("\n--- BTC-USD ---");
        const btc = await yahooFinance.quoteSummary('BTC-USD', { modules: ['summaryProfile', 'assetProfile', 'price'] });
        console.log("SummaryProfile:", btc.summaryProfile ? 'Found' : 'Missing');
        console.log("AssetProfile:", btc.assetProfile ? 'Found' : 'Missing');
        if (btc.summaryProfile) console.log("Desc (Summary):", btc.summaryProfile.longBusinessSummary?.slice(0, 100));
        if (btc.assetProfile) console.log("Desc (Asset):", btc.assetProfile.description?.slice(0, 100));

    } catch (e) {
        console.error(e);
    }
}

check();
