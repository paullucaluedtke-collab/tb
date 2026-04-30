// Currency / number formatting helpers.
// Currency is derived from the symbol suffix when known (.DE / .PA → EUR, .L → GBP),
// otherwise falls back to the UI language (de → EUR, en → USD).

export type Lang = 'en' | 'de';

// Returns explicit market currency from the symbol suffix, or null when unknown.
export const getCurrencyForSymbol = (symbol?: string): string | null => {
    if (!symbol) return null;
    if (symbol.endsWith('.DE') || symbol.endsWith('.PA') || symbol.endsWith('.MI') || symbol.endsWith('.AS') || symbol.endsWith('.MC')) return 'EUR';
    if (symbol.endsWith('.L')) return 'GBP';
    if (symbol.endsWith('-EUR')) return 'EUR';
    return null;
};

// Resolution rule:
// 1. Explicit non-USD market suffix wins (e.g. AIR.PA stays EUR even on en UI).
// 2. Otherwise the UI language decides: de → EUR, en → USD.
export const resolveCurrency = (lang: Lang, symbol?: string): string => {
    const fromSymbol = symbol ? getCurrencyForSymbol(symbol) : null;
    if (fromSymbol) return fromSymbol;
    return lang === 'de' ? 'EUR' : 'USD';
};

export const currencySymbol = (currency: string): string => {
    if (currency === 'EUR') return '€';
    if (currency === 'GBP') return '£';
    return '$';
};

export const localeFor = (lang: Lang): string => (lang === 'de' ? 'de-DE' : 'en-US');

export interface FormatOpts {
    symbol?: string;
    decimals?: number;
}

// Pretty currency: 1.234,56 € (de) / $1,234.56 (en)
export const formatPrice = (value: number | null | undefined, lang: Lang, opts: FormatOpts = {}): string => {
    if (value == null || !Number.isFinite(value)) return '—';
    const currency = resolveCurrency(lang, opts.symbol);
    const decimals = opts.decimals ?? 2;
    return value.toLocaleString(localeFor(lang), {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

// Plain currency symbol prefix (use when toLocaleString currency style isn't desired)
export const cur = (lang: Lang, symbol?: string): string => currencySymbol(resolveCurrency(lang, symbol));
