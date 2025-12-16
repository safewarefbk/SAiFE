import { Mistral } from "@mistralai/mistralai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { originalPrompt, currentCode, additionalPrompt } = await req.json();
        const apiKey = process.env.NEXT_PUBLIC_MISTRAL_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Mistral API key not configured" }, { status: 500 });
        }

        const mistral = new Mistral({ apiKey });
        const DEFAULT_MODEL = "codestral-latest";

        const enhancedPrompt = `Original task requirements:\n${originalPrompt}\n\nCurrent code implementation:\n${currentCode}\n\nAdditional modification instructions:\n${additionalPrompt}\n\nPlease modify the current code implementation to incorporate these additional instructions while maintaining the original requirements. Output ONLY the complete modified code.`;

        const messages = [{ role: "user", content: enhancedPrompt }];

        const result = await mistral.chat.complete({
            model: DEFAULT_MODEL,
            messages: messages as any
        });

        let text = "";
        if (result.choices && result.choices.length > 0 && result.choices[0].message) {
            const content = result.choices[0].message.content;
            if (typeof content === 'string') {
                text = content;
            } else if (Array.isArray(content)) {
                text = content.map(chunk => {
                    if (typeof chunk === 'string') {
                        return chunk;
                    }
                    if ('text' in chunk) {
                        return chunk.text;
                    }
                    return '';
                }).join('');
            }
        }

        if (!text) {
            text = "Error: No code generated. Please try again.";
        }

        return NextResponse.json({ code: text });

    } catch (error: any) {
        console.error("Error regenerating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

