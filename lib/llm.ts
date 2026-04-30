import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '', // Must be set in .env.local
});

export interface AIAnalysisResult {
    score: number; // 1-10 (1=Bearish, 10=Bullish)
    summary: string;
    reasoning: string;
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
            max_tokens: 500,
            temperature: 0,
            system: `You are a senior hedge fund analyst with 20+ years of experience. Analyze financial news and provide:
1. A strict sentiment score (1-10): 1=Extremely Bearish, 5=Neutral, 10=Extremely Bullish
2. Consider: price catalysts, earnings impact, macro factors, sector rotation, institutional sentiment, geopolitical risks
3. Weight recent events more heavily than older ones
IMPORTANT: Output ONLY valid JSON. No markdown code blocks. No introductory text.`,
            messages: [
                {
                    role: "user",
                    content: `Analyze the following news for "${symbol}".
Consider: fundamental impact, short-term catalysts, risk factors, geopolitical exposure, and market positioning.
Output valid JSON with EXACTLY these keys and types:
- "score": number from 1 to 10
- "summary": string (max 2 sentences, plain text, NOT an array or object)
- "reasoning": string (a single string with bullet points separated by newlines, e.g. "• Factor 1\n• Factor 2". MUST be a string, NOT an array, NOT an object)

News Text:
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

        // Normalize: Claude sometimes returns arrays/objects for reasoning despite
        // "string" instruction. Coerce everything to plain strings so the UI never crashes.
        const toText = (v: any): string => {
            if (v == null) return '';
            if (typeof v === 'string') return v;
            if (typeof v === 'number' || typeof v === 'boolean') return String(v);
            if (Array.isArray(v)) return v.map(toText).filter(Boolean).map(s => s.startsWith('•') || s.startsWith('-') ? s : `• ${s}`).join('\n');
            if (typeof v === 'object') {
                return Object.entries(v).map(([k, val]) => `• ${k}: ${toText(val)}`).join('\n');
            }
            return String(v);
        };

        const score = typeof result.score === 'number' ? result.score : parseFloat(result.score) || 5;
        return {
            score: Math.max(0, Math.min(10, score)),
            summary: toText(result.summary) || "Analysis failed.",
            reasoning: toText(result.reasoning) || "No reasoning provided."
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
            score: 0, // 0 indicates error
            summary: "AI Analysis Failed.",
            reasoning: errorMessage
        };
    }
}
