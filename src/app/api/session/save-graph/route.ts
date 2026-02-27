import { NextResponse } from "next/server";
import { db } from "@/lib/db-service";

/**
 * Save graph data (nodes, edges with explicit columns)
 * No JSON storage - only explicit database columns
 * No graphIndex - single expanding graph per session
 */
export async function POST(req: Request) {
    try {
        const { sessionIdentifier, nodes, edges } = await req.json();

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

        // Save nodes if provided
        if (nodes && nodes.length > 0) {
            const nodeData = nodes.map((node: any) => ({
                id: node.id,
                sessionId: session.id,
                positionX: node.positionX,
                positionY: node.positionY,
                shapeType: node.shapeType,
                contents: node.contents,
                collapsed: node.collapsed || false,
                codeId: node.codeId || null,
                width: node.width,
                height: node.height,
                hidden: node.hidden || false
            }));
            await db.saveNodes(nodeData, session.id);
        }

        // Save edges if provided
        if (edges && edges.length > 0) {
            const edgeData = edges.map((edge: any) => ({
                id: edge.id,
                sessionId: session.id,
                source: edge.source,
                target: edge.target,
                label: edge.label,
                strokeDasharray: edge.strokeDasharray,
                hidden: edge.hidden || false
            }));
            await db.saveEdges(edgeData, session.id);
        }

        // Clean up orphaned code records (e.g. after undo removed code from nodes)
        await db.deleteOrphanedCodes(session.id);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Error saving graph:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

