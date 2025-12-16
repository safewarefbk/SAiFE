import { GoogleGenerativeAI } from "@google/generative-ai";
}
    }
        return NextResponse.json({ error: error.message }, { status: 500 });
        console.error("Error generating task diagram:", error);
    } catch (error: any) {

        return NextResponse.json({ responseText, history: newHistory });

        ];
            { role: "model", parts: [{ text: responseText }] }
            { role: "user", parts: [{ text: taskPrompt }] },
            ...(history || []),
        const newHistory = [

        const responseText = result.response.text();
        const result = await chatSession.sendMessage(taskPrompt);

        });
            history: history || []
            generationConfig,
        const chatSession = model.startChat({

        };
            responseMimeType: "application/json",
            maxOutputTokens: 65365,
            topK: 64,
            topP: 0.95,
            temperature: 1,
        const generationConfig = {

        \nOutput only the JSON, no explanations.`;
        NEVER include nodes that are not related to this specific task, or that are already implemented in previous graphs. Always use the name of the task for the root node.
        const taskPrompt = `Now, focus ONLY on the task: ${taskName}. Generate a smaller requirements graph than the previous one, the number of nodes MUST be reduced, for this specific task, keeping the context of the original description, and using the same exact rules.

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const genAI = new GoogleGenerativeAI(apiKey);

        }
            return NextResponse.json({ error: "API key not configured" }, { status: 500 });
        if (!apiKey) {

        const apiKey = process.env.NEXT_PUBLIC_API_KEY;
        const { taskName, history } = await req.json();
    try {
export async function POST(req: Request) {

import { NextResponse } from "next/server";

