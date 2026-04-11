import { StockDataPoint } from './technical-analysis';
// Use require for technicalindicators to avoid TS module resolution issues with the library's exports
const ti = require('technicalindicators');

// --- Sentiment Analysis ---

const WORD_WEIGHTS: Record<string, number> = {
    // Strong Positive (+3)
    'skyrocket': 3, 'surge': 3, 'record': 3, 'soar': 3, 'bull': 3,
    'breakout': 3, 'all-time high': 3, 'blowout': 3, 'moonshot': 3,
    // Moderate Positive (+2)
    'jump': 2, 'gain': 2, 'beat': 2, 'strong': 2, 'growth': 2, 'profit': 2, 'upgrade': 2,
    'rally': 2, 'outperform': 2, 'exceed': 2, 'rebound': 2, 'recover': 2,
    'dividend': 2, 'buyback': 2, 'momentum': 2, 'boom': 2, 'accelerat': 2,
    // Weak Positive (+1)
    'up': 1, 'high': 1, 'buy': 1, 'optimis': 1, 'revenue': 1,
    'expand': 1, 'improve': 1, 'positive': 1, 'overweight': 1, 'opportunity': 1,
    'innovative': 1, 'partnership': 1, 'approval': 1, 'launch': 1,

    // Strong Negative (-3)
    'crash': -3, 'plunge': -3, 'collapse': -3, 'bear': -3, 'recession': -3, 'panic': -3,
    'bankrupt': -3, 'fraud': -3, 'default': -3, 'liquidat': -3, 'crisis': -3,
    // Moderate Negative (-2)
    'drop': -2, 'fall': -2, 'miss': -2, 'loss': -2, 'downgrade': -2, 'weak': -2, 'risk': -2,
    'layoff': -2, 'cut': -2, 'warning': -2, 'underperform': -2, 'slump': -2,
    'investigation': -2, 'lawsuit': -2, 'tariff': -2, 'sanction': -2, 'delay': -2,
    // Weak Negative (-1)
    'down': -1, 'low': -1, 'sell': -1, 'decline': -1, 'pessimis': -1, 'inflation': -1,
    'uncertain': -1, 'volatil': -1, 'concern': -1, 'underweight': -1, 'headwind': -1,
    'slowdown': -1, 'pressure': -1, 'struggle': -1
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
    signalStatus?: 'CONFIRMED' | 'FORMING'; // New field to warn about repainting
}

