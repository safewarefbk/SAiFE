import { NextResponse } from "next/server";
import { codeAgent } from "@/lib/agents";
import { db } from "@/lib/db-service";

export async function POST(req: Request) {
    try {
        const { sessionId, taskName, language } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
        }

        // Server-side DB: load project description to provide context to the agent
        const session = await db.getSessionById(sessionId);
        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const projectDescription = session.projectDescription || "";

        // Pure LLM call — agent receives project context as parameter
        const { code, prompt } = await codeAgent.generate(taskName, language, projectDescription);

        return NextResponse.json({ code, prompt });

    } catch (error: any) {
        console.error("Error generating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
