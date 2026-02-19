const YahooFinance = require('yahoo-finance2').default;

const yf = new YahooFinance();

async function test() {
    try {
        console.log('Testing historical...');
        const hist = await yf.historical('AAPL', { period1: '2023-01-01', interval: '1d' });
        console.log('Historical success', hist.length);
    } catch (e) {
        console.error('Historical failed:', e.message);
    }

    try {
        console.log('Testing chart...');
        const chart = await yf.chart('AAPL', { period1: '2023-01-01', interval: '1d' });
        console.log('Chart success', chart ? 'yes' : 'no');
        if (chart && chart.quotes) console.log('Quotes length:', chart.quotes.length);
    } catch (e) {
        console.error('Chart failed:', e.message);
    }
}

test();
