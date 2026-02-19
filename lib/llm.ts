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
            system: "You are a senior hedge fund analyst. Your job is to analyze financial news and provide a strict sentiment score (1-10) and a concise summary. 1 is Extremely Bearish, 10 is Extremely Bullish, 5 is Neutral.",
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

        // Extract JSON
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid AI response format');
        }

        const result = JSON.parse(jsonMatch[0]);
        return {
            score: result.score || 5,
            summary: result.summary || "Analysis failed.",
            reasoning: result.reasoning || "No reasoning provided."
        };

    } catch (error) {
        console.error("Claude analysis failed:", error);
        return {
            score: 5,
            summary: "AI Analysis unavailable.",
            reasoning: "Error connecting to AI service."
        };
    }
}
