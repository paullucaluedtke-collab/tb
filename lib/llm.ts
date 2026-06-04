import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export type AIAction =
    // Entry actions (no open position)
    | 'STRONG_BUY' | 'BUY' | 'SHORT' | 'STRONG_SHORT' | 'WAIT'
    // Position-management actions (when invested)
    | 'HOLD' | 'SCALE_IN' | 'TRIM' | 'CLOSE' | 'REVERSE'
    // Legacy alias kept for stored data compatibility
    | 'SELL';

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

The trader has an OPEN ${position.side} position. Your job is NOT to evaluate a fresh entry —
it is to advise on what to DO WITH THIS POSITION right now. You MUST:
1. Decide between HOLD / SCALE_IN / TRIM / CLOSE / REVERSE based on whether the original
   ${position.side} thesis is still intact, broken, or actively inverting.
2. Tell the trader exactly where to put / trail the stop loss in dollars.
3. Suggest a profit target or signal when to TRIM (e.g. take 50% off at $X).
4. If the trend has FLIPPED against the position with strong evidence — say CLOSE or, in
   extreme cases, REVERSE. Do NOT default to HOLD when data clearly says exit.` : '';

    const actionOptions = position
        ? '"HOLD" (thesis intact, stay in), "SCALE_IN" (thesis stronger, add to position), "TRIM" (take partial profit, lock in gains), "CLOSE" (exit fully — thesis broken or risk too high), "REVERSE" (flip to opposite side — strong evidence the trend inverted), "WAIT" (cannot determine, do nothing yet)'
        : '"STRONG_BUY" (multi-factor bullish edge, R:R 3:1+), "BUY" (decent long setup, R:R 2:1+), "SHORT" (decent short setup — clear bearish edge), "STRONG_SHORT" (high-conviction short — multiple bearish factors aligned), "WAIT" (no clear edge in either direction)';

    const systemPrompt = `You are an elite institutional trading analyst. You play LONG and SHORT with equal seriousness. You do NOT have a long bias. You do NOT default to "BUY". Most setups have no edge — say WAIT. Only commit when the data justifies it.

Your analysis framework:
1. DIRECTIONAL EDGE: Is there a clear technical & fundamental reason this stock should rise OR fall in the next 1-4 weeks? If neither side is clearly favored → WAIT.
2. CATALYST ASSESSMENT: Earnings, FDA, macro, sector rotation, guidance cuts, downgrades. Catalysts work in BOTH directions.
3. TECHNICAL CONFLUENCE — bullish signals: price > SMA50 > SMA200, MACD bullish, RSI rising from 35-50, bullish divergence, volume on green days, breakout above resistance.
4. TECHNICAL CONFLUENCE — bearish signals: price < SMA50 < SMA200, MACD bearish, RSI failing at 50-65, bearish divergence, volume on red days, breakdown below support, lower highs/lows.
5. RISK/REWARD MATH: Quantify upside vs downside in dollars from current price.
6. POSITION MANAGEMENT: If already invested, focus on managing THAT position. Never advise a fresh entry when one is already open.

SHORT setup criteria (any 2+ → consider SHORT, any 3+ → STRONG_SHORT):
- Price broke below SMA50 with follow-through
- Death cross (SMA50 crossing below SMA200) or already inverted MA stack
- Bearish RSI divergence at recent highs
- MACD bearish cross OR sustained bearish histogram
- RSI failing to reclaim 50 from below
- Negative catalyst (guidance cut, downgrade, sector headwind, regulatory risk)
- Distribution: down days on rising volume

LONG setup criteria (any 2+ → consider BUY, any 3+ → STRONG_BUY):
- Price reclaiming SMA50 with follow-through, or golden cross
- Bullish RSI divergence at recent lows
- MACD bullish cross OR sustained bullish histogram
- RSI breaking 50 from below
- Positive catalyst (beat, raised guidance, sector tailwind)
- Accumulation: up days on rising volume

Scoring Guide (BE HONEST — most stocks are 4-6 with no edge):
- 9-10: Exceptional — 4+ confluence factors aligned, R:R 3:1+, fresh catalyst (≤5% of cases)
- 7-8: Good edge — 3 factors aligned, R:R 2:1+
- 5-6: Mixed / no edge — conflicting signals
- 3-4: Edge AGAINST current position / against fresh entry on that side
- 1-2: Clear edge in OPPOSITE direction — actively dangerous to take this side

Conviction:
- HIGH: 3+ independent confluence factors + clear catalyst
- MEDIUM: 2 factors OR 1 factor + catalyst
- LOW: speculative, contradicting signals, or stale catalyst

