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

export const getTradeSignal = (data: StockDataPoint[], mode: 'swing' | 'scalp' | 'long_term' = 'swing', sentimentLab: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral', nextEarnings?: string | null): TradeRecommendation => {
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


    // ── Trend detection ──────────────────────────────────────────────────
    let isUptrend = false;
    let isDowntrend = false;
    let trendReason = '';

    if (mode === 'scalp') {
        // Price above EMA50 AND short-term EMAs bullishly aligned
        isUptrend   = latest.close > (latest.ema50 || 0) && (latest.ema9 || 0) > (latest.ema21 || 0);
        isDowntrend = latest.close < (latest.ema50 || 0) && (latest.ema9 || 0) < (latest.ema21 || 0);
        trendReason = 'Uptrend (EMA Aligned)';
    } else if (mode === 'swing') {
        isUptrend   = latest.close > (latest.sma50 || 0) && (latest.sma50 || 0) > (latest.sma200 || 0);
        isDowntrend = latest.close < (latest.sma50 || 0) && (latest.sma50 || 0) < (latest.sma200 || 0);
        trendReason = 'Strong Uptrend (MA Alignment)';
    } else {
        // Long-term: require full alignment (price > SMA50 > SMA200)
        isUptrend   = latest.close > (latest.sma50 || 0) && (latest.sma50 || 0) > (latest.sma200 || 0);
        isDowntrend = latest.close < (latest.sma50 || 0) && (latest.sma50 || 0) < (latest.sma200 || 0);
        trendReason = 'Secular Uptrend (SMA50 > SMA200)';
    }

    // ── ADX trend-strength gate (>20 = trending, <20 = choppy range) ─────
    const adxValue = latest.adx;
    const trendIsStrong = !adxValue || adxValue > 20;

    // ── RSI ───────────────────────────────────────────────────────────────
    const rsi = latest.rsi14 || 50;
    const slowRsi = latest.rsi70 || 50;
    const isOversold  = mode === 'long_term' ? (slowRsi < 40 && rsi < 35) : rsi < 30;
    const isOverbought = mode === 'long_term' ? (slowRsi > 65 && rsi > 70) : rsi > 70;

    // ── MACD: require cross AND growing separation (no whipsaw zero-touches) ─
    const macdHist     = latest.macd?.histogram || 0;
    const prevMacdHist = prev.macd?.histogram   || 0;
    const macdLine     = latest.macd?.MACD       || 0;
    const macdSigLine  = latest.macd?.signal     || 0;

    const macdBullishCross    = macdHist > 0 && prevMacdHist <= 0;
    const macdBullishMomentum = macdHist > 0 && macdLine > macdSigLine && macdHist > prevMacdHist && prevMacdHist > 0;
    const macdBullish = macdBullishCross || macdBullishMomentum;

    const macdBearishCross    = macdHist < 0 && prevMacdHist >= 0;
    const macdBearishMomentum = macdHist < 0 && macdLine < macdSigLine && macdHist < prevMacdHist && prevMacdHist < 0;
    const macdBearish = macdBearishCross || macdBearishMomentum;

    // ── Special long-term triggers ────────────────────────────────────────
    const isGoldenCross = (latest.sma50 || 0) > (latest.sma200 || 0) && (prev.sma50 || 0) <= (prev.sma200 || 0);
    const isDeathCross  = (latest.sma50 || 0) < (latest.sma200 || 0) && (prev.sma50 || 0) >= (prev.sma200 || 0);

    // ── EMA 9/21 cross (scalp momentum signal) ────────────────────────────
    const ema9BullishCross = (latest.ema9 || 0) > (latest.ema21 || 0) && (prev.ema9 || 0) <= (prev.ema21 || 0);
    const ema9BearishCross = (latest.ema9 || 0) < (latest.ema21 || 0) && (prev.ema9 || 0) >= (prev.ema21 || 0);

    // ── Stochastic RSI (0-1 scale): K crossing D in oversold/overbought zone ─
    const stochK     = latest.stochRsi?.k ?? -1;
    const stochD     = latest.stochRsi?.d ?? -1;
    const prevStochK = prev.stochRsi?.k   ?? -1;
    const prevStochD = prev.stochRsi?.d   ?? -1;
    const stochBullish = stochK >= 0 && stochK < 0.2  && stochD >= 0 && stochK > stochD && prevStochK <= prevStochD;
    const stochBearish = stochK >= 0 && stochK > 0.8  && stochD >= 0 && stochK < stochD && prevStochK >= prevStochD;

    // ── RSI Divergence (15-bar lookback, ATR-adaptive price tolerance) ────
    // Volatile assets (BTC, oil) need wider tolerance; calm stocks need tighter.
    // Half-ATR acts as a volatility-scaled "near the extreme" window.
    let bullishDivergence = false;
    let bearishDivergence = false;
    if (data.length >= 15) {
        const lookback = data.slice(-15);
        const priceMin = Math.min(...lookback.map(d => d.low));
        const priceMax = Math.max(...lookback.map(d => d.high));
        const rsiValues = lookback.map(d => d.rsi14).filter((v): v is number => v !== undefined);
        if (rsiValues.length >= 10) {
            const rsiMin = Math.min(...rsiValues);
            const rsiMax = Math.max(...rsiValues);
            const atrRef = latest.atr || (latest.high - latest.low);
            const tol = atrRef * 0.5;
            if (latest.low <= priceMin + tol && (latest.rsi14 || 50) > rsiMin + 8) bullishDivergence = true;
            if (latest.high >= priceMax - tol && (latest.rsi14 || 50) < rsiMax - 8) bearishDivergence = true;
        }
    }

    // ── Volume ─────────────────────────────────────────────────────────────
    const hasVolData   = (latest.volumeSma20 || 0) > 0;
    const volumeAboveAvg = !hasVolData || latest.volume > (latest.volumeSma20 || 0) * 1.0;
    const volumeSpike    =  hasVolData && latest.volume > (latest.volumeSma20 || 0) * 1.5;
    // Volume gate: require at least average volume for MEDIUM/HIGH signals
    const volumeGate = !hasVolData || volumeAboveAvg;

    // ── Earnings gate: cap confidence if earnings within 2 days ───────────
    let nearEarnings = false;
    if (nextEarnings) {
        const daysUntil = Math.ceil((new Date(nextEarnings).getTime() - Date.now()) / 86_400_000);
        nearEarnings = daysUntil >= 0 && daysUntil <= 2;
    }

    // ── ATR-based exits anchored to swing low/high ─────────────────────────
    const atr = latest.atr || (latest.high - latest.low);
    const calculateExits = (action: 'LONG' | 'SHORT', price: number, atrValue: number) => {
        const slMult = mode === 'scalp' ? 1.0 : mode === 'swing' ? 2.0 : 5.0;
        const tpMult = mode === 'scalp' ? 2.0 : mode === 'swing' ? 4.0 : 15.0;

        if (mode !== 'long_term') {
            const bars = mode === 'scalp' ? 10 : 20;
            const recent = data.slice(-bars);
            const swingLow  = Math.min(...recent.map(d => d.low));
            const swingHigh = Math.max(...recent.map(d => d.high));
            if (action === 'LONG') return {
                stopLoss:   Math.min(price - atrValue * slMult, swingLow - atrValue * 0.5),
                takeProfit: price + atrValue * tpMult,
            };
            return {
                stopLoss:   Math.max(price + atrValue * slMult, swingHigh + atrValue * 0.5),
                takeProfit: price - atrValue * tpMult,
            };
        }
        return action === 'LONG'
            ? { stopLoss: price - atrValue * slMult, takeProfit: price + atrValue * tpMult }
            : { stopLoss: price + atrValue * slMult, takeProfit: price - atrValue * tpMult };
    };

    // ── Confidence from confirmation count ────────────────────────────────
    const getConfidence = (count: number): 'HIGH' | 'MEDIUM' | 'LOW' => {
        if (count >= 3) return 'HIGH';
        if (count >= 2) return 'MEDIUM';
        return 'LOW';
    };

    const applyEarningsGate = (conf: 'HIGH' | 'MEDIUM' | 'LOW', reason: string): ['HIGH' | 'MEDIUM' | 'LOW', string] =>
        nearEarnings ? ['LOW', reason + ' ⚠️ Earnings Soon'] : [conf, reason];

    // R:R gate: reject signals where risk/reward ratio is below 1.5
    const meetsRR = (action: 'LONG' | 'SHORT', price: number, sl: number, tp: number): boolean => {
        const risk   = Math.abs(price - sl);
        const reward = Math.abs(tp - price);
        if (risk <= 0) return true;
        return reward / risk >= 1.5;
    };

    // ── 1. LONG signals ────────────────────────────────────────────────────
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
    } else {
        // Bollinger bounce confirmation: prev bar touched/broke lower band AND
        // latest bar closes back inside with bullish reversal — filters out
        // "band riding" trends that keep closing on the lower band.
        const bbLowerHit = latest.bb?.lower && prev.bb?.lower
            ? (prev.low <= prev.bb.lower && latest.close > prev.close && latest.close > latest.bb.lower)
            : false;
        const bullishSignals = [isOversold, macdBullish, bbLowerHit, hasBullishPattern, stochBullish,
            mode === 'scalp' ? ema9BullishCross : false].filter(Boolean).length;

        if (isUptrend && trendIsStrong && bullishSignals >= 1 && sentimentGateLong && volumeGate) {
            longTriggered = true;
            if (isOversold) longReason += ' + RSI Oversold';
            if (macdBullish) longReason += macdBullishCross ? ' + MACD Bullish Cross' : ' + MACD Momentum';
            if (bbLowerHit) longReason += ' + Bollinger Lower Hit';
            if (hasBullishPattern) longReason += ` + ${patterns.join(', ')}`;
            if (stochBullish) longReason += ' + Stoch RSI Cross';
            if (mode === 'scalp' && ema9BullishCross) longReason += ' + EMA 9/21 Cross';
            longConfidence = getConfidence(bullishSignals + (volumeSpike ? 1 : 0));
        }
    }

    if (!longTriggered && bullishDivergence && sentimentGateLong && mode !== 'long_term') {
        longTriggered = true;
        longReason = 'Bullish RSI Divergence';
        longConfidence = volumeAboveAvg ? 'MEDIUM' : 'LOW';
    }

    if (longTriggered) {
        if (volumeSpike) longReason += ' + Volume Spike';
        else if (volumeAboveAvg && !longReason.includes('Volume')) longReason += ' + Volume OK';
        const [conf, reason] = applyEarningsGate(longConfidence, longReason);
        const exits = calculateExits('LONG', latest.close, atr);
        if (!meetsRR('LONG', latest.close, exits.stopLoss, exits.takeProfit)) {
            // Poor risk/reward — skip this signal
        } else {
            return { action: 'LONG', reason, confidence: conf, patterns: mode !== 'long_term' ? patterns : [], signalStatus: 'FORMING', ...exits };
        }
    }

    // ── 2. SHORT signals ───────────────────────────────────────────────────
    const hasBearishPattern = patterns.some(p => ['Bearish Engulfing', 'Shooting Star', 'Evening Star'].includes(p));
    const sentimentGateShort = sentimentLab !== 'Bullish';

    let shortTriggered = false;
    let shortReason = mode === 'swing' ? 'Strong Downtrend (MA Alignment)' : mode === 'long_term' ? 'Secular Downtrend (< SMA200)' : 'Downtrend (EMA Aligned)';
    let shortConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

    if (mode === 'long_term') {
        if (isDowntrend && (isDeathCross || isOverbought) && sentimentGateShort) {
            shortTriggered = true;
            if (isDeathCross) shortReason += ' + DEATH CROSS';
            if (isOverbought) shortReason += ' + Overbought Exhaustion';
            shortConfidence = isDeathCross ? 'HIGH' : 'MEDIUM';
        }
    } else {
        // Mirror of bullish: prev touched/broke upper band, latest reverses down
        const bbUpperHit = latest.bb?.upper && prev.bb?.upper
            ? (prev.high >= prev.bb.upper && latest.close < prev.close && latest.close < latest.bb.upper)
            : false;
        const bearishSignals = [isOverbought, macdBearish, bbUpperHit, hasBearishPattern, stochBearish,
            mode === 'scalp' ? ema9BearishCross : false].filter(Boolean).length;

        if (isDowntrend && trendIsStrong && bearishSignals >= 1 && sentimentGateShort && volumeGate) {
            shortTriggered = true;
            if (isOverbought) shortReason += ' + RSI Overbought';
            if (macdBearish) shortReason += macdBearishCross ? ' + MACD Bearish Cross' : ' + MACD Momentum';
            if (bbUpperHit) shortReason += ' + Bollinger Upper Hit';
            if (hasBearishPattern) shortReason += ` + ${patterns.join(', ')}`;
            if (stochBearish) shortReason += ' + Stoch RSI Cross';
            if (mode === 'scalp' && ema9BearishCross) shortReason += ' + EMA 9/21 Cross';
            shortConfidence = getConfidence(bearishSignals + (volumeSpike ? 1 : 0));
        }
    }

    if (!shortTriggered && bearishDivergence && sentimentGateShort && mode !== 'long_term') {
        shortTriggered = true;
        shortReason = 'Bearish RSI Divergence';
        shortConfidence = volumeAboveAvg ? 'MEDIUM' : 'LOW';
    }

    if (shortTriggered) {
        if (volumeSpike) shortReason += ' + Volume Spike';
        else if (volumeAboveAvg && !shortReason.includes('Volume')) shortReason += ' + Volume OK';
        const [conf, reason] = applyEarningsGate(shortConfidence, shortReason);
        const exits = calculateExits('SHORT', latest.close, atr);
        if (!meetsRR('SHORT', latest.close, exits.stopLoss, exits.takeProfit)) {
            // Poor risk/reward — skip this signal
        } else {
            return { action: 'SHORT', reason, confidence: conf, patterns: mode !== 'long_term' ? patterns : [], signalStatus: 'FORMING', ...exits };
        }
    }

    // ── 3. WAIT ────────────────────────────────────────────────────────────
    return { action: 'WAIT', reason: 'No clear signal', confidence: 'LOW', patterns };
};
