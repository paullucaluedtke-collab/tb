const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function testNews() {
    try {
        const query = "AAPL";
        const searchResult = await yahooFinance.search(query, { newsCount: 20 });
        const newsItems = searchResult.news || [];
        
        console.log(`Found ${newsItems.length} items`);
        const publishers = newsItems.map(n => n.publisher);
        console.log(publishers);
    } catch (e) {
        console.error(e);
    }
}

testNews();
