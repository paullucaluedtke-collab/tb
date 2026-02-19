import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '', // Must be set in .env.local
});

export interface AIAnalysisResult {
    score: number; // 1-10 (1=Bearish, 10=Bullish)
    summary: string;
    reasoning: string;
}

export async function analyzeWithClaude(text: string, symbol: string): Promise<AIAnalysisResult> {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('Missing ANTHROPIC_API_KEY');
    }

    try {
        const message = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 300,
            temperature: 0,
            system: "You are a senior hedge fund analyst. Your job is to analyze financial news and provide a strict sentiment score (1-10) and a concise summary. 1 is Extremely Bearish, 10 is Extremely Bullish, 5 is Neutral.\nIMPORTANT: Output ONLY valid JSON. No markdown code blocks. No introductory text.",
            messages: [
                {
                    role: "user",
                    content: `Analyze the following news text for the stock "${symbol}". 
                    Provide the output in valid JSON format ONLY, with keys: "score" (number 1-10), "summary" (max 2 sentences), "reasoning" (bullet points).
                    
                    News Text:
                    ${text}`
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
            summary: result.summary || "Analysis failed.",
            reasoning: result.reasoning || "No reasoning provided."
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
