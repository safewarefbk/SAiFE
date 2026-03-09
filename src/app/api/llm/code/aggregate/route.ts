import { NextResponse } from "next/server";
import { codeAgent } from "@/lib/agents/code-agent";
import { getCodeModel } from "@/lib/agents/models";
import { db } from "@/lib/db-service";

export async function POST(req: Request) {
    try {
        const { type, goal, childrenCode, sessionId } = await req.json();

        let model: any;
        if (sessionId) {
            const session = await db.getSessionById(sessionId);
            model = await getCodeModel(
                session?.projectDescription || undefined,
                session?.technicalRequirements || undefined,
            );
        } else {
            model = await getCodeModel();
        }

        const { code, prompt, totalTokens } = await codeAgent.aggregate(model, type, goal, childrenCode);

        return NextResponse.json({ code, prompt, totalTokens });

    } catch (error: any) {
        console.error("Error aggregating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