Available actions: ${actionOptions}

CRITICAL: Output ONLY valid JSON. No markdown. No text outside JSON. Use numbers (not strings) for numeric fields. All string fields must be plain strings, NOT arrays or nested objects.`;

    const userMessage = position
        ? `I have an OPEN ${position.side} position on "${symbol}". Tell me what to do with it RIGHT NOW.
${positionSection}
${techSection}

Decision matrix for my ${position.side} position:
- If technicals & catalysts STILL support ${position.side} → HOLD (or SCALE_IN if even stronger)
- If price is approaching target / extended → TRIM
- If thesis is broken (key level lost, MACD flipped, divergence forming) → CLOSE
- If trend has FULLY inverted with strong evidence → REVERSE (close + open opposite)
- If genuinely unclear → WAIT (but explain what you're waiting for)

Output JSON:
- "score" (1-10: how healthy is the ${position.side} thesis NOW. 10 = thesis stronger than at entry; 5 = neutral; 1 = thesis completely broken / opposite trade is now the right one)
- "action" ("HOLD" | "SCALE_IN" | "TRIM" | "CLOSE" | "REVERSE" | "WAIT")
- "summary" (2-3 sentences: state of the position right now — DO NOT re-evaluate as fresh entry)
- "reasoning" (string with bullet points separated by newlines: what supports / threatens THIS specific ${position.side} position)
- "timing" (1-2 sentences: concrete next step — "Move stop to $X", "Trim 50% at $Y", "Close on close below $Z")
- "risks" (1-2 sentences: biggest threat to the position right now)
- "keyLevels" (object: {"support": number|null, "resistance": number|null, "idealEntry": null} — relevant levels for the existing position)
- "positionAdvice" (1-2 sentences: specific stop-loss / profit-target adjustment in dollars)
- "catalysts" (1 sentence: next major catalyst and rough date if known)
- "conviction" ("HIGH" | "MEDIUM" | "LOW")

News & Context:
${text}${geoSection}`
        : `Is there a tradeable EDGE on "${symbol}" right now — LONG, SHORT, or neither?
${techSection}

Be willing to recommend SHORT when the data supports it. Do NOT bias toward LONG.
If neither direction has clear edge, say WAIT — that is the correct answer most of the time.

Output JSON:
- "score" (1-10: entry quality of the BEST AVAILABLE DIRECTION; 5 = no edge, WAIT)
- "action" ("STRONG_BUY" | "BUY" | "SHORT" | "STRONG_SHORT" | "WAIT")
- "summary" (2-3 sentences: which direction has edge AND why, or why there's no edge)
- "reasoning" (string with bullet points separated by newlines: technical confluence + catalysts that justify the direction. If WAIT, what's missing.)
- "timing" (1-2 sentences: specific entry trigger — price level break, indicator condition, or event to wait for)
- "risks" (1-2 sentences: what would invalidate the trade in this direction)
- "keyLevels" (object: {"support": number|null, "resistance": number|null, "idealEntry": number|null})
- "catalysts" (1 sentence: next major catalyst and rough date if known)
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
        const validActions: AIAction[] = [
            'STRONG_BUY', 'BUY', 'SHORT', 'STRONG_SHORT', 'WAIT',
            'HOLD', 'SCALE_IN', 'TRIM', 'CLOSE', 'REVERSE',
            'SELL',
        ];
        let parsedAction = String(result.action || '').toUpperCase().replace(/\s+/g, '_');
        // Migrate legacy / synonym values
        if (parsedAction === 'SELL' && !position) parsedAction = 'SHORT';
        if (parsedAction === 'SELL' && position) parsedAction = 'CLOSE';
        if (parsedAction === 'STRONG_SELL') parsedAction = 'STRONG_SHORT';
        if (parsedAction === 'AVOID') parsedAction = 'WAIT';

        // Defensive: Claude sometimes returns arrays/objects despite "string" instruction.
        // Coerce everything to plain strings so the UI never crashes with
        // "Objects are not valid as a React child".
        const toText = (v: any): string => {
            if (v == null) return '';
            if (typeof v === 'string') return v;
            if (typeof v === 'number' || typeof v === 'boolean') return String(v);
            if (Array.isArray(v)) {
                return v.map(toText).filter(Boolean)
                    .map(s => (s.trim().startsWith('•') || s.trim().startsWith('-') ? s : `• ${s}`))
                    .join('\n');
            }
            if (typeof v === 'object') {
                return Object.entries(v).map(([k, val]) => `• ${k}: ${toText(val)}`).join('\n');
            }
            return String(v);
        };
        const toNumOrNull = (v: any): number | null => {
            if (v == null) return null;
            const n = typeof v === 'number' ? v : parseFloat(v);
            return Number.isFinite(n) ? n : null;
        };

        const scoreNum = typeof result.score === 'number' ? result.score : parseFloat(result.score) || 5;

        return {
            score: Math.max(0, Math.min(10, scoreNum)),
            action: validActions.includes(parsedAction as AIAction) ? parsedAction as AIAction : 'WAIT',
            summary: toText(result.summary) || "Analysis completed.",
            reasoning: toText(result.reasoning) || "No reasoning provided.",
            timing: toText(result.timing),
            risks: toText(result.risks),
            keyLevels: result.keyLevels && typeof result.keyLevels === 'object' ? {
                support: toNumOrNull(result.keyLevels.support),
                resistance: toNumOrNull(result.keyLevels.resistance),
                idealEntry: toNumOrNull(result.keyLevels.idealEntry),
            } : undefined,
            positionAdvice: result.positionAdvice ? toText(result.positionAdvice) : undefined,
            catalysts: result.catalysts ? toText(result.catalysts) : undefined,
            conviction: ['HIGH', 'MEDIUM', 'LOW'].includes(String(result.conviction).toUpperCase())
                ? String(result.conviction).toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW'
                : 'MEDIUM',
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

// ─── Portfolio-level AI coach ──────────────────────────────────────────────
// Takes a snapshot of the entire portfolio (per-holding metrics + aggregate
// risk numbers) and asks Claude for portfolio-wide observations a single-stock
// analysis would never catch: concentration risk, correlation clusters, hedge
// suggestions, rebalancing priorities.

export interface PortfolioHoldingInput {
    symbol: string;
    quantity: number;
    avgCost: number;
    currentPrice?: number;
    marketValue?: number;
    unrealizedPnlPct?: number;
    sector?: string;
    technicalAction?: 'LONG' | 'SHORT' | 'WAIT';
    technicalConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PortfolioSummaryInput {
    totalValue: number;
    totalPnlPct: number;
    dayPnlPct: number;
    concentrationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    diversificationScore: number;
    topConcentration: { symbol: string; pctOfPortfolio: number }[];
    sectorAllocation: { sector: string; pct: number }[];
}

export interface PortfolioCoachResult {
    overallScore: number;            // 1-10 health of the portfolio as a whole
    headline: string;                // 1-sentence verdict
    strengths: string;               // bullet-string
    risks: string;                   // bullet-string (concentration, sector, correlation)
    actions: string;                 // bullet-string with concrete next steps
    hedgeSuggestion?: string;        // optional macro/instrument hedge idea
    rebalancing?: string;            // optional rebalancing recommendation
    sectorComment?: string;          // optional sector-level commentary
}

export async function analyzePortfolioWithClaude(
    holdings: PortfolioHoldingInput[],
    summary: PortfolioSummaryInput,
    geoContext?: string,
    lang: 'en' | 'de' = 'en',
): Promise<PortfolioCoachResult> {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('Missing ANTHROPIC_API_KEY');
    }

    if (holdings.length === 0) {
        return {
            overallScore: 0,
            headline: lang === 'de' ? 'Kein Portfolio zum Analysieren.' : 'No portfolio to analyze.',
            strengths: '', risks: '', actions: '',
        };
    }

    const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    const fmtMoney = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });

    const holdingsTable = holdings.map(h => {
        const parts = [
            `${h.symbol}`,
            `${h.quantity} sh`,
            h.marketValue ? `value ${fmtMoney(h.marketValue)}` : 'value n/a',
            h.unrealizedPnlPct != null ? `P&L ${fmtPct(h.unrealizedPnlPct)}` : '',
            h.sector ? `sector ${h.sector}` : '',
            h.technicalAction ? `signal ${h.technicalAction} (${h.technicalConfidence || 'MED'})` : '',
        ].filter(Boolean);
        return '- ' + parts.join(' | ');
    }).join('\n');

    const concentrationText = summary.topConcentration
        .map(c => `${c.symbol} ${c.pctOfPortfolio.toFixed(1)}%`).join(', ');

    const sectorText = summary.sectorAllocation
        .slice(0, 6).map(s => `${s.sector} ${s.pct.toFixed(1)}%`).join(', ');

    const geoSection = geoContext ? `\n\nGlobal Macro Context:\n${geoContext}` : '';
    const langInstruction = lang === 'de'
        ? 'Antworte ausschließlich auf Deutsch. Behalte alle JSON-Keys auf Englisch.'
        : 'Respond in English.';

    const systemPrompt = `You are a senior portfolio strategist at an institutional hedge fund. You think in portfolio-level terms: correlations, concentration, sector exposure, factor tilts, hedges, sequence-of-returns risk.

Your job is NOT to re-evaluate individual stocks (technical signals are already attached). Your job is to identify portfolio-wide blind spots a single-stock analysis would miss:
- Concentration risk (any one name > 25% = serious)
- Sector overweighting (any one sector > 40% = consider trimming)
- Correlation clusters (e.g. NVDA + AVGO + ASML all = AI-semis = single bet)
- Missing hedges (all long, no defensive holdings)
- Stale theses (positions deep in the red where the technicals have now flipped)

Be DIRECT and SPECIFIC. Use dollar amounts and percentages. Recommend concrete actions like "Trim NVDA to 12% (sell ~30 shares ≈ $X)". No fluff.

${langInstruction}

CRITICAL: Output ONLY valid JSON. Every string value MUST be a plain string (NOT an array, NOT a nested object). Bullet points use \\n between items.`;

    const userMessage = `Analyze this portfolio and tell me what to do.

PORTFOLIO SNAPSHOT
- Total value: ${fmtMoney(summary.totalValue)}
- Unrealized P&L: ${fmtPct(summary.totalPnlPct)}
- Today: ${fmtPct(summary.dayPnlPct)}
- Concentration risk: ${summary.concentrationRisk} (largest position = ${summary.topConcentration[0]?.pctOfPortfolio.toFixed(1) || 0}%)
- Diversification score: ${summary.diversificationScore}/100
- Top concentration: ${concentrationText}
- Sector mix: ${sectorText}

HOLDINGS (${holdings.length} positions):
${holdingsTable}
${geoSection}

Output JSON with these EXACT keys (all string values are plain strings, not arrays):
- "overallScore": number 1-10 (portfolio health: 10 = well diversified with positive tailwinds, 1 = highly concentrated in losing trades)
- "headline": string (1 sentence verdict, e.g. "Heavy AI-semi concentration creates correlated downside risk")
- "strengths": string (newline-separated bullets — what's working)
- "risks": string (newline-separated bullets — concentration, sector, correlation, stale theses)
- "actions": string (newline-separated bullets — concrete next steps with specific symbols / amounts)
- "hedgeSuggestion": string (optional: 1-2 sentences on a hedge — e.g. "Consider 5% TLT to offset tech drawdown risk")
- "rebalancing": string (optional: 1-2 sentences on rebalancing priorities)
- "sectorComment": string (optional: 1 sentence on sector mix)`;

    try {
        const message = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1500,
            temperature: 0,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
        });

        const responseContent = message.content[0].type === 'text' ? message.content[0].text : '';
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error(`Invalid AI response format. Raw length: ${responseContent.length}`);
        }

        const result = JSON.parse(jsonMatch[0]);
        const toText = (v: any): string => {
            if (v == null) return '';
            if (typeof v === 'string') return v;
            if (typeof v === 'number' || typeof v === 'boolean') return String(v);
            if (Array.isArray(v)) {
                return v.map(toText).filter(Boolean)
                    .map(s => (s.trim().startsWith('•') || s.trim().startsWith('-') ? s : `• ${s}`))
                    .join('\n');
            }
            if (typeof v === 'object') {
                return Object.entries(v).map(([k, val]) => `• ${k}: ${toText(val)}`).join('\n');
            }
            return String(v);
        };
        const scoreNum = typeof result.overallScore === 'number'
            ? result.overallScore : parseFloat(result.overallScore) || 5;
        return {
            overallScore: Math.max(0, Math.min(10, scoreNum)),
            headline: toText(result.headline) || (lang === 'de' ? 'Analyse abgeschlossen.' : 'Analysis completed.'),
            strengths: toText(result.strengths),
            risks: toText(result.risks),
            actions: toText(result.actions),
            hedgeSuggestion: result.hedgeSuggestion ? toText(result.hedgeSuggestion) : undefined,
            rebalancing: result.rebalancing ? toText(result.rebalancing) : undefined,
            sectorComment: result.sectorComment ? toText(result.sectorComment) : undefined,
        };
    } catch (error: any) {
        let errorMessage = "Error connecting to AI service.";
        if (error instanceof Anthropic.APIError) {
            errorMessage = `API Error: ${error.status} - ${error.message}`;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return {
            overallScore: 0,
            headline: lang === 'de' ? 'KI-Analyse fehlgeschlagen.' : 'Portfolio AI analysis failed.',
            strengths: '',
            risks: errorMessage,
            actions: '',
        };
    }
}
