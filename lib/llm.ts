import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export type AIAction = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SCALE_IN' | 'TRIM' | 'SELL' | 'WAIT';

export interface AIAnalysisResult {
    score: number;
    action: AIAction;
    summary: string;
    reasoning: string;
    timing: string;
    risks: string;
    keyLevels?: {
        support: number | null;
        resistance: number | null;
        idealEntry: number | null;
    };
    positionAdvice?: string;
    catalysts?: string;
    conviction: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PositionContext {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    quantity: number;
    pnlPercent: number;
    holdingDays: number;
}

export interface TechnicalContext {
    price: number;
    change: number;
    rsi?: number;
    macdSignal?: 'bullish' | 'bearish' | 'neutral';
    trend?: 'uptrend' | 'downtrend' | 'sideways';
    sma50?: number;
    sma200?: number;
    atr?: number;
    volume?: string;
    stopLoss?: number;
    takeProfit?: number;
}

export async function analyzeWithClaude(
    text: string,
    symbol: string,
    geoContext?: string,
    position?: PositionContext,
    technicals?: TechnicalContext,
): Promise<AIAnalysisResult> {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('Missing ANTHROPIC_API_KEY');
    }

    const geoSection = geoContext
        ? `\n\nGlobal Macro & Geopolitical Context:\n${geoContext}`
        : '';

    const techSection = technicals ? `
Current Technical Snapshot for ${symbol}:
- Price: $${technicals.price.toFixed(2)} (${technicals.change >= 0 ? '+' : ''}${technicals.change.toFixed(2)}%)
${technicals.rsi != null ? `- RSI(14): ${technicals.rsi.toFixed(1)}${technicals.rsi > 70 ? ' ⚠ OVERBOUGHT' : technicals.rsi < 30 ? ' ⚠ OVERSOLD' : ''}` : ''}
${technicals.macdSignal ? `- MACD: ${technicals.macdSignal.toUpperCase()} signal` : ''}
${technicals.trend ? `- Trend: ${technicals.trend.toUpperCase()}` : ''}
${technicals.sma50 ? `- SMA50: $${technicals.sma50.toFixed(2)}${technicals.price > technicals.sma50 ? ' (price ABOVE)' : ' (price BELOW)'}` : ''}
${technicals.sma200 ? `- SMA200: $${technicals.sma200.toFixed(2)}${technicals.price > technicals.sma200 ? ' (price ABOVE)' : ' (price BELOW)'}` : ''}
${technicals.atr ? `- ATR(14): $${technicals.atr.toFixed(2)} (${((technicals.atr / technicals.price) * 100).toFixed(1)}% daily volatility)` : ''}
${technicals.volume ? `- Volume: ${technicals.volume}` : ''}
${technicals.stopLoss ? `- Signal Stop Loss: $${technicals.stopLoss.toFixed(2)}` : ''}
${technicals.takeProfit ? `- Signal Take Profit: $${technicals.takeProfit.toFixed(2)}` : ''}` : '';

    const positionSection = position ? `
⚠ ACTIVE POSITION — Trader is currently INVESTED:
- Side: ${position.side}
- Entry Price: $${position.entryPrice.toFixed(2)}
- Current P&L: ${position.pnlPercent >= 0 ? '+' : ''}${position.pnlPercent.toFixed(2)}%
- Holding Duration: ${position.holdingDays} day(s)

IMPORTANT: Since the trader has an open ${position.side} position, your analysis MUST address:
1. Should they HOLD, SCALE_IN (add to position), TRIM (partial profit), or SELL (close entirely)?
2. Where should they move their stop loss? (Trail it?)
3. Is the original thesis still intact?
4. Are there new risks that change the outlook?` : '';

    const actionOptions = position
        ? '"HOLD" (keep position), "SCALE_IN" (add more), "TRIM" (take partial profit), "SELL" (close position), "WAIT" (no action yet)'
        : '"STRONG_BUY" (score 8+, high conviction entry), "BUY" (good entry), "SELL" (short opportunity or avoid), "WAIT" (no edge, wait for better setup)';

