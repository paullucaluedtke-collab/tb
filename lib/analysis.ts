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
    signalStatus?: 'CONFIRMED' | 'FORMING';
}

export const getTradeSignal = (data: StockDataPoint[], mode: 'swing' | 'scalp' | 'long_term' = 'swing', sentimentLab: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral', nextEarnings?: string | null): TradeRecommendation => {
    if (data.length < 50) {
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
    if (ti.threewhitesoldiers) checkPattern(ti.threewhitesoldiers, 'Three White Soldiers');

    // Bearish Patterns
    if (ti.bearishengulfingpattern) checkPattern(ti.bearishengulfingpattern, 'Bearish Engulfing');
    if (ti.shootingstar) checkPattern(ti.shootingstar, 'Shooting Star');
    if (ti.eveningstar) checkPattern(ti.eveningstar, 'Evening Star');
    if (ti.threeblackcrows) checkPattern(ti.threeblackcrows, 'Three Black Crows');

    // ── Trend detection ──────────────────────────────────────────────────
    let isUptrend = false;
    let isDowntrend = false;
    let trendReason = '';

    const sma50  = latest.sma50 || 0;
    const sma200 = latest.sma200 || 0;
    const ema9v  = latest.ema9 || 0;
    const ema21v = latest.ema21 || 0;
    const ema50v = latest.ema50 || 0;
    const hasSma200 = sma200 > 0 && data.length >= 200;

    if (mode === 'scalp') {
        isUptrend   = latest.close > ema21v && ema9v > ema21v;
        isDowntrend = latest.close < ema21v && ema9v < ema21v;
        trendReason = 'Uptrend (EMA Aligned)';
    } else if (mode === 'swing') {
        if (hasSma200) {
            isUptrend   = latest.close > sma50 && sma50 > sma200;
            isDowntrend = latest.close < sma50 && sma50 < sma200;
        } else {
            isUptrend   = latest.close > sma50 && latest.close > ema21v;
            isDowntrend = latest.close < sma50 && latest.close < ema21v;
        }
        trendReason = 'Uptrend (MA Alignment)';
    } else {
        if (hasSma200) {
            isUptrend   = latest.close > sma50 && sma50 > sma200;
            isDowntrend = latest.close < sma50 && sma50 < sma200;
        } else {
            isUptrend   = latest.close > sma50;
            isDowntrend = latest.close < sma50;
        }
        trendReason = 'Secular Uptrend (SMA50 > SMA200)';
    }

    // ── ADX trend-strength (soft gate: low ADX reduces confidence, doesn't block) ──
    const adxValue = latest.adx;
    const trendIsStrong = !adxValue || adxValue > 20;

    // ── RSI (standard thresholds) ────────────────────────────────────────
    const rsi = latest.rsi14 || 50;
    const slowRsi = latest.rsi70 || 50;
    const isOversold  = mode === 'long_term' ? (slowRsi < 35 || rsi < 32) : rsi < 32;
    const isOverbought = mode === 'long_term' ? (slowRsi > 65 || rsi > 68) : rsi > 68;
    // RSI supportive zones for trend-following (not extreme in either direction)
    const rsiSupportsBull = rsi > 35 && rsi < 75;
    const rsiSupportsBear = rsi < 65 && rsi > 25;

    // ── MACD: cross, momentum, or aligned direction ─────────────────────
    const macdHist     = latest.macd?.histogram || 0;
    const prevMacdHist = prev.macd?.histogram   || 0;
    const atrRef = latest.atr || (latest.high - latest.low) || 1;
    const macdMinMag = atrRef * 0.01;

    const macdBullishCross    = macdHist > macdMinMag && prevMacdHist <= 0;
    const macdBullishMomentum = macdHist > macdMinMag && macdHist > prevMacdHist && prevMacdHist > 0;
    const macdBullishAligned  = macdHist > 0;
    const macdBullish = macdBullishCross || macdBullishMomentum;

    const macdBearishCross    = macdHist < -macdMinMag && prevMacdHist >= 0;
    const macdBearishMomentum = macdHist < -macdMinMag && macdHist < prevMacdHist && prevMacdHist < 0;
    const macdBearishAligned  = macdHist < 0;
    const macdBearish = macdBearishCross || macdBearishMomentum;

    // ── Special long-term triggers ───────────────────────────────────────
    const isGoldenCross = hasSma200 && sma50 > sma200 && (prev.sma50 || 0) <= (prev.sma200 || 0);
    const isDeathCross  = hasSma200 && sma50 < sma200 && (prev.sma50 || 0) >= (prev.sma200 || 0);

    // ── EMA 9/21 cross ──────────────────────────────────────────────────
    const ema9BullishCross = ema9v > ema21v && (prev.ema9 || 0) <= (prev.ema21 || 0);
    const ema9BearishCross = ema9v < ema21v && (prev.ema9 || 0) >= (prev.ema21 || 0);
    const ema9AboveEma21 = ema9v > ema21v;
    const ema9BelowEma21 = ema9v < ema21v;

    // ── Stochastic RSI (0-100 scale from library): K crossing D in extreme zones
    const stochK     = latest.stochRsi?.k ?? -1;
    const stochD     = latest.stochRsi?.d ?? -1;
    const prevStochK = prev.stochRsi?.k   ?? -1;
    const prevStochD = prev.stochRsi?.d   ?? -1;
    const stochBullish = stochK >= 0 && stochK < 25 && stochD >= 0
        && prevStochK <= prevStochD && stochK > stochD;
    const stochBearish = stochK >= 0 && stochK > 75 && stochD >= 0
        && prevStochK >= prevStochD && stochK < stochD;
    const stochOversold  = stochK >= 0 && stochK < 20;
    const stochOverbought = stochK >= 0 && stochK > 80;

    // ── Pullback to moving average support/resistance ───────────────────
    const pullbackToBullMA = latest.close > sma50 && latest.low <= ema21v * 1.01 && latest.close > ema21v;
    const pullbackToBearMA = latest.close < sma50 && latest.high >= ema21v * 0.99 && latest.close < ema21v;

    // ── Trend alignment: EMAs stacked in order (doesn't require close > ema9 exactly)
    const bullTrendAligned = ema9v > ema21v;
    const bearTrendAligned = ema9v < ema21v;

    // ── Price closing above/below key level ─────────────────────────────
    const closeAboveSma50 = latest.close > sma50 && prev.close <= (prev.sma50 || sma50);
    const closeBelowSma50 = latest.close < sma50 && prev.close >= (prev.sma50 || sma50);

    // ── RSI Divergence (timing-aligned, ATR-adaptive) ────────────────────
    let bullishDivergence = false;
    let bearishDivergence = false;
    if (data.length >= 20) {
        const lookback = data.slice(-20);
        const tol = atrRef * 0.5;

        let minPriceIdx = 0, minRsiIdx = 0, maxPriceIdx = 0, maxRsiIdx = 0;
        for (let i = 0; i < lookback.length - 1; i++) {
            if (lookback[i].low < lookback[minPriceIdx].low) minPriceIdx = i;
            if ((lookback[i].rsi14 ?? 99) < (lookback[minRsiIdx].rsi14 ?? 99)) minRsiIdx = i;
            if (lookback[i].high > lookback[maxPriceIdx].high) maxPriceIdx = i;
            if ((lookback[i].rsi14 ?? 0) > (lookback[maxRsiIdx].rsi14 ?? 0)) maxRsiIdx = i;
        }

        const priceAtNewLow = latest.low <= lookback[minPriceIdx].low + tol;
        const rsiHigherLow = (latest.rsi14 || 50) > (lookback[minRsiIdx].rsi14 || 50) + 3;
        if (priceAtNewLow && rsiHigherLow && Math.abs(minPriceIdx - minRsiIdx) >= 2) {
            bullishDivergence = true;
        }

        const priceAtNewHigh = latest.high >= lookback[maxPriceIdx].high - tol;
        const rsiLowerHigh = (latest.rsi14 || 50) < (lookback[maxRsiIdx].rsi14 || 50) - 3;
        if (priceAtNewHigh && rsiLowerHigh && Math.abs(maxPriceIdx - maxRsiIdx) >= 2) {
            bearishDivergence = true;
        }
    }

    // ── Volume: used for confidence only, never as a hard gate ──────────
    const hasVolData   = (latest.volumeSma20 || 0) > 0;
    const volumeAboveAvg = hasVolData && latest.volume > (latest.volumeSma20 || 0);
    const volumeSpike    = hasVolData && latest.volume > (latest.volumeSma20 || 0) * 1.8;

    // ── Earnings gate: BLOCK signals within 2 days of earnings ───────────
    if (nextEarnings) {
        const daysUntil = Math.ceil((new Date(nextEarnings).getTime() - Date.now()) / 86_400_000);
        if (daysUntil >= 0 && daysUntil <= 2) {
            return { action: 'WAIT', reason: 'Earnings within 2 days', confidence: 'LOW', patterns };
        }
    }

    // ── ATR-based exits — pure multipliers guarantee consistent R:R ──────
    const atr = atrRef;
    const calculateExits = (action: 'LONG' | 'SHORT', price: number, atrValue: number) => {
        const slMult = mode === 'scalp' ? 1.2 : mode === 'swing' ? 1.8 : 3.0;
        const tpMult = mode === 'scalp' ? 2.4 : mode === 'swing' ? 3.5 : 8.0;
        return action === 'LONG'
            ? { stopLoss: price - atrValue * slMult, takeProfit: price + atrValue * tpMult }
            : { stopLoss: price + atrValue * slMult, takeProfit: price - atrValue * tpMult };
    };

    // ── Confidence from confirmation count ───────────────────────────────
    const getConfidence = (count: number, strong: boolean): 'HIGH' | 'MEDIUM' | 'LOW' => {
        if (count >= 4 || (count >= 3 && strong)) return 'HIGH';
        if (count >= 2) return 'MEDIUM';
        return 'LOW';
    };

    // R:R gate: reject signals where risk/reward < 1.3 or risk is zero
    const meetsRR = (price: number, sl: number, tp: number): boolean => {
        const risk   = Math.abs(price - sl);
        const reward = Math.abs(tp - price);
        if (risk <= 0) return false;
        return reward / risk >= 1.3;
    };

    // ── 1. LONG signals ──────────────────────────────────────────────────
    const hasBullishPattern = patterns.some(p =>
        ['Bullish Engulfing', 'Hammer', 'Morning Star', 'Three White Soldiers'].includes(p));
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
        const bbMid = latest.bb?.middle ?? 0;
        const bbLowerHit = latest.bb?.lower && prev.bb?.lower
            ? (prev.low <= prev.bb.lower && latest.close > prev.close && latest.close > bbMid)
            : false;

        const bullishSignals = [
            isOversold,
            macdBullish,
            bbLowerHit,
            hasBullishPattern,
            stochBullish || stochOversold,
            pullbackToBullMA,
            closeAboveSma50,
            mode === 'scalp' ? ema9BullishCross : false,
        ].filter(Boolean).length;

        if (isUptrend && bullishSignals >= 2 && sentimentGateLong) {
            longTriggered = true;
            if (isOversold) longReason += ' + RSI Oversold';
            if (macdBullish) longReason += macdBullishCross ? ' + MACD Bullish Cross' : ' + MACD Momentum';
            if (bbLowerHit) longReason += ' + Bollinger Bounce';
            if (hasBullishPattern) longReason += ` + ${patterns.join(', ')}`;
            if (stochBullish) longReason += ' + Stoch RSI Cross';
            else if (stochOversold) longReason += ' + Stoch Oversold';
            if (pullbackToBullMA) longReason += ' + MA Pullback';
            if (closeAboveSma50) longReason += ' + SMA50 Breakout';
            if (mode === 'scalp' && ema9BullishCross) longReason += ' + EMA 9/21 Cross';
            longConfidence = getConfidence(bullishSignals + (volumeSpike ? 1 : 0), trendIsStrong && bullTrendAligned);
        }

        // Trend-following: uptrend + EMA9 > EMA21, only block when RSI is truly extreme (>82)
        if (!longTriggered && isUptrend && bullTrendAligned && rsi < 82 && sentimentGateLong) {
            longTriggered = true;
            longReason = 'Trend Continuation (EMA Aligned)';
            if (macdBullishAligned) longReason += ' + MACD Positive';
            if (trendIsStrong) longReason += ' + ADX Strong';
            if (pullbackToBullMA) longReason += ' + MA Pullback';
            if (hasBullishPattern) longReason += ` + ${patterns.join(', ')}`;
            longConfidence = (trendIsStrong && macdBullishAligned) ? 'MEDIUM' : 'LOW';
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
        const exits = calculateExits('LONG', latest.close, atr);
        if (meetsRR(latest.close, exits.stopLoss, exits.takeProfit)) {
            return { action: 'LONG', reason: longReason, confidence: longConfidence, patterns: mode !== 'long_term' ? patterns : [], signalStatus: 'FORMING', ...exits };
        }
    }

    // ── 2. SHORT signals ─────────────────────────────────────────────────
    const hasBearishPattern = patterns.some(p =>
        ['Bearish Engulfing', 'Shooting Star', 'Evening Star', 'Three Black Crows'].includes(p));
    const sentimentGateShort = sentimentLab !== 'Bullish';

    let shortTriggered = false;
    let shortReason = mode === 'swing' ? 'Downtrend (MA Alignment)' : mode === 'long_term' ? 'Secular Downtrend (< SMA200)' : 'Downtrend (EMA Aligned)';
    let shortConfidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

    if (mode === 'long_term') {
        if (isDowntrend && (isDeathCross || isOverbought) && sentimentGateShort) {
            shortTriggered = true;
            if (isDeathCross) shortReason += ' + DEATH CROSS';
            if (isOverbought) shortReason += ' + Overbought Exhaustion';
            shortConfidence = isDeathCross ? 'HIGH' : 'MEDIUM';
        }
    } else {
        const bbMidShort = latest.bb?.middle ?? latest.close;
        const bbUpperHit = latest.bb?.upper && prev.bb?.upper
            ? (prev.high >= prev.bb.upper && latest.close < prev.close && latest.close < bbMidShort)
            : false;

        const bearishSignals = [
            isOverbought,
            macdBearish,
            bbUpperHit,
            hasBearishPattern,
            stochBearish || stochOverbought,
            pullbackToBearMA,
            closeBelowSma50,
            mode === 'scalp' ? ema9BearishCross : false,
        ].filter(Boolean).length;

        if (isDowntrend && bearishSignals >= 2 && sentimentGateShort) {
            shortTriggered = true;
            if (isOverbought) shortReason += ' + RSI Overbought';
            if (macdBearish) shortReason += macdBearishCross ? ' + MACD Bearish Cross' : ' + MACD Momentum';
            if (bbUpperHit) shortReason += ' + Bollinger Bounce';
            if (hasBearishPattern) shortReason += ` + ${patterns.join(', ')}`;
            if (stochBearish) shortReason += ' + Stoch RSI Cross';
            else if (stochOverbought) shortReason += ' + Stoch Overbought';
            if (pullbackToBearMA) shortReason += ' + MA Pullback';
            if (closeBelowSma50) shortReason += ' + SMA50 Breakdown';
            if (mode === 'scalp' && ema9BearishCross) shortReason += ' + EMA 9/21 Cross';
            shortConfidence = getConfidence(bearishSignals + (volumeSpike ? 1 : 0), trendIsStrong && bearTrendAligned);
        }

        // Trend-following: downtrend + EMA9 < EMA21, only block when RSI is truly extreme (<18)
        if (!shortTriggered && isDowntrend && bearTrendAligned && rsi > 18 && sentimentGateShort) {
            shortTriggered = true;
            shortReason = 'Trend Continuation Down (EMA Aligned)';
            if (macdBearishAligned) shortReason += ' + MACD Negative';
            if (trendIsStrong) shortReason += ' + ADX Strong';
            if (pullbackToBearMA) shortReason += ' + MA Pullback';
            if (hasBearishPattern) shortReason += ` + ${patterns.join(', ')}`;
            shortConfidence = (trendIsStrong && macdBearishAligned) ? 'MEDIUM' : 'LOW';
        }
    }

    // Divergence only fires if NOT in a clear uptrend (avoids fading strong momentum)
    if (!shortTriggered && bearishDivergence && !isUptrend && sentimentGateShort && mode !== 'long_term') {
        shortTriggered = true;
        shortReason = 'Bearish RSI Divergence';
        shortConfidence = volumeAboveAvg ? 'MEDIUM' : 'LOW';
    }

    if (shortTriggered) {
        if (volumeSpike) shortReason += ' + Volume Spike';
        else if (volumeAboveAvg && !shortReason.includes('Volume')) shortReason += ' + Volume OK';
        const exits = calculateExits('SHORT', latest.close, atr);
        if (meetsRR(latest.close, exits.stopLoss, exits.takeProfit)) {
            return { action: 'SHORT', reason: shortReason, confidence: shortConfidence, patterns: mode !== 'long_term' ? patterns : [], signalStatus: 'FORMING', ...exits };
        }
    }

    // ── 3. WAIT ──────────────────────────────────────────────────────────
    return { action: 'WAIT', reason: 'No clear signal', confidence: 'LOW', patterns };
};
