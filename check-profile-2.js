const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

// Suppress notices
yahooFinance.setGlobalConfig({ validation: { logErrors: false } });

async function check() {
    try {
        console.log("--- AAPL ---");
        const aapl = await yahooFinance.quoteSummary('AAPL', { modules: ['summaryProfile', 'assetProfile'] });
        console.log("SummaryProfile:", aapl.summaryProfile ? 'Found' : 'Missing');
        if (aapl.summaryProfile) console.log("Desc:", aapl.summaryProfile.longBusinessSummary ? aapl.summaryProfile.longBusinessSummary.slice(0, 50) + "..." : "No desc");

        console.log("\n--- BTC-USD ---");
        const btc = await yahooFinance.quoteSummary('BTC-USD', { modules: ['summaryProfile', 'assetProfile'] });
        console.log("SummaryProfile:", btc.summaryProfile ? 'Found' : 'Missing');
        console.log("AssetProfile:", btc.assetProfile ? 'Found' : 'Missing');
        if (btc.summaryProfile) console.log("Desc (Summary):", btc.summaryProfile.longBusinessSummary ? btc.summaryProfile.longBusinessSummary.slice(0, 50) + "..." : "No desc");
        if (btc.assetProfile) console.log("Desc (Asset):", btc.assetProfile.description ? btc.assetProfile.description.slice(0, 50) + "..." : "No desc");

    } catch (e) {
        console.error("Error:", e.message);
    }
}

check();
