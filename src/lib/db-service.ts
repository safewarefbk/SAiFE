/**
 * Database Service Layer for Session Management
 * Handles all database operations for sessions, nodes, edges, and codes
 */

import { prisma } from './prisma';

export interface SessionData {
    id: string;
    sessionIdentifier: string;
    projectDescription?: string | null;
    technicalRequirements?: string | null;
    createdAt: Date;
    lastAccess: Date;
}

export interface NodeData {
    id: string;
    sessionId: string;
    shapeType?: string | null;
    positionX: number;
    positionY: number;
    contents?: string | null;
    collapsed?: boolean;
    width?: number | null;
    height?: number | null;
    hidden?: boolean;
    codeId?: string | null;
    expandPrompt?: string | null;
}

export interface EdgeData {
    id: string;
    sessionId: string;
    source: string;
    target: string;
    label?: string | null;
    strokeDasharray?: string | null;
    hidden?: boolean;
}

export interface CodeData {
    id?: string;
    sessionId: string;
    nodeId: string;
    code: string;
    prompt?: string | null;
    isValidated?: boolean;
    totalTokens?: number | null;
}

export interface DiagramHistoryData {
    sessionId: string;
    userMessage: string;
    modelMessage: string;
    totalTokens?: number | null;
}

export class DatabaseService {
    // =====================
    // SESSION OPERATIONS
    // =====================

    /**
     * Check if a session exists by identifier
     */
    async sessionExists(sessionIdentifier: string): Promise<boolean> {
        const session = await prisma.session.findUnique({
            where: { sessionIdentifier }
        });
        return !!session;
    }

    /**
     * Create a new session
     */
    async createSession(sessionIdentifier: string): Promise<SessionData> {
        const session = await prisma.session.create({
            data: { sessionIdentifier }
        });
        return session;
    }

    /**
     * Get session by identifier
     */
    async getSession(sessionIdentifier: string): Promise<SessionData | null> {
        const session = await prisma.session.findUnique({
            where: { sessionIdentifier }
        });

        if (session) {
            // Update last access time
            await prisma.session.update({
                where: { id: session.id },
                data: { lastAccess: new Date() }
            });
        }

        return session;
    }

    /**
     * Get session by its internal DB id (cuid)
     */
    async getSessionById(sessionId: string): Promise<SessionData | null> {
        return prisma.session.findUnique({
            where: { id: sessionId }
        });
    }

    /**
     * Update session
     */
    async updateSession(
        sessionId: string,
        data: Partial<Pick<SessionData, 'projectDescription' | 'technicalRequirements'>>
    ): Promise<SessionData> {
        return prisma.session.update({
            where: { id: sessionId },
            data: {
                ...data,
                lastAccess: new Date()
            }
        });
    }


    // =====================
    // NODE OPERATIONS
    // =====================

    /**
     * Save nodes for a session.
     * Uses upsert to update existing nodes and insert new ones.
     *
     * @param nodes
     * @param sessionId
     * @param deleteStale  When true (default), removes DB nodes that are NOT in
     *                     the incoming list. Pass false when the caller is only
     *                     upserting a partial set (e.g. code-generation updates)
     *                     so that nodes missing from the array are kept.
     */
    async saveNodes(nodes: NodeData[], sessionId: string, deleteStale: boolean = true): Promise<void> {
        // Upsert each node (update if exists, create if not)
        await Promise.all(
            nodes.map((node) =>
                prisma.node.upsert({
                    where: {
                        sessionId_id: {
                            sessionId: node.sessionId,
                            id: node.id,
                        },
                    },
                    update: {
                        positionX: node.positionX,
                        positionY: node.positionY,
                        shapeType: node.shapeType,
                        contents: node.contents,
                        collapsed: node.collapsed,
                        width: node.width,
                        height: node.height,
                        hidden: node.hidden,
                        codeId: node.codeId,
                        expandPrompt: node.expandPrompt,
                    },
                    create: node,
                })
            )
        );

        // Only delete stale nodes when explicitly requested (UI-driven full save)
        if (deleteStale) {
            const incomingIds = nodes.map((n) => n.id);
            await prisma.node.deleteMany({
                where: {
                    sessionId,
                    id: { notIn: incomingIds },
                },
            });
        }
    }

    /**
     * Update a single node's codeId field without touching any other nodes.
     * Used by code-generation operations to link a Code record to a Node
     * without risking deletion of unrelated nodes.
     */
    async updateNodeCodeId(sessionId: string, nodeId: string, codeId: string): Promise<void> {
        await prisma.node.update({
            where: {
                sessionId_id: { sessionId, id: nodeId },
            },
            data: { codeId },
        });
    }

    /**
     * Update a single node's expandPrompt field without touching any other nodes.
     * Called after a task is expanded into a subgraph to persist the user's prompt.
     */
    async updateNodeExpandPrompt(sessionId: string, nodeId: string, expandPrompt: string): Promise<void> {
        await prisma.node.update({
            where: {
                sessionId_id: { sessionId, id: nodeId },
            },
            data: { expandPrompt },
        });
    }

    /**
     * Get nodes for a session
     */
    async getNodes(sessionId: string): Promise<NodeData[]> {
        return prisma.node.findMany({
            where: {
                sessionId
            }
        });
    }

    // =====================
    // EDGE OPERATIONS
    // =====================

