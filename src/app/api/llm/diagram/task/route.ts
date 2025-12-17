import { NextResponse } from "next/server";
import { diagramAgent } from "@/lib/agents";

export async function POST(req: Request) {
    try {
        const { sessionId, taskName } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: "Session ID required" }, { status: 400 });
        }

        // Server already has the history - just send sessionId and taskName
        const { diagram } = await diagramAgent.expandTask(sessionId, taskName);

        return NextResponse.json({ responseText: diagram });

    } catch (error: any) {
        console.error("Error generating task diagram:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

