import { NextResponse } from "next/server";
import { codeAgent } from "@/lib/agents";

export async function POST(req: Request) {
    try {
        const { originalPrompt, currentCode, additionalPrompt } = await req.json();

        const { code } = await codeAgent.regenerate(originalPrompt, currentCode, additionalPrompt);

        return NextResponse.json({ code });


    } catch (error: any) {
        console.error("Error regenerating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