    /**
     * Save edges for a session.
     * Uses upsert to update existing edges and insert new ones.
     *
     * @param deleteStale  When true (default), removes DB edges that are NOT in
     *                     the incoming list. Pass false for partial updates.
     */
    async saveEdges(edges: EdgeData[], sessionId: string, deleteStale: boolean = true): Promise<void> {
        // Upsert each edge (update if exists, create if not)
        await Promise.all(
            edges.map((edge) =>
                prisma.edge.upsert({
                    where: {
                        sessionId_id: {
                            sessionId: edge.sessionId,
                            id: edge.id,
                        },
                    },
                    update: {
                        source: edge.source,
                        target: edge.target,
                        label: edge.label,
                        strokeDasharray: edge.strokeDasharray,
                        hidden: edge.hidden,
                    },
                    create: edge,
                })
            )
        );

        // Only delete stale edges when explicitly requested (UI-driven full save)
        if (deleteStale) {
            const incomingIds = edges.map((e) => e.id);
            await prisma.edge.deleteMany({
                where: {
                    sessionId,
                    id: { notIn: incomingIds },
                },
            });
        }
    }

    // =====================
    // CODE OPERATIONS
    // =====================

    /**
     * Save code for a node
     */
    async saveCode(codeData: CodeData) {
        return prisma.code.upsert({
            where: {
                sessionId_nodeId: {
                    sessionId: codeData.sessionId,
                    nodeId: codeData.nodeId
                }
            },
            update: {
                code: codeData.code,
                prompt: codeData.prompt,
                isValidated: codeData.isValidated ?? false,
                ...(codeData.totalTokens !== undefined && { totalTokens: codeData.totalTokens }),
            },
            create: {
                sessionId: codeData.sessionId,
                nodeId: codeData.nodeId,
                code: codeData.code,
                prompt: codeData.prompt,
                isValidated: codeData.isValidated ?? false,
                totalTokens: codeData.totalTokens ?? null,
            }
        });
    }

    /**
     * Get code record for a specific node
     */
    async getCodeByNodeId(sessionId: string, nodeId: string): Promise<CodeData | null> {
        return prisma.code.findUnique({
            where: {
                sessionId_nodeId: { sessionId, nodeId }
            }
        });
    }

    /**
     * Mark code as validated
     */
    async validateCode(sessionId: string, nodeId: string): Promise<void> {
        await prisma.code.update({
            where: { sessionId_nodeId: { sessionId, nodeId } },
            data: { isValidated: true }
        });
    }

    /**
     * Mark code as invalidated (e.g. after manual edit or regeneration)
     */
    async invalidateCode(sessionId: string, nodeId: string): Promise<void> {
        await prisma.code.update({
            where: { sessionId_nodeId: { sessionId, nodeId } },
            data: { isValidated: false }
        });
    }

    /**
     * Delete code records that are no longer linked to any node in the session.
     * Called during save to clean up after undo operations.
     */
    async deleteOrphanedCodes(sessionId: string): Promise<number> {
        // Find all codeIds currently referenced by nodes
        const nodes = await prisma.node.findMany({
            where: { sessionId, codeId: { not: null } },
            select: { codeId: true }
        });
        const linkedCodeIds = new Set(nodes.map((n: { codeId: string | null }) => n.codeId).filter(Boolean));

        // Delete codes for this session that are NOT in the linked set
        const result = await prisma.code.deleteMany({
            where: {
                sessionId,
                ...(linkedCodeIds.size > 0
                    ? { id: { notIn: [...linkedCodeIds] as string[] } }
                    : {})
            }
        });

        if (result.count > 0) {
            console.log(`Deleted ${result.count} orphaned code record(s) for session ${sessionId}`);
        }
        return result.count;
    }

    // =====================
    // DIAGRAM HISTORY OPERATIONS
    // =====================

    /**
     * Save one LLM conversation turn (request + response pair) with token usage.
     */
    async appendDiagramHistoryEntry(entry: DiagramHistoryData): Promise<void> {
        await prisma.diagramHistory.create({
            data: {
                sessionId: entry.sessionId,
                userMessage: entry.userMessage,
                modelMessage: entry.modelMessage,
                totalTokens: entry.totalTokens ?? null,
            }
        });
    }

    /**
     * Get complete diagram history for a session, returned in the format
     * the diagram agent expects (role/parts pairs for each turn).
     */
    async getDiagramHistory(sessionId: string): Promise<Array<{ role: string; content: string }>> {
        const history = await prisma.diagramHistory.findMany({
            where: { sessionId },
            orderBy: { createdAt: 'asc' },
            select: { userMessage: true, modelMessage: true }
        });

        // Expand each pair back into the flat role/content format the agent consumes
        return history.flatMap(row => [
            { role: 'user',  content: row.userMessage  },
            { role: 'model', content: row.modelMessage },
        ]);
    }

    // =====================
    // BULK OPERATIONS
    // =====================

    /**
     * Load complete session data (nodes, edges, codes)
     * Reconstructs the graph structure from individual records
     */
    async loadSessionData(sessionId: string) {
        const [session, nodes, edges, codes] = await Promise.all([
            prisma.session.findUnique({ where: { id: sessionId } }),
            prisma.node.findMany({
                where: { sessionId },
                orderBy: { id: 'asc' }
            }),
            prisma.edge.findMany({
                where: { sessionId },
                orderBy: { id: 'asc' }
            }),
            prisma.code.findMany({ where: { sessionId } })
        ]);

        return {
            session,
            nodes,
            edges,
            codes
        };
    }

    /**
     * Get all session identifiers (for session selection)
     */
    async getAllSessionIdentifiers(): Promise<string[]> {
        const sessions = await prisma.session.findMany({
            where: {
                hidden: false
            },
            select: {
                sessionIdentifier: true
            },
            orderBy: {
                lastAccess: 'desc'
            }
        });

        return sessions.map((s: { sessionIdentifier: string }) => s.sessionIdentifier);
    }
}

// Singleton instance
export const db = new DatabaseService();

