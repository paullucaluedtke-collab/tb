import { StockDataPoint } from './technical-analysis';
// Use require for technicalindicators to avoid TS module resolution issues with the library's exports
const ti = require('technicalindicators');

// --- Sentiment Analysis ---

const WORD_WEIGHTS: Record<string, number> = {
    // Strong Positive (+3)
    'skyrocket': 3, 'surge': 3, 'record': 3, 'soar': 3, 'bull': 3,
    // Moderate Positive (+2)
    'jump': 2, 'gain': 2, 'beat': 2, 'strong': 2, 'growth': 2, 'profit': 2, 'upgrade': 2,
    // Weak Positive (+1)
    'up': 1, 'high': 1, 'buy': 1, 'optimis': 1, 'revenue': 1,

    // Strong Negative (-3)
    'crash': -3, 'plunge': -3, 'collapse': -3, 'bear': -3, 'recession': -3, 'panic': -3,
    // Moderate Negative (-2)
    'drop': -2, 'fall': -2, 'miss': -2, 'loss': -2, 'downgrade': -2, 'weak': -2, 'risk': -2,
    // Weak Negative (-1)
    'down': -1, 'low': -1, 'sell': -1, 'decline': -1, 'pessimis': -1, 'inflation': -1
};

export interface SentimentResult {
    score: number; // Weighted average
    label: 'Bullish' | 'Bearish' | 'Neutral';
    summary: string;
    details?: Record<string, 'Positive' | 'Negative' | 'Neutral'>;
}

export const analyzeSentiment = (headlines: string[]): SentimentResult => {
    let totalScore = 0;

    // Track unique headlines that contributed to the score
    const contributingHeadlines = new Map<string, 'Positive' | 'Negative' | 'Neutral'>();

    headlines.forEach(headline => {
        const lower = headline.toLowerCase();
        let headlineScore = 0;
        let matched = false;

        Object.entries(WORD_WEIGHTS).forEach(([word, weight]) => {
            if (lower.includes(word)) {
                headlineScore += weight;
                matched = true;
            }
        });

        if (matched) {
            totalScore += headlineScore;
            let sentiment: 'Positive' | 'Negative' | 'Neutral' = 'Neutral';
            if (headlineScore > 0) sentiment = 'Positive';
            if (headlineScore < 0) sentiment = 'Negative';
            contributingHeadlines.set(headline, sentiment);
        }
    });

    const relevantCount = contributingHeadlines.size;

    // Normalize logic: average score per relevant headline
    const averageScore = relevantCount > 0 ? totalScore / relevantCount : 0;

    let label: SentimentResult['label'] = 'Neutral';
    // Hype thresholds
    if (averageScore >= 1) label = 'Bullish';
    if (averageScore <= -1) label = 'Bearish';

    const details: Record<string, 'Positive' | 'Negative' | 'Neutral'> = {};
    contributingHeadlines.forEach((val, key) => {
        details[key] = val;
    });

    return {
        score: averageScore,
        label,
        summary: relevantCount > 0
            ? `AI Score: ${averageScore.toFixed(1)} based on ${relevantCount} signals.`
            : 'No relevant sentiment detected.',
        details
    };
};

// --- Trade Recommendation & Pattern Recognition ---

export interface TradeRecommendation {
    action: 'LONG' | 'SHORT' | 'WAIT';
    reason: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    patterns?: string[]; // Detected patterns
    stopLoss?: number;
    takeProfit?: number;
}

