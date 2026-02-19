const YahooFinance = require('yahoo-finance2').default;
const yf = new YahooFinance();

async function checkNews() {
    try {
        const res = await yf.search('AAPL', { newsCount: 5 });
        if (res.news && res.news.length > 0) {
            console.log('First news item time:', res.news[0].providerPublishTime);
            console.log('Type of time:', typeof res.news[0].providerPublishTime);
            console.log('Sample item:', JSON.stringify(res.news[0], null, 2));
        } else {
            console.log('No news found');
        }
    } catch (e) {
        console.error(e);
    }
}

checkNews();
