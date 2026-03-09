import { NextResponse } from "next/server";
import { codeAgent } from "@/lib/agents/code-agent";
import { getCodeModel } from "@/lib/agents/models";
import { db } from "@/lib/db-service";

export async function POST(req: Request) {
    try {
        const { sessionId, nodeId, currentCode, newInstructions } = await req.json();

        if (!sessionId || !nodeId) {
            return NextResponse.json({ error: "sessionId and nodeId are required" }, { status: 400 });
        }

        const [codeRecord, session] = await Promise.all([
            db.getCodeByNodeId(sessionId, nodeId),
            db.getSessionById(sessionId),
        ]);

        if (!codeRecord) {
            return NextResponse.json({ error: "No existing code record found for this node" }, { status: 404 });
        }

        // Build model with project context in system prompt
        const model = await getCodeModel(
            session?.projectDescription || undefined,
            session?.technicalRequirements || undefined,
        );

        const originalPrompt = codeRecord.prompt || "";

        const { code, totalTokens } = await codeAgent.regenerate(model, originalPrompt, currentCode, newInstructions);

        // Persist: append new instructions to the existing prompt so future
        // regenerations always build on the full accumulated context.
        const updatedPrompt = newInstructions
            ? `${originalPrompt}\nAdditional instructions: ${newInstructions}.`
            : originalPrompt;

        // Accumulate token count
        const previousTokens = codeRecord.totalTokens ?? 0;
        const accumulatedTokens = totalTokens !== null
            ? previousTokens + totalTokens
            : (previousTokens > 0 ? previousTokens : null);

        await db.saveCode({
            sessionId: codeRecord.sessionId,
            nodeId: codeRecord.nodeId,
            code,
            prompt: updatedPrompt,
            isValidated: false,
            totalTokens: accumulatedTokens,
        });

        return NextResponse.json({ code, updatedPrompt });

    } catch (error: any) {
        console.error("Error regenerating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
