export interface Asset {
    symbol: string;
    name: string;
    category: 'Stock' | 'Crypto' | 'Index' | 'Forex';
}

export const ASSETS: Asset[] = [
    // --- Indices / ETFs ---
    { symbol: 'SPY', name: 'S&P 500', category: 'Index' },
    { symbol: 'QQQ', name: 'Nasdaq 100', category: 'Index' },
    { symbol: 'IWM', name: 'Russell 2000', category: 'Index' },
    { symbol: 'DIA', name: 'Dow Jones', category: 'Index' },
    { symbol: 'GLD', name: 'Gold', category: 'Index' },
    { symbol: 'SLV', name: 'Silver', category: 'Index' },
    { symbol: 'TLT', name: '20+ Yr Treasury', category: 'Index' },
    { symbol: 'VIX', name: 'Volatility Index', category: 'Index' },

    // --- Crypto ---
    { symbol: 'BTC-USD', name: 'Bitcoin', category: 'Crypto' },
    { symbol: 'ETH-USD', name: 'Ethereum', category: 'Crypto' },
    { symbol: 'SOL-USD', name: 'Solana', category: 'Crypto' },
    { symbol: 'DOGE-USD', name: 'Dogecoin', category: 'Crypto' },
    { symbol: 'XRP-USD', name: 'XRP', category: 'Crypto' },
    { symbol: 'ADA-USD', name: 'Cardano', category: 'Crypto' },
    { symbol: 'AVAX-USD', name: 'Avalanche', category: 'Crypto' },
    { symbol: 'SHIB-USD', name: 'Shiba Inu', category: 'Crypto' },
    { symbol: 'DOT-USD', name: 'Polkadot', category: 'Crypto' },
    { symbol: 'LINK-USD', name: 'Chainlink', category: 'Crypto' },
    { symbol: 'MATIC-USD', name: 'Polygon', category: 'Crypto' },

    // --- Stocks: Big Tech / AI ---
    { symbol: 'NVDA', name: 'NVIDIA', category: 'Stock' },
    { symbol: 'AAPL', name: 'Apple', category: 'Stock' },
    { symbol: 'MSFT', name: 'Microsoft', category: 'Stock' },
    { symbol: 'AMZN', name: 'Amazon', category: 'Stock' },
    { symbol: 'GOOGL', name: 'Alphabet', category: 'Stock' },
    { symbol: 'META', name: 'Meta', category: 'Stock' },
    { symbol: 'TSLA', name: 'Tesla', category: 'Stock' },
    { symbol: 'AMD', name: 'AMD', category: 'Stock' },
    { symbol: 'AVGO', name: 'Broadcom', category: 'Stock' },
    { symbol: 'ORCL', name: 'Oracle', category: 'Stock' },
    { symbol: 'CRM', name: 'Salesforce', category: 'Stock' },
    { symbol: 'INTC', name: 'Intel', category: 'Stock' },
    { symbol: 'IBM', name: 'IBM', category: 'Stock' },
    { symbol: 'PLTR', name: 'Palantir', category: 'Stock' },
    { symbol: 'SMCI', name: 'Super Micro', category: 'Stock' },

    // --- Stocks: Finance / Fintech ---
    { symbol: 'JPM', name: 'JPMorgan', category: 'Stock' },
    { symbol: 'BAC', name: 'Bank of America', category: 'Stock' },
    { symbol: 'V', name: 'Visa', category: 'Stock' },
    { symbol: 'MA', name: 'Mastercard', category: 'Stock' },
    { symbol: 'GS', name: 'Goldman Sachs', category: 'Stock' },
    { symbol: 'MS', name: 'Morgan Stanley', category: 'Stock' },
    { symbol: 'BLK', name: 'BlackRock', category: 'Stock' },
    { symbol: 'COIN', name: 'Coinbase', category: 'Stock' },
    { symbol: 'HOOD', name: 'Robinhood', category: 'Stock' },
    { symbol: 'PYPL', name: 'PayPal', category: 'Stock' },
    { symbol: 'SQ', name: 'Block', category: 'Stock' },

    // --- Stocks: Consumer & Retail ---
    { symbol: 'WMT', name: 'Walmart', category: 'Stock' },
    { symbol: 'COST', name: 'Costco', category: 'Stock' },
    { symbol: 'TGT', name: 'Target', category: 'Stock' },
    { symbol: 'KO', name: 'Coca-Cola', category: 'Stock' },
    { symbol: 'PEP', name: 'PepsiCo', category: 'Stock' },
    { symbol: 'MCD', name: 'McDonald\'s', category: 'Stock' },
    { symbol: 'SBUX', name: 'Starbucks', category: 'Stock' },
    { symbol: 'NKE', name: 'Nike', category: 'Stock' },
    { symbol: 'DIS', name: 'Disney', category: 'Stock' },
    { symbol: 'NFLX', name: 'Netflix', category: 'Stock' },

    // --- Stocks: Health & Industrial ---
    { symbol: 'LLY', name: 'Eli Lilly', category: 'Stock' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', category: 'Stock' },
    { symbol: 'UNH', name: 'UnitedHealth', category: 'Stock' },
    { symbol: 'PFE', name: 'Pfizer', category: 'Stock' },
    { symbol: 'XOM', name: 'Exxon Mobil', category: 'Stock' },
    { symbol: 'CVX', name: 'Chevron', category: 'Stock' },
    { symbol: 'CAT', name: 'Caterpillar', category: 'Stock' },
    { symbol: 'GE', name: 'General Electric', category: 'Stock' },
    { symbol: 'BA', name: 'Boeing', category: 'Stock' },
    { symbol: 'LMT', name: 'Lockheed Martin', category: 'Stock' },

    // --- Forex ---
    { symbol: 'EURUSD=X', name: 'EUR/USD', category: 'Forex' },
    { symbol: 'GBPUSD=X', name: 'GBP/USD', category: 'Forex' },
    { symbol: 'USDJPY=X', name: 'USD/JPY', category: 'Forex' },
    { symbol: 'USDCHF=X', name: 'USD/CHF', category: 'Forex' },
    { symbol: 'AUDUSD=X', name: 'AUD/USD', category: 'Forex' },
    { symbol: 'USDCAD=X', name: 'USD/CAD', category: 'Forex' },

    // --- Stocks: Germany (DAX) ---
    { symbol: 'SAP.DE', name: 'SAP', category: 'Stock' },
    { symbol: 'SIE.DE', name: 'Siemens', category: 'Stock' },
    { symbol: 'ALV.DE', name: 'Allianz', category: 'Stock' },
    { symbol: 'DTE.DE', name: 'Deutsche Telekom', category: 'Stock' },
    { symbol: 'AIR.DE', name: 'Airbus', category: 'Stock' },
    { symbol: 'BMW.DE', name: 'BMW', category: 'Stock' },
    { symbol: 'MBG.DE', name: 'Mercedes-Benz', category: 'Stock' },
    { symbol: 'VOW3.DE', name: 'Volkswagen', category: 'Stock' },
    { symbol: 'BAS.DE', name: 'BASF', category: 'Stock' },
    { symbol: 'IFX.DE', name: 'Infineon', category: 'Stock' },
    { symbol: 'ADS.DE', name: 'Adidas', category: 'Stock' },
    { symbol: 'DHL.DE', name: 'DHL Group', category: 'Stock' },
    { symbol: 'MUV2.DE', name: 'Munich Re', category: 'Stock' },
];
