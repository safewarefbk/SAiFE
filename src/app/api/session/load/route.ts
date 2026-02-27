import { NextResponse } from "next/server";
import { db } from "@/lib/db-service";
import { reconstructGraphFromRecords } from "@/lib/json-reconstruction";

/**
 * Load complete session data and reconstruct graph from database records
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

        const session = await db.getSession(sessionIdentifier);
        if (!session) {
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 }
            );
        }

        const data = await db.loadSessionData(session.id);

        // Reconstruct single graph from all nodes/edges
        const graphJson = reconstructGraphFromRecords(data.nodes as any[], data.edges as any[]);

        // Return single graph (backward compatible format)
        const graphs = [{
            graphIndex: 0,
            jsonData: graphJson
        }];

        return NextResponse.json({
            session: data.session,
            nodes: data.nodes,
            edges: data.edges,
            codes: data.codes,
            graphs: graphs
        });

    } catch (error: any) {
        console.error("Error loading session:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
