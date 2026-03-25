import { NextResponse } from "next/server";
import { db } from "@/lib/db-service";

/**
 * Delete the code record for a specific node and clear the node's codeId.
 * Body: { sessionIdentifier, nodeId }
 */
export async function POST(req: Request) {
    try {
        const { sessionIdentifier, nodeId } = await req.json();

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

        await db.deleteCode(session.id, nodeId);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Error deleting code:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

