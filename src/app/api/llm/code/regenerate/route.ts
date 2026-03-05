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
        const { code } = await codeAgent.regenerate(originalPrompt, currentCode, newInstructions);

        return NextResponse.json({ code });

    } catch (error: any) {
        console.error("Error regenerating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
