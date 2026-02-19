import { SMA, RSI, MACD } from 'technicalindicators';

export interface StockDataPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    // Indicators
    sma20?: number;
    sma50?: number;
    sma200?: number;
    rsi14?: number;
    macd?: {
        MACD?: number;
        signal?: number;
        histogram?: number;
    };
}

export const calculateIndicators = (data: any[]): StockDataPoint[] => {
    // Extract closing prices for calculations
    const closes = data.map((d) => d.close);

    // Calculate SMA
    const sma20 = SMA.calculate({ period: 20, values: closes });
    const sma50 = SMA.calculate({ period: 50, values: closes });
    const sma200 = SMA.calculate({ period: 200, values: closes });

    // Calculate RSI
    const rsi14 = RSI.calculate({ period: 14, values: closes });

    // Calculate MACD
    const macdInput = {
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
    };
    const macd = MACD.calculate(macdInput);

    // Align indicators with original data
    // Note: Indicators result in fewer data points (shifting needed).
    // We'll iterate backwards to align correctly.

    const enrichedData = data.map((d, index) => {
        /* 
          Example: If SMA20 length is N, it corresponds to the last N elements of data.
          So sma20[last] matches data[last].
          
          We need to handle the offset carefully.
          Offset = Total - IndicatorLength
        */

        // Helper to get value with offset handling
        const getIndicatorValue = (indicatorResults: any[], offset: number) => {
            const indicatorIndex = index - offset;
            if (indicatorIndex >= 0 && indicatorIndex < indicatorResults.length) {
                return indicatorResults[indicatorIndex];
            }
            return undefined;
        };


        return {
            ...d,
            date: d.date.toISOString().split('T')[0], // format date for UI
            sma20: getIndicatorValue(sma20, data.length - sma20.length),
            sma50: getIndicatorValue(sma50, data.length - sma50.length),
            sma200: getIndicatorValue(sma200, data.length - sma200.length),
            rsi14: getIndicatorValue(rsi14, data.length - rsi14.length),
            macd: getIndicatorValue(macd, data.length - macd.length),
        };
    });

    return enrichedData;
};
