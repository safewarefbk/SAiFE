/**
 * LLM Operations Utility
 * Handles all LLM API calls for diagram and code generation
 */

/**
 * Generate initial diagram from description
 */
export const generateDiagram = async (description: string, includeNonFunctional: boolean, dbSessionId: string) => {
    const response = await fetch('/api/llm/diagram/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, includeNonFunctional, dbSessionId }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate diagram');
    }

    return await response.json();
};

/**
 * Generate task diagram (subgraph for a specific task)
 * @param userPrompt - Optional user instructions for the subgraph expansion
 */
export const generateTaskDiagram = async (dbSessionId: string, taskName: string, userPrompt?: string) => {
    const response = await fetch('/api/llm/diagram/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbSessionId, taskName, userPrompt }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate task diagram');
    }

    return await response.json();
};

/**
 * Generate code for a leaf task.
 * @param sessionId - The DB session ID (used server-side to load project context).
 * @param nodeId - The node ID (used server-side to link code to a node).
 * @param taskName - The task name.
 */
export const generateCode = async (
    sessionId: string,
    nodeId: string,
    taskName: string,
) => {
    const response = await fetch('/api/llm/code/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, nodeId, taskName }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate code');
    }

    return await response.json();
};

/**
 * Regenerate code with new instructions.
 * @param sessionId - The DB session ID.
 * @param nodeId - The node ID (used server-side to load the original prompt from DB).
 * @param currentCode - The current code to be modified.
 * @param newInstructions - The new modification instructions.
 */
export const regenerateCode = async (
    sessionId: string,
    nodeId: string,
    currentCode: string,
    newInstructions: string,
) => {
    const response = await fetch('/api/llm/code/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, nodeId, currentCode, newInstructions }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate code');
    }

    return await response.json();
};

/**
 * Aggregate code from child tasks into parent goal
 */
export const aggregateCode = async (
    type: string,
    goal: string,
    childrenCode: Array<{ taskName: string; code: string; type: string }>,
    sessionId: string
) => {
    const response = await fetch('/api/llm/code/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type,
            goal,
            childrenCode,
            sessionId
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to aggregate code');
    }

    return await response.json();
};