    const systemPrompt = `You are an elite institutional trading analyst combining fundamental catalysts with technical analysis. You provide the MOST actionable, specific, and data-driven trading intelligence available. Be decisive and direct — ambiguity costs money.

Your analysis framework:
1. CATALYST ASSESSMENT: What specific events (earnings, FDA, macro, sector rotation) could move this stock 5%+ in 1-4 weeks?
2. TECHNICAL CONFLUENCE: Do the technicals confirm or contradict the fundamental story? Look for RSI divergences, volume anomalies, key level breaks.
3. RISK/REWARD MATH: What's the realistic upside vs downside from current price? Quantify it.
4. TIMING PRECISION: Is NOW the right moment, or should the trader wait for a specific price level or event?
5. POSITION MANAGEMENT: If already invested, focus on optimizing the existing position — not just entry.

Scoring Guide (be honest, most trades are 4-6):
- 9-10: Exceptional — multiple catalysts aligned, technical breakout, strong R:R (rare, <5% of cases)
- 7-8: Good entry — clear catalyst + technical setup, R:R > 2:1
- 5-6: Neutral — mixed signals, no clear edge
- 3-4: Poor timing — headwinds, broken technicals, better entry exists
- 1-2: Avoid — strong reasons to stay away

Available actions: ${actionOptions}

CRITICAL: Output ONLY valid JSON. No markdown. No text outside JSON.`;

    const userMessage = position
        ? `Analyze "${symbol}" — I have an ACTIVE ${position.side} position.
${positionSection}
${techSection}

Based on the latest news and data, should I hold, add, trim, or close?

Output JSON:
- "score" (1-10: how good is the current situation for my position?)
- "action" ("HOLD" | "SCALE_IN" | "TRIM" | "SELL" | "WAIT")
- "summary" (2-3 sentences: current situation assessment for someone already invested)
- "reasoning" (bullet points: what supports/threatens the position now)
- "timing" (1-2 sentences: what to do RIGHT NOW and what to watch for next)
- "risks" (1-2 sentences: biggest threat to the position)
- "keyLevels" (object: {"support": number|null, "resistance": number|null, "idealEntry": number|null} — price levels to watch)
- "positionAdvice" (1-2 sentences: specific stop adjustment / profit target advice)
- "catalysts" (1 sentence: next major catalyst and date if known)
- "conviction" ("HIGH" | "MEDIUM" | "LOW")

News & Context:
${text}${geoSection}`
        : `Is NOW a good time to trade "${symbol}"?
${techSection}

Output JSON:
- "score" (1-10: entry quality, NOT just sentiment)
- "action" ("STRONG_BUY" | "BUY" | "SELL" | "WAIT")
- "summary" (2-3 sentences: setup quality + what makes this tradeable or not)
- "reasoning" (bullet points: catalysts, technical levels, volume, sentiment factors)
- "timing" (1-2 sentences: specific entry advice — price level, event to wait for, or "enter now because X")
- "risks" (1-2 sentences: primary risk and what would invalidate the trade)
- "keyLevels" (object: {"support": number|null, "resistance": number|null, "idealEntry": number|null})
- "catalysts" (1 sentence: next major catalyst and date if known)
- "conviction" ("HIGH" | "MEDIUM" | "LOW")

News & Context:
${text}${geoSection}`;

    try {
        const message = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1200,
            temperature: 0,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }]
        });

        const responseContent = message.content[0].type === 'text' ? message.content[0].text : '';

        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error(`[AI ERROR] Invalid Format for ${symbol}. Raw:`, responseContent);
            throw new Error(`Invalid AI response format. Raw length: ${responseContent.length}`);
        }

        const result = JSON.parse(jsonMatch[0]);
        const validActions: AIAction[] = ['STRONG_BUY', 'BUY', 'HOLD', 'SCALE_IN', 'TRIM', 'SELL', 'WAIT'];
        const parsedAction = (result.action || '').toUpperCase();

        return {
            score: Math.max(0, Math.min(10, result.score || 5)),
            action: validActions.includes(parsedAction as AIAction) ? parsedAction as AIAction : 'WAIT',
            summary: result.summary || "Analysis completed.",
            reasoning: result.reasoning || "No reasoning provided.",
            timing: result.timing || "",
            risks: result.risks || "",
            keyLevels: result.keyLevels ? {
                support: result.keyLevels.support ?? null,
                resistance: result.keyLevels.resistance ?? null,
                idealEntry: result.keyLevels.idealEntry ?? null,
            } : undefined,
            positionAdvice: result.positionAdvice || undefined,
            catalysts: result.catalysts || undefined,
            conviction: ['HIGH', 'MEDIUM', 'LOW'].includes(result.conviction) ? result.conviction : 'MEDIUM',
        };

    } catch (error: any) {
        console.error("Claude analysis failed:", error);

        let errorMessage = "Error connecting to AI service.";
        if (error instanceof Anthropic.APIError) {
            errorMessage = `API Error: ${error.status} - ${error.message}`;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }

        return {
            score: 0,
            action: 'WAIT',
            summary: "AI Analysis Failed.",
            reasoning: errorMessage,
            timing: "",
            risks: "",
            conviction: 'LOW',
        };
    }
}
