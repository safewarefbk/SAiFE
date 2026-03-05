import { NextResponse } from "next/server";
import { diagramAgent } from "@/lib/agents/diagram-agent";
import { db } from "@/lib/db-service";

export async function POST(req: Request) {
    try {
        const { description, includeNonFunctional, dbSessionId } = await req.json();

        if (!dbSessionId) {
            return NextResponse.json({ error: "dbSessionId is required" }, { status: 400 });
        }

        // Pure LLM call — agent has no DB knowledge
        const { diagram, userMessage, modelMessage } = await diagramAgent.startSession(
            description,
            includeNonFunctional
        );

        // Server-side DB: persist conversation history after successful LLM response
        await db.appendDiagramHistory(dbSessionId, 'user', userMessage);
        await db.appendDiagramHistory(dbSessionId, 'model', modelMessage);

        return NextResponse.json({ responseText: diagram });

    } catch (error: any) {
        console.error("Error generating diagram:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
