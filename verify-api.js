async function verify() {
    try {
        console.log("Fetching AAPL Stock Data...");
        const stockRes = await fetch('http://localhost:3000/api/stock/AAPL');
        const stockData = await stockRes.json();

        if (stockData.recommendation) {
            console.log('Recommendation Action:', stockData.recommendation.action);
            console.log('Patterns Detected:', stockData.recommendation.patterns);
        } else {
            console.error("No recommendation found in stock data");
        }

        console.log("\nFetching AAPL News Data...");
        const newsRes = await fetch('http://localhost:3000/api/news/AAPL');
        const newsData = await newsRes.json();

        if (newsData.sentiment) {
            console.log('News Sentiment Label:', newsData.sentiment.label);
            console.log('AI Score:', newsData.sentiment.score);
            console.log('Summary:', newsData.sentiment.summary);
            console.log('Heading Details Count:', newsData.sentiment.details ? Object.keys(newsData.sentiment.details).length : 0);
        } else {
            console.error("No sentiment found in news data");
        }

    } catch (error) {
        console.error("Verification Failed:", error);
    }
}

verify();