export const getTradeSignal = (data: StockDataPoint[], mode: 'swing' | 'scalp' | 'long_term' = 'swing', sentimentLab: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral'): TradeRecommendation => {
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
    let trendIndicator = latest.sma200; // Default to SMA200 for long_term/swing fallback
    let isUptrend = false;
    let isDowntrend = false;
    let trendReason = '';

    if (mode === 'scalp') {
        trendIndicator = latest.ema50 || latest.sma50;
        isUptrend = latest.close > (trendIndicator || 0);
        isDowntrend = latest.close < (trendIndicator || 0);
        trendReason = 'Uptrend';
    } else if (mode === 'swing') {
        // Swing: Strong trend alignment (Price > SMA50 > SMA200)
        isUptrend = latest.close > (latest.sma50 || 0) && (latest.sma50 || 0) > (latest.sma200 || 0);
        isDowntrend = latest.close < (latest.sma50 || 0) && (latest.sma50 || 0) < (latest.sma200 || 0);
        trendReason = 'Strong Uptrend (MA Alignment)';
    } else if (mode === 'long_term') {
        // Long Term: Secular trend (Price > SMA200)
        isUptrend = latest.close > (latest.sma200 || 0);
        isDowntrend = latest.close < (latest.sma200 || 0);
        trendReason = 'Secular Uptrend (> SMA200)';
    }

    // Momentum Check (RSI)
    const rsi = latest.rsi14 || 50;
    const slowRsi = latest.rsi70 || 50;
    const isOversold = mode === 'long_term' ? (slowRsi < 40 || rsi < 25) : rsi < 30; // Deep value for long term
    const isOverbought = mode === 'long_term' ? (slowRsi > 65 || rsi > 80) : rsi > 70;

    // Momentum Check (MACD)
    const macdHist = latest.macd?.histogram || 0;
    const prevMacdHist = prev.macd?.histogram || 0;
    const macdBullishCross = macdHist > 0 && prevMacdHist <= 0;
    const macdBearishCross = macdHist < 0 && prevMacdHist >= 0;

    // Special Long Term Triggers
    const isGoldenCross = (latest.sma50 || 0) > (latest.sma200 || 0) && (prev.sma50 || 0) <= (prev.sma200 || 0);
    const isDeathCross = (latest.sma50 || 0) < (latest.sma200 || 0) && (prev.sma50 || 0) >= (prev.sma200 || 0);

    // EMA 9/21 Crossover (Scalp-specific fast signals)
    const ema9BullishCross = (latest.ema9 || 0) > (latest.ema21 || 0) && (prev.ema9 || 0) <= (prev.ema21 || 0);
    const ema9BearishCross = (latest.ema9 || 0) < (latest.ema21 || 0) && (prev.ema9 || 0) >= (prev.ema21 || 0);

    // RSI Divergence Detection (look back 10 bars for price/RSI divergence)
    let bullishDivergence = false;
    let bearishDivergence = false;
    if (data.length >= 15) {
        const lookback = data.slice(-15);
        const priceMin = Math.min(...lookback.map(d => d.low));
        const priceMax = Math.max(...lookback.map(d => d.high));
        const rsiValues = lookback.map(d => d.rsi14).filter(v => v !== undefined) as number[];
        if (rsiValues.length >= 10) {
            const rsiMin = Math.min(...rsiValues);
            const rsiMax = Math.max(...rsiValues);
            // Bullish divergence: price makes new low but RSI makes higher low
            if (latest.low <= priceMin * 1.01 && (latest.rsi14 || 50) > rsiMin + 3) {
                bullishDivergence = true;
            }
            // Bearish divergence: price makes new high but RSI makes lower high
            if (latest.high >= priceMax * 0.99 && (latest.rsi14 || 50) < rsiMax - 3) {
                bearishDivergence = true;
            }
        }
    }

    // Volume Confirmation: High volume confirms trend signals
    const volumeAboveAvg = latest.volume > (latest.volumeSma20 || 0) * 1.0;
    const volumeSpike = latest.volume > (latest.volumeSma20 || 0) * 1.5;

    // ATR for Stop Loss / Take Profit
    const atr = latest.atr || (latest.high - latest.low); // Fallback
    const calculateExits = (action: 'LONG' | 'SHORT', price: number, atrValue: number) => {
        // Mode logic: Scalp = tighter stops, Swing = medium, Long Term = very wide
        const slMult = mode === 'scalp' ? 1.0 : (mode === 'swing' ? 2.0 : 5.0);
        const tpMult = mode === 'scalp' ? 2.0 : (mode === 'swing' ? 4.0 : 15.0);

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

    // 1. BUY (Long) SIGNALS
    const hasBullishPattern = patterns.some(p => ['Bullish Engulfing', 'Hammer', 'Morning Star'].includes(p));
    const sentimentGateLong = sentimentLab !== 'Bearish';

    let longTriggered = false;
    let longReason = trendReason;
    let longConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

    if (mode === 'long_term') {
        if (isUptrend && (isGoldenCross || isOversold) && sentimentGateLong) {
            longTriggered = true;
            if (isGoldenCross) longReason += ' + GOLDEN CROSS';
            if (isOversold) longReason += ' + Deep Value Pullback';
            longConfidence = isGoldenCross ? 'HIGH' : 'MEDIUM';
        }
    } else if (mode === 'swing') {
        const bbLowerHit = latest.bb?.lower ? latest.close <= latest.bb.lower : false;
        if (isUptrend && (isOversold || macdBullishCross || bbLowerHit || hasBullishPattern) && sentimentGateLong) {
            longTriggered = true;
            if (isOversold) longReason += ' + RSI Oversold';
            if (macdBullishCross) longReason += ' + MACD Bullish Cross';
            if (bbLowerHit) longReason += ' + Bollinger Lower Band Hit';
            if (hasBullishPattern) longReason += ` + ${patterns.join(', ')}`;
            longConfidence = (bbLowerHit || hasBullishPattern) ? 'HIGH' : 'MEDIUM';
        }
    } else { // Scalp
        if (isUptrend && (isOversold || macdBullishCross || ema9BullishCross || hasBullishPattern) && sentimentGateLong) {
            longTriggered = true;
            if (isOversold) longReason += ' + RSI Oversold';
            if (macdBullishCross) longReason += ' + MACD Bullish Cross';
            if (ema9BullishCross) longReason += ' + EMA 9/21 Bullish Cross';
            if (hasBullishPattern) longReason += ` + ${patterns.join(', ')}`;
            longConfidence = (hasBullishPattern || ema9BullishCross) ? 'HIGH' : 'MEDIUM';
        }
    }

    // RSI Divergence can trigger even without full trend alignment
    if (!longTriggered && bullishDivergence && sentimentGateLong && mode !== 'long_term') {
        longTriggered = true;
        longReason = 'Bullish RSI Divergence';
        longConfidence = 'MEDIUM';
    }

    if (longTriggered) {
        // Volume confirmation upgrades confidence
        if (volumeSpike && longConfidence === 'MEDIUM') longConfidence = 'HIGH';
        if (volumeAboveAvg) longReason += ' + Volume Confirmed';
        if (volumeSpike) longReason += ' (Spike)';

        const exits = calculateExits('LONG', latest.close, atr);
        return {
            action: 'LONG',
            reason: longReason,
            confidence: longConfidence,
            patterns: mode !== 'long_term' ? patterns : [],
            signalStatus: 'FORMING',
            ...exits
        };
    }

    // 2. SELL (Short) SIGNALS
    const hasBearishPattern = patterns.some(p => ['Bearish Engulfing', 'Shooting Star', 'Evening Star'].includes(p));
    const sentimentGateShort = sentimentLab !== 'Bullish';

    let shortTriggered = false;
    let shortReason = mode === 'long_term' ? 'Secular Downtrend (< SMA200)' : 'Downtrend';
    if (mode === 'swing') shortReason = 'Strong Downtrend (MA Alignment)';
    let shortConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

    if (mode === 'long_term') {
        if (isDowntrend && (isDeathCross || isOverbought) && sentimentGateShort) {
            shortTriggered = true;
            if (isDeathCross) shortReason += ' + DEATH CROSS';
            if (isOverbought) shortReason += ' + Overbought Exhaustion';
            shortConfidence = isDeathCross ? 'HIGH' : 'MEDIUM';
        }
    } else if (mode === 'swing') {
        const bbUpperHit = latest.bb?.upper ? latest.close >= latest.bb.upper : false;
        if (isDowntrend && (isOverbought || macdBearishCross || bbUpperHit || hasBearishPattern) && sentimentGateShort) {
            shortTriggered = true;
            if (isOverbought) shortReason += ' + RSI Overbought';
            if (macdBearishCross) shortReason += ' + MACD Bearish Cross';
            if (bbUpperHit) shortReason += ' + Bollinger Upper Band Hit';
            if (hasBearishPattern) shortReason += ` + ${patterns.join(', ')}`;
            shortConfidence = (bbUpperHit || hasBearishPattern) ? 'HIGH' : 'MEDIUM';
        }
    } else { // Scalp
        if (isDowntrend && (isOverbought || macdBearishCross || ema9BearishCross || hasBearishPattern) && sentimentGateShort) {
            shortTriggered = true;
            if (isOverbought) shortReason += ' + RSI Overbought';
            if (macdBearishCross) shortReason += ' + MACD Bearish Cross';
            if (ema9BearishCross) shortReason += ' + EMA 9/21 Bearish Cross';
            if (hasBearishPattern) shortReason += ` + ${patterns.join(', ')}`;
            shortConfidence = (hasBearishPattern || ema9BearishCross) ? 'HIGH' : 'MEDIUM';
        }
    }

    // RSI Divergence can trigger even without full trend alignment
    if (!shortTriggered && bearishDivergence && sentimentGateShort && mode !== 'long_term') {
        shortTriggered = true;
        shortReason = 'Bearish RSI Divergence';
        shortConfidence = 'MEDIUM';
    }

    if (shortTriggered) {
        // Volume confirmation upgrades confidence
        if (volumeSpike && shortConfidence === 'MEDIUM') shortConfidence = 'HIGH';
        if (volumeAboveAvg) shortReason += ' + Volume Confirmed';
        if (volumeSpike) shortReason += ' (Spike)';

        const exits = calculateExits('SHORT', latest.close, atr);
        return {
            action: 'SHORT',
            reason: shortReason,
            confidence: shortConfidence,
            patterns: mode !== 'long_term' ? patterns : [],
            signalStatus: 'FORMING',
            ...exits
        };
    }

    // 3. WAIT signals
    return { action: 'WAIT', reason: 'No clear signal', confidence: 'LOW', patterns };
};
