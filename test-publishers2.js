const YahooFinance = require('yahoo-finance2').default;
YahooFinance.suppressNotices(['yahooSurvey']);

// The correct way in v2 to disable validation is to catch the error or 
// use a custom fetcher, but let's see if we can just catch the ValidationError.
// Actually, the error object might contain the result.

async function testNews() {
    try {
        const query = "AAPL";
        const searchResult = await YahooFinance.search(query, { newsCount: 50 });
        console.log(`Found ${searchResult.news.length} items`);
    } catch (e) {
        if (e.name === 'FailedYahooValidationError' && e.result) {
             console.log("Validation failed, but we got data:");
             console.log(`Found ${e.result.news.length} items from error object`);
             const publishers = e.result.news.map(n => n.publisher);
             console.log(publishers.slice(0, 20));
        } else {
             console.error("Unknown error:", e);
        }
    }
}

testNews();
