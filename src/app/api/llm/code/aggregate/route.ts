import { NextResponse } from "next/server";
import { codeAgent } from "@/lib/agents/code-agent";

export async function POST(req: Request) {
    try {
        const { type, goal, childrenCode, projectDescription } = await req.json();

        const { code, prompt, totalTokens } = await codeAgent.aggregate(
            type,
            goal,
            childrenCode,
            projectDescription
        );

        return NextResponse.json({ code, prompt, totalTokens });


    } catch (error: any) {
        console.error("Error aggregating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

