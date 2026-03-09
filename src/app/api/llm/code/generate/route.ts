import { NextResponse } from "next/server";
import { codeAgent } from "@/lib/agents/code-agent";
import { getCodeModel } from "@/lib/agents/models";
import { db } from "@/lib/db-service";

export async function POST(req: Request) {
    try {
        const { sessionId, taskName } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
        }

        const session = await db.getSessionById(sessionId);
        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // Build model once with full context in system prompt
        const model = await getCodeModel(
            session.projectDescription || undefined,
            session.technicalRequirements || undefined,
        );

        const { code, prompt, totalTokens } = await codeAgent.generate(model, taskName);

        return NextResponse.json({ code, prompt, totalTokens });

    } catch (error: any) {
        console.error("Error generating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
