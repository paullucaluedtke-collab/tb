import { SMA, RSI, MACD, EMA, BollingerBands, ATR, StochasticRSI } from 'technicalindicators';

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
    ema50?: number;
    rsi14?: number;
    rsi70?: number; // Slow RSI for long-term deep value pullbacks
    macd?: {
        MACD?: number;
        signal?: number;
        histogram?: number;
    };
    bb?: {
        middle?: number;
        upper?: number;
        lower?: number;
        pb?: number;
    };
    atr?: number;
    volumeSma20?: number;
    ema9?: number;
    ema21?: number;
    stochRsi?: {
        stochRSI?: number;
        k?: number;
        d?: number;
    };
}

// Input can be raw Yahoo Finance data which has Date objects
export const calculateIndicators = (data: any[]): StockDataPoint[] => {
    // Extract OHLC prices for calculations
    const closes = data.map((d) => d.close);
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);

    // Calculate SMA & EMA
    const sma20 = SMA.calculate({ period: 20, values: closes });
    const sma50 = SMA.calculate({ period: 50, values: closes });
    const sma200 = SMA.calculate({ period: 200, values: closes });
    const ema50 = EMA.calculate({ period: 50, values: closes });

    // Calculate RSI
    const rsi14 = RSI.calculate({ period: 14, values: closes });
    const rsi70 = RSI.calculate({ period: 70, values: closes }); // Slow weekly equivalent

    // Calculate Bollinger Bands
    const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });

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

    // Calculate ATR (14-period) for proper Stop Loss / Take Profit levels
    const atr14 = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });

    // Calculate EMA 9 & 21 for scalp mode crossovers
    const ema9 = EMA.calculate({ period: 9, values: closes });
    const ema21 = EMA.calculate({ period: 21, values: closes });

    // Calculate Stochastic RSI
    const stochRsi = StochasticRSI.calculate({
        values: closes,
        rsiPeriod: 14,
        stochasticPeriod: 14,
        kPeriod: 3,
        dPeriod: 3,
    });

    // Calculate Volume SMA (20-period) for volume confirmation
    const volumes = data.map((d) => d.volume || 0);
    const volumeSma20 = SMA.calculate({ period: 20, values: volumes });

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
            // Safely handle date conversion
            date: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date).split('T')[0],
            sma20: getIndicatorValue(sma20, data.length - sma20.length),
            sma50: getIndicatorValue(sma50, data.length - sma50.length),
            sma200: getIndicatorValue(sma200, data.length - sma200.length),
            ema50: getIndicatorValue(ema50, data.length - ema50.length),
            rsi14: getIndicatorValue(rsi14, data.length - rsi14.length),
            rsi70: getIndicatorValue(rsi70, data.length - rsi70.length),
            bb: getIndicatorValue(bb, data.length - bb.length),
            macd: getIndicatorValue(macd, data.length - macd.length),
            atr: getIndicatorValue(atr14, data.length - atr14.length),
            volumeSma20: getIndicatorValue(volumeSma20, data.length - volumeSma20.length),
            ema9: getIndicatorValue(ema9, data.length - ema9.length),
            ema21: getIndicatorValue(ema21, data.length - ema21.length),
            stochRsi: getIndicatorValue(stochRsi, data.length - stochRsi.length),
        };
    });

    return enrichedData;
};