export const getTradeSignal = (data: StockDataPoint[], mode: 'swing' | 'scalp' = 'swing', sentimentLab: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral'): TradeRecommendation => {
    if (data.length < 200) {
        return { action: 'WAIT', reason: 'Not enough data', confidence: 'LOW' };
    }

    const latest = data[data.length - 1];
    const prev = data[data.length - 2];

    const inputOpen = data.slice(-5).map(d => d.open);
    const inputHigh = data.slice(-5).map(d => d.high);
    const inputLow = data.slice(-5).map(d => d.low);
    const inputClose = data.slice(-5).map(d => d.close);

    const patternInput = {
        open: inputOpen,
        high: inputHigh,
        low: inputLow,
        close: inputClose,
    };

    const patterns: string[] = [];

    // Helper to check result
    const checkPattern = (fn: any, name: string) => {
        try {
            const result = fn(patternInput);
            if (result === true || (Array.isArray(result) && result[result.length - 1])) {
                patterns.push(name);
            }
        } catch (e) { }
    };

    // Bullish Patterns
    if (ti.bullishengulfingpattern) checkPattern(ti.bullishengulfingpattern, 'Bullish Engulfing');
    if (ti.bullishhammerstick) checkPattern(ti.bullishhammerstick, 'Hammer');
    if (ti.morningstar) checkPattern(ti.morningstar, 'Morning Star');

    // Bearish Patterns
    if (ti.bearishengulfingpattern) checkPattern(ti.bearishengulfingpattern, 'Bearish Engulfing');
    if (ti.shootingstar) checkPattern(ti.shootingstar, 'Shooting Star');
    if (ti.eveningstar) checkPattern(ti.eveningstar, 'Evening Star');


    // Trend Check
    // Swing: SMA 200 (Long term)
    // Scalp: EMA 50 (Faster, reactive)
    const trendIndicator = mode === 'scalp' ? (latest.ema50 || latest.sma50) : latest.sma200;
    const isUptrend = latest.close > (trendIndicator || 0);
    const isDowntrend = latest.close < (trendIndicator || 0);

    // Momentum Check (RSI)
    const rsi = latest.rsi14 || 50;
    const isOversold = rsi < 30;
    const isOverbought = rsi > 70;

    // Momentum Check (MACD)
    const macdHist = latest.macd?.histogram || 0;
    const prevMacdHist = prev.macd?.histogram || 0;
    const macdBullishCross = macdHist > 0 && prevMacdHist <= 0;
    const macdBearishCross = macdHist < 0 && prevMacdHist >= 0;

    // ATR for Stop Loss / Take Profit
    const atr = latest.atr || (latest.high - latest.low); // Fallback
    const calculateExits = (action: 'LONG' | 'SHORT', price: number, atrValue: number) => {
        // Mode logic: Scalp = tighter stops, Swing = wider stops
        const slMult = mode === 'scalp' ? 1.0 : 2.0;
        const tpMult = mode === 'scalp' ? 2.0 : 4.0;

        if (action === 'LONG') {
            return {
                stopLoss: price - (atrValue * slMult),
                takeProfit: price + (atrValue * tpMult)
            };
        } else {
            return {
                stopLoss: price + (atrValue * slMult),
                takeProfit: price - (atrValue * tpMult)
            };
        }
    };

    // 1. STRONG BUY (Long)
    const hasBullishPattern = patterns.some(p => ['Bullish Engulfing', 'Hammer', 'Morning Star'].includes(p));

    // Sentiment Gate: Avoid buying if sentiment is Bearish
    const sentimentGateLong = sentimentLab !== 'Bearish';

    if (isUptrend && (isOversold || macdBullishCross || hasBullishPattern) && sentimentGateLong) {
        let reason = 'Uptrend';
        if (isOversold) reason += ' + RSI Oversold';
        if (macdBullishCross) reason += ' + MACD Bullish Cross';
        if (hasBullishPattern) reason += ` + ${patterns.join(', ')}`;

        const exits = calculateExits('LONG', latest.close, atr);

        return {
            action: 'LONG',
            reason,
            confidence: hasBullishPattern ? 'HIGH' : 'MEDIUM',
            patterns,
            ...exits
        };
    }

    // 2. STRONG SELL (Short)
    const hasBearishPattern = patterns.some(p => ['Bearish Engulfing', 'Shooting Star', 'Evening Star'].includes(p));

    // Sentiment Gate: Avoid shorting if sentiment is Bullish
    const sentimentGateShort = sentimentLab !== 'Bullish';

    if (isDowntrend && (isOverbought || macdBearishCross || hasBearishPattern) && sentimentGateShort) {
        let reason = 'Downtrend';
        if (isOverbought) reason += ' + RSI Overbought';
        if (macdBearishCross) reason += ' + MACD Bearish Cross';
        if (hasBearishPattern) reason += ` + ${patterns.join(', ')}`;

        const exits = calculateExits('SHORT', latest.close, atr);

        return {
            action: 'SHORT',
            reason,
            confidence: hasBearishPattern ? 'HIGH' : 'MEDIUM',
            patterns,
            ...exits
        };
    }

    // 3. WAIT signals
    return { action: 'WAIT', reason: 'No clear signal', confidence: 'LOW', patterns };
};
