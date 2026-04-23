import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '', // Must be set in .env.local
});

export interface AIAnalysisResult {
    score: number; // 1-10 (1=Strong avoid, 10=Excellent entry)
    action: 'BUY' | 'SELL' | 'WAIT';
    summary: string;
    reasoning: string;
    timing: string;
    risks: string;
}

export async function analyzeWithClaude(text: string, symbol: string, geoContext?: string): Promise<AIAnalysisResult> {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('Missing ANTHROPIC_API_KEY');
    }

    const geoSection = geoContext
        ? `\n\nGlobal Macro & Geopolitical Context (consider indirect effects on ${symbol}):\n${geoContext}`
        : '';

    try {
        const message = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 600,
            temperature: 0,
            system: `You are a senior trading analyst. Your job is to help traders decide whether NOW is a good time to enter a position on a given stock. Be decisive — traders need clear, actionable guidance.

Evaluate:
1. Entry quality score (1-10): 1=Terrible entry, stay away. 5=No edge, wait. 10=Excellent risk/reward, act now.
2. Clear action: BUY, SELL, or WAIT.
3. Catalysts in the next 1-4 weeks (earnings, product launches, macro events).
4. Risk factors that could invalidate the trade.
5. Specific timing advice (enter now, wait for pullback to X, avoid until Y).

IMPORTANT: Output ONLY valid JSON. No markdown code blocks. No introductory text.`,
            messages: [
                {
                    role: "user",
                    content: `Is NOW a good time to trade "${symbol}"?

Based on the news below, output valid JSON with these keys:
- "score" (number 1-10, entry quality — NOT just sentiment)
- "action" ("BUY" or "SELL" or "WAIT")
- "summary" (2 sentences: what's the setup and is it tradeable right now?)
- "reasoning" (concise bullet points: catalysts, technicals, timing factors)
- "timing" (1 sentence: specific entry advice, e.g. "Enter on next pullback to $X" or "Buy now before earnings catalyst")
- "risks" (1 sentence: primary risk that could go wrong)

News & Context:
${text}${geoSection}`
                }
            ]
        });

        const responseContent = message.content[0].type === 'text' ? message.content[0].text : '';
        // console.log(`[AI RAW] ${symbol}:`, responseContent); // Debugging

        // Extract JSON (Handle Markdown blocks or plain JSON)
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error(`[AI ERROR] Invalid Format for ${symbol}. Raw:`, responseContent);
            throw new Error(`Invalid AI response format. Raw length: ${responseContent.length}`);
        }

        const result = JSON.parse(jsonMatch[0]);
        return {
            score: result.score || 5,
            action: result.action === 'BUY' || result.action === 'SELL' ? result.action : 'WAIT',
            summary: result.summary || "Analysis failed.",
            reasoning: result.reasoning || "No reasoning provided.",
            timing: result.timing || "",
            risks: result.risks || "",
        };

    } catch (error: any) {
        console.error("Claude analysis failed:", error);

        // Extract meaningful error message
        let errorMessage = "Error connecting to AI service.";
        if (error instanceof Anthropic.APIError) {
            errorMessage = `API Error: ${error.status} - ${error.message}`;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }

        return {
            score: 0,
            action: 'WAIT' as const,
            summary: "AI Analysis Failed.",
            reasoning: errorMessage,
            timing: "",
            risks: "",
        };
    }
}
