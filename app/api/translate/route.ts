import { NextResponse } from 'next/server';
// @ts-ignore
import { translate } from 'google-translate-api-x';

export async function POST(request: Request) {
    try {
        const { text, targetLang } = await request.json();

        if (!text) {
            return NextResponse.json({ error: 'Missing text' }, { status: 400 });
        }

        // Limit length to avoid abuse/errors
        const truncatedText = text.slice(0, 5000);

        const res = await translate(truncatedText, { to: targetLang || 'de' });

        // @ts-ignore
        return NextResponse.json({ translatedText: res.text });

    } catch (error) {
        console.error('Translation error:', error);
        return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
    }
}
