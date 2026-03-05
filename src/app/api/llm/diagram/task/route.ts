import { NextResponse } from "next/server";
import { diagramAgent } from "@/lib/agents/diagram-agent";
import { db } from "@/lib/db-service";

export async function POST(req: Request) {
    try {
        const { dbSessionId, taskName, userPrompt } = await req.json();

        if (!dbSessionId) {
            return NextResponse.json({ error: "dbSessionId required" }, { status: 400 });
        }

        // Server-side DB: load conversation history before calling the agent
        const historyRecords = await db.getDiagramHistory(dbSessionId);
        if (historyRecords.length === 0) {
            return NextResponse.json(
                { error: "No conversation history found. Please generate the initial diagram first." },
                { status: 400 }
            );
        }

        // Convert DB records to the format the agent expects
        const history = historyRecords.map(record => ({
            role: record.role,
            parts: [{ text: record.content }]
        }));

        // Pure LLM call — agent receives history as parameter, performs no DB operations
        const { diagram, userMessage, modelMessage } = await diagramAgent.expandTask(taskName, history, userPrompt);

        // Server-side DB: persist new conversation turn after successful LLM response
        await db.appendDiagramHistory(dbSessionId, 'user', userMessage);
        await db.appendDiagramHistory(dbSessionId, 'model', modelMessage);

        return NextResponse.json({ responseText: diagram });

    } catch (error: any) {
        console.error("Error generating task diagram:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
