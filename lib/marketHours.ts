export type MarketSession = 'regular' | 'pre' | 'after' | 'always' | 'closed';

export interface MarketStatus {
    isOpen: boolean;
    session: MarketSession;
    label: string;
    exchange: string;
}

/**
 * Returns the current market status for a given symbol and category.
 * - Crypto: always open (24/7)
 * - Forex: Mon–Fri (any timezone, always open during weekdays)
 * - .DE / .PA: XETRA / Euronext — 9:00–17:30 CET
 * - .L: LSE — 8:00–16:30 GMT
 * - Everything else: NYSE/NASDAQ with pre- and after-hours
 */
export function getMarketStatus(symbol: string, category?: string): MarketStatus {
    // Crypto: always open
    if (category === 'Crypto' || symbol.includes('-USD') || symbol.includes('-EUR')) {
        return { isOpen: true, session: 'always', label: '24/7', exchange: 'CRYPTO' };
    }

    // Forex: open Mon–Fri
    if (category === 'Forex' || symbol.endsWith('=X')) {
        const day = new Date().getUTCDay();
        const isWeekday = day >= 1 && day <= 5;
        return {
            isOpen: isWeekday,
            session: isWeekday ? 'regular' : 'closed',
            label: isWeekday ? 'OPEN' : 'CLOSED',
            exchange: 'FX',
        };
    }

    // German / French exchanges
    if (symbol.endsWith('.DE') || symbol.endsWith('.PA')) {
        return getEuropeanStatus(symbol.endsWith('.DE') ? 'XETRA' : 'EURONEXT');
    }

    // London Stock Exchange
    if (symbol.endsWith('.L')) {
        return getLondonStatus();
    }

    // Default: US markets (stocks, ETFs, indices)
    return getUSStatus();
}

/**
 * Polling interval (ms) for a given market session.
 * - Always/regular: fast (2s) — live market
 * - Pre/after hours: medium (10s) — some price movement but slower
 * - Closed: slow (45s) — essentially cached, just keep data fresh
 */
export function getPollInterval(session: MarketSession): number {
    switch (session) {
        case 'always':
        case 'regular': return 2_000;
        case 'pre':
        case 'after': return 10_000;
        case 'closed': return 45_000;
    }
}

function getUSStatus(): MarketStatus {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = et.getDay();

    if (day === 0 || day === 6) {
        return { isOpen: false, session: 'closed', label: 'CLOSED', exchange: 'NYSE' };
    }

    const m = et.getHours() * 60 + et.getMinutes();

    if (m >= 240 && m < 570) return { isOpen: true, session: 'pre', label: 'PRE-MKT', exchange: 'NYSE' };
    if (m >= 570 && m < 960) return { isOpen: true, session: 'regular', label: 'OPEN', exchange: 'NYSE' };
    if (m >= 960 && m < 1200) return { isOpen: true, session: 'after', label: 'AFTER-HRS', exchange: 'NYSE' };

    return { isOpen: false, session: 'closed', label: 'CLOSED', exchange: 'NYSE' };
}

function getEuropeanStatus(exchange: string): MarketStatus {
    const now = new Date();
    const cet = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const day = cet.getDay();

    if (day === 0 || day === 6) {
        return { isOpen: false, session: 'closed', label: 'CLOSED', exchange };
    }

    const m = cet.getHours() * 60 + cet.getMinutes();
    // 9:00–17:30 CET
    if (m >= 540 && m < 1050) {
        return { isOpen: true, session: 'regular', label: 'OPEN', exchange };
    }

    return { isOpen: false, session: 'closed', label: 'CLOSED', exchange };
}

function getLondonStatus(): MarketStatus {
    const now = new Date();
    const lon = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const day = lon.getDay();

    if (day === 0 || day === 6) {
        return { isOpen: false, session: 'closed', label: 'CLOSED', exchange: 'LSE' };
    }

    const m = lon.getHours() * 60 + lon.getMinutes();
    // 8:00–16:30 GMT/BST
    if (m >= 480 && m < 990) {
        return { isOpen: true, session: 'regular', label: 'OPEN', exchange: 'LSE' };
    }

    return { isOpen: false, session: 'closed', label: 'CLOSED', exchange: 'LSE' };
}
