const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

const TRUSTED_PUBLISHERS = [
    'bloomberg',
    'reuters',
    'the wall street journal',
    'financial times',
    'cnbc',
    'marketwatch',
    'barrons',
    'barron\'s',
    'forbes',
    'fortune',
    'the new york times'
];

async function testNews() {
    try {
        const query = "AAPL";
        const searchResult = await yahooFinance.search(query, { newsCount: 15 });
        let newsItems = searchResult.news || [];
        
        console.log(`Original order:`);
        newsItems.forEach(n => console.log(`- ${n.publisher}`));

        newsItems.sort((a, b) => {
            const aPublisher = (a.publisher || '').toLowerCase();
            const bPublisher = (b.publisher || '').toLowerCase();
            const aIsTrusted = TRUSTED_PUBLISHERS.some(p => aPublisher.includes(p));
            const bIsTrusted = TRUSTED_PUBLISHERS.some(p => bPublisher.includes(p));

            if (aIsTrusted && !bIsTrusted) return -1;
            if (!aIsTrusted && bIsTrusted) return 1;
            return 0;
        });

        console.log(`\nSorted order:`);
        newsItems.forEach(n => console.log(`- ${n.publisher}`));

    } catch (e) {
        console.error(e);
    }
}

testNews();
