import { NextResponse } from "next/server";
import { db } from "@/lib/db-service";

/**
 * Set code validation state.
 * Body: { sessionIdentifier, nodeId, validated: boolean }
 */
export async function POST(req: Request) {
    try {
        const { sessionIdentifier, nodeId, validated } = await req.json();

        if (!sessionIdentifier || !nodeId) {
            return NextResponse.json(
                { error: "Session identifier and node ID required" },
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

        if (validated === false) {
            await db.invalidateCode(session.id, nodeId);
        } else {
            await db.validateCode(session.id, nodeId);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Error setting code validation:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
