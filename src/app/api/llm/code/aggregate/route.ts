import { Mistral } from "@mistralai/mistralai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { type, goal, childrenCode, language, projectDescription } = await req.json();
        const apiKey = process.env.NEXT_PUBLIC_MISTRAL_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "Mistral API key not configured" }, { status: 500 });
        }

        const mistral = new Mistral({ apiKey });
        const DEFAULT_MODEL = "codestral-latest";

        const codeSnippets = childrenCode.map((child: any, index: number) =>
            `\n--- ${child.type} ${index + 1}: ${child.taskName} ---\n${child.code}`
        ).join('\n\n');

        let aggregationPrompt = "";

        if (type === 'circle') {
            aggregationPrompt = `You are a senior software engineer. You have been given code snippets from multiple sub-components (tasks and/or goals) that together implement the higher-level functional goal: "${goal}".

Your task is to aggregate these code snippets into a cohesive, well-structured implementation.

Code snippets from sub-components:
${codeSnippets}

Instructions:
- Integrate all code snippets into a unified implementation, do not add new code.
- Remove duplications and resolve any conflicts between snippets.
- Ensure the code flows logically and all parts work together functionally.
- Use ${language} as programming language.
- Keep the code clean, maintainable, and following best practices.
- Make the code secure, following OWASP Top 10 and common CWEs.
- If ${language} is Java, create a compilable single class or properly structured classes.
- Ensure all sub-component functionalities are preserved in the integrated code.
- The code should be then applicable for this project: ${projectDescription}.

VERY IMPORTANT:
- Output ONLY the integrated code, NO explanations.
- Do NOT add comments like "// code from task X" - integrate naturally.`;
        } else {
            // Root aggregation
            aggregationPrompt = `You are a senior software architect. You have been given code snippets from ALL major components for the "${goal}".

Your task is to create a COMPLETE, PRODUCTION-READY implementation of the entire project by integrating and using all the code snippets.

Project Description: ${projectDescription}

Code snippets from all major components:
${codeSnippets}

Instructions:
- Integrate all code snippets into a cohesive system, do not add new code.
- Ensure that that each function is used at least once within the overall application, otherwise add a comment //unused.
- Use all the provided code snippets effectively.
- Remove duplications and resolve any conflicts between components.
- Ensure proper separation of concerns and modular design.
- Add necessary main entry points, configuration, and initialization code.
- Follow industry best practices for project structure and organization.
- Make the code secure, following OWASP Top 10 and common CWEs.
- Ensure all security requirements are implemented (authentication, authorization, encryption, etc.).
- Use ${language} as programming language.
- If ${language} is Java, create a complete application with proper package structure.
- If ${language} is Python, include necessary imports and a main entry point.
- Add error handling, logging, and proper resource management.

VERY IMPORTANT:
- Output ONLY the complete integrated code, NO explanations.
- Do NOT add placeholder comments like "// add more code here".
- If multiple files are needed, clearly separate them with comments like "// ===== FILE: filename.ext =====".`;
        }

        const messages = [{ role: "user", content: aggregationPrompt }];

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
            text = "Error: No aggregated code generated. Please try again.";
        }

        return NextResponse.json({ code: text, prompt: aggregationPrompt });

    } catch (error: any) {
        console.error("Error aggregating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

