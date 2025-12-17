import { NextResponse } from "next/server";
import { codeAgent } from "@/lib/agents";

export async function POST(req: Request) {
    try {
        const { taskName, language } = await req.json();

        const { code, prompt } = await codeAgent.generate(taskName, language);

        return NextResponse.json({ code, prompt });


    } catch (error: any) {
        console.error("Error generating code:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

