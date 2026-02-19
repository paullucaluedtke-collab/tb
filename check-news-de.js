const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function check() {
    try {
        console.log("--- News (de-DE) check for 'Apple' ---");
        // Use 'search' with lang option
        const result = await yahooFinance.search('Apple', { newsCount: 3 }, { lang: 'de-DE', region: 'DE' });

        if (result.news) {
            result.news.forEach(n => console.log(`- ${n.title} (${n.providerPublishTime})`));
        } else {
            console.log("No news found.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

check();
