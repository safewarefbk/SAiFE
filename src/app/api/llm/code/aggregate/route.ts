import { NextResponse } from "next/server";
import { codeAgent } from "@/lib/agents";

export async function POST(req: Request) {
    try {
        const { type, goal, childrenCode, projectDescription } = await req.json();

        const { code, prompt } = await codeAgent.aggregate(
            type,
            goal,
            childrenCode,
            projectDescription
        );

        return NextResponse.json({ code, prompt });


    } catch (error: any) {
        console.error("Error aggregating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

