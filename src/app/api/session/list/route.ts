import { NextResponse } from "next/server";
import { db } from "@/lib/db-service";

/**
 * Get all session identifiers (for session selection dropdown)
 */
export async function GET() {
    try {
        const sessionIdentifiers = await db.getAllSessionIdentifiers();
        return NextResponse.json({ sessions: sessionIdentifiers });

    } catch (error: any) {
        console.error("Error listing sessions:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

