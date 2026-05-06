import { NextResponse } from "next/server";
import { db } from "@/lib/db-service";

/**
 * Get all session identifiers (for session selection dropdown)
 */
export async function GET(req: Request) {
    try {
        const sessionType = new URL(req.url).searchParams.get('sessionType') ?? undefined;
        const sessionIdentifiers = await db.getAllSessionIdentifiers(sessionType);
        return NextResponse.json({ sessions: sessionIdentifiers });

    } catch (error: any) {
        console.error("Error listing sessions:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

