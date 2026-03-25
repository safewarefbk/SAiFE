/**
 * Session Management Utility
 * Handles database session operations
 */

/**
 * Load session data from the database
 */
export const loadSessionFromDatabase = async (sessionIdentifier: string) => {
    const response = await fetch('/api/session/load', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sessionIdentifier})
    });

    if (!response.ok) {
        throw new Error('Failed to load session');
    }

    return await response.json();
};

/**
 * Create a new session in the database
 */
export const createSessionInDatabase = async (sessionIdentifier: string) => {
    const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sessionIdentifier})
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create session');
    }

    return await response.json();
};

/**
 * Update session with project description and technical requirements
 */
export const updateSessionMetadata = async (
    sessionIdentifier: string,
    projectDescription: string,
    technicalRequirements: string,
) => {
    await fetch('/api/session/create', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            sessionIdentifier,
            projectDescription,
            technicalRequirements,
        })
    });
};

/**
 * Save graph data to the database (manual save only)
 * Converts React Flow nodes/edges to database format with explicit columns
 */
export const saveGraphToDatabase = async (
    sessionIdentifier: string,
    nodes: any[],
    edges: any[]
) => {
    await fetch('/api/session/save-graph', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            sessionIdentifier,
            nodes: nodes.map(node => ({
                id: node.id,
                shapeType: node.data?.type,
                positionX: node.position?.x || 0,
                positionY: node.position?.y || 0,
                contents: node.data?.contents,
                collapsed: node.data?.collapsed || false,
                codeId: node.data?.codeId || null,
                width: node.measured?.width || node.width,
                height: node.measured?.height || node.height,
                hidden: node.hidden || false
            })),
            edges: edges.map(edge => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: edge.label,
                strokeDasharray: edge.style?.strokeDasharray || null,
                hidden: edge.hidden || false
            }))
        })
    });
};

/**
 * Save code to the database and return the code ID
 */
export const saveCodeToDatabase = async (
    sessionIdentifier: string,
    nodeId: string,
    code: string,
    prompt: string,
    isValidated: boolean,
    totalTokens?: number | null
): Promise<string> => {
    const response = await fetch('/api/session/save-code', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            sessionIdentifier,
            nodeId,
            code,
            prompt,
            isValidated,
            totalTokens: totalTokens ?? null
        })
    });

    if (!response.ok) {
        throw new Error('Failed to save code to database');
    }

    const data = await response.json();
    return data.codeId;  // Return the code ID from the database
};

/**
 * Mark code as validated in the database
 */
export const validateCodeInDatabase = async (
    sessionIdentifier: string,
    nodeId: string
): Promise<void> => {
    const response = await fetch('/api/session/validate-code', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sessionIdentifier, nodeId, validated: true })
    });
    if (!response.ok) throw new Error('Failed to validate code in database');
};

/**
 * Mark code as invalidated in the database (after edit or regeneration)
 */
export const invalidateCodeInDatabase = async (
    sessionIdentifier: string,
    nodeId: string
): Promise<void> => {
    const response = await fetch('/api/session/validate-code', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sessionIdentifier, nodeId, validated: false })
    });
    if (!response.ok) throw new Error('Failed to invalidate code in database');
};

/**
 * Delete the code record for a node and clear its codeId in the nodes table.
 */
export const deleteCodeFromDatabase = async (
    sessionIdentifier: string,
    nodeId: string
): Promise<void> => {
    const response = await fetch('/api/session/delete-code', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sessionIdentifier, nodeId })
    });
    if (!response.ok) throw new Error('Failed to delete code from database');
};


