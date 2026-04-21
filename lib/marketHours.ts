export type MarketSession = 'regular' | 'pre' | 'after' | 'always' | 'closed';

export interface MarketStatus {
    isOpen: boolean;
    session: MarketSession;
    label: string;
    exchange: string;
}

/**
 * Returns the current market status using the LONGEST available trading window
 * for each symbol. For equities accessible via gettex (Trade Republic),
 * automatically uses 7:30-23:00 CET when it provides more uptime than the
 * native exchange. Crypto stays 24/7, Forex stays Mon-Fri 24h.
 */
export function getMarketStatus(symbol: string, category?: string): MarketStatus {
    // Crypto: always open
    if (category === 'Crypto' || symbol.includes('-USD') || symbol.includes('-EUR')) {
        return { isOpen: true, session: 'always', label: '24/7', exchange: 'CRYPTO' };
    }

    // Forex: open Mon-Fri
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

    // For all other assets: pick the exchange with the longest open window right now.
    // gettex (7:30-23:00 CET) covers all equities/ETFs/indices available on Trade Republic.
    const gettex = getGettexStatus();
    const native = getNativeStatus(symbol);

    // If gettex is open and native is closed, prefer gettex (longer hours)
    if (gettex.isOpen && !native.isOpen) return gettex;
    // If both open, prefer the one with 'regular' session (faster polling)
    if (gettex.isOpen && native.isOpen) {
        return native.session === 'regular' ? native : gettex;
    }
    // If native is open but gettex closed (shouldn't happen often), use native
    if (native.isOpen) return native;

    // Both closed — return whichever has a more informative label
    return native;
}

/**
 * Polling interval (ms) for a given market session.
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

function getNativeStatus(symbol: string): MarketStatus {
    if (symbol.endsWith('.DE') || symbol.endsWith('.PA')) {
        return getEuropeanStatus(symbol.endsWith('.DE') ? 'XETRA' : 'EURONEXT');
    }
    if (symbol.endsWith('.L')) {
        return getLondonStatus();
    }
    return getUSStatus();
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
    if (m >= 480 && m < 990) {
        return { isOpen: true, session: 'regular', label: 'OPEN', exchange: 'LSE' };
    }

    return { isOpen: false, session: 'closed', label: 'CLOSED', exchange: 'LSE' };
}

// gettex / LS Exchange (Trade Republic): Mon-Fri 7:30-23:00 CET
function getGettexStatus(): MarketStatus {
    const now = new Date();
    const cet = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const day = cet.getDay();

    if (day === 0 || day === 6) {
        return { isOpen: false, session: 'closed', label: 'CLOSED', exchange: 'gettex' };
    }

    const m = cet.getHours() * 60 + cet.getMinutes();
    if (m >= 450 && m < 1380) {
        return { isOpen: true, session: 'regular', label: 'TR OPEN', exchange: 'gettex' };
    }

    return { isOpen: false, session: 'closed', label: 'TR CLOSED', exchange: 'gettex' };
}
