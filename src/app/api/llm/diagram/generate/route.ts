import { NextResponse } from "next/server";
import { diagramAgent } from "@/lib/agents";

export async function POST(req: Request) {
    try {
        const { description, includeNonFunctional } = await req.json();

        // Start a new session - server keeps history, returns sessionId to client
        const { sessionId, diagram } = await diagramAgent.startSession(
            description,
            includeNonFunctional
        );

        return NextResponse.json({
            responseText: diagram,
            sessionId  // Client stores this for subsequent requests
        });

    } catch (error: any) {
        console.error("Error generating diagram:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

