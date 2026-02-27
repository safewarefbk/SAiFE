import { NextResponse } from "next/server";
import { db } from "@/lib/db-service";

/**
 * Check if a session exists
 */
export async function POST(req: Request) {
    try {
        const { sessionIdentifier } = await req.json();

        if (!sessionIdentifier) {
            return NextResponse.json(
                { error: "Session identifier required" },
                { status: 400 }
            );
        }

        const exists = await db.sessionExists(sessionIdentifier);
        const session = exists ? await db.getSession(sessionIdentifier) : null;

        return NextResponse.json({
            exists,
            session
        });

    } catch (error: any) {
        console.error("Error checking session:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

