import { NextResponse } from "next/server";
import { db } from "@/lib/db-service";

/**
 * Save code for a node
 */
export async function POST(req: Request) {
    try {
        const { sessionIdentifier, nodeId, code, prompt, language, isValidated, totalTokens } = await req.json();

        if (!sessionIdentifier || !nodeId || !code) {
            return NextResponse.json(
                { error: "Session identifier, node ID, and code required" },
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

        const savedCode = await db.saveCode({
            sessionId: session.id,
            nodeId,
            code,
            prompt,
            language: language || 'Python',
            isValidated: isValidated || false,
            totalTokens: totalTokens ?? null
        });

        // Update the node's codeId foreign key to link to the code.
        // IMPORTANT: Use updateNodeCodeId — NOT saveNodes — so that
        // other nodes in the session are never touched/deleted.
        try {
            await db.updateNodeCodeId(session.id, nodeId, savedCode.id);
        } catch (e) {
            // Node might not exist in DB yet (e.g. graph not saved yet) — non-fatal
            console.warn('Could not update node codeId (node may not be in DB yet):', nodeId);
        }

        return NextResponse.json({
            success: true,
            codeId: savedCode.id  // Return the code ID
        });

    } catch (error: any) {
        console.error("Error saving code:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
