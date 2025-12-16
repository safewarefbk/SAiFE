import { Mistral } from "@mistralai/mistralai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { taskName, language } = await req.json();
        const apiKey = process.env.NEXT_PUBLIC_MISTRAL_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Mistral API key not configured" }, { status: 500 });
        }

        const mistral = new Mistral({ apiKey });
        const DEFAULT_MODEL = "codestral-latest";

        const leafPrompt = `You are a senior software engineer. Generate secure, based on OWASP top 10 and CWEs, code that reflects the task, output ONLY code.
                    Instructions:
                    - Implement what is written in the task: ${taskName}.
                    - Divide the code in logical functions based on functionality.
                    - Keep code short and focused; avoid placeholders if not necessary.
                    - Use ${language} as programming language.
                    - Ensure code is clean, well-structured, and follows best practices.
                    - Make the code secure, following OWASP Top 10 and common CWEs.
                    - Protect against common vulnerabilities (e.g., SQL injection, XSS).
                    - If ${language} is Java, implement a compilable single class.
                    - Generate a single file with secure functions.
                    - If no code is needed, respond with "No code needed for this task.
                    - Always use the name of the task for naming the class."`;

        const messages = [{ role: "user", content: leafPrompt }];

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

        return NextResponse.json({ code: text, prompt: leafPrompt });

    } catch (error: any) {
        console.error("Error generating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

