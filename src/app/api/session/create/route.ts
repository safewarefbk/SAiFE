import { NextResponse } from "next/server";
import { db } from "@/lib/db-service";

/**
 * Create a new session
 */
export async function POST(req: Request) {
    try {
        const { sessionIdentifier, projectDescription, language } = await req.json();

        if (!sessionIdentifier) {
            return NextResponse.json(
                { error: "Session identifier required" },
                { status: 400 }
            );
        }

        // Check if session already exists
        const exists = await db.sessionExists(sessionIdentifier);
        if (exists) {
            return NextResponse.json(
                { error: "Session identifier already exists" },
                { status: 409 }
            );
        }

        const session = await db.createSession(
            sessionIdentifier,
            projectDescription,
            language
        );

        return NextResponse.json({ session });

    } catch (error: any) {
        console.error("Error creating session:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

/**
 * Update session with project description and language
 */
export async function PUT(req: Request) {
    try {
        const { sessionIdentifier, projectDescription, language } = await req.json();

        if (!sessionIdentifier) {
            return NextResponse.json(
                { error: "Session identifier required" },
                { status: 400 }
            );
        }

        const session = await db.getSession(sessionIdentifier);
        if (!session) {
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 }
            );
        }

        await db.updateSession(session.id, {
            projectDescription,
            language
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Error updating session:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
