import { NextResponse } from "next/server";
import { codeAgent } from "@/lib/agents/code-agent";
import { db } from "@/lib/db-service";

export async function POST(req: Request) {
    try {
        const { sessionId, nodeId, currentCode, newInstructions } = await req.json();

        if (!sessionId || !nodeId) {
            return NextResponse.json({ error: "sessionId and nodeId are required" }, { status: 400 });
        }

        // Server-side DB: load the original prompt that was used when the code was first generated
        const codeRecord = await db.getCodeByNodeId(sessionId, nodeId);
        if (!codeRecord) {
            return NextResponse.json({ error: "No existing code record found for this node" }, { status: 404 });
        }

        const originalPrompt = codeRecord.prompt || "";

        // Pure LLM call — agent receives the real original prompt from DB
        const { code, totalTokens } = await codeAgent.regenerate(originalPrompt, currentCode, newInstructions);

        // Persist: append new instructions to the existing prompt so future
        // regenerations always build on the full accumulated context.
        const updatedPrompt = newInstructions
            ? `${originalPrompt}\nAdditional instructions: ${newInstructions}.`
            : originalPrompt;

        // Accumulate token count: add new tokens on top of previously stored total
        const previousTokens = codeRecord.totalTokens ?? 0;
        const accumulatedTokens = totalTokens !== null
            ? previousTokens + totalTokens
            : (previousTokens > 0 ? previousTokens : null);

        await db.saveCode({
            sessionId: codeRecord.sessionId,
            nodeId: codeRecord.nodeId,
            code,
            prompt: updatedPrompt,
            language: codeRecord.language ?? undefined,
            isValidated: false,
            totalTokens: accumulatedTokens,
        });

        return NextResponse.json({ code, updatedPrompt });

    } catch (error: any) {
        console.error("Error regenerating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
