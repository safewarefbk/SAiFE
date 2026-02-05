import {getDiagramModel, HumanMessage, historyToMessages} from './models';
import {sessionStore} from './session-store';

const DIAGRAM_SYSTEM_PROMPT = `Generate an Initial Requirements Model as JSON with {nodes, edges}.

NODE TYPES: circle=goal, capsule=AND, hexagon=task, round-rectangle=soft-goal

RULES:
- Keep high-level: tasks should remain broad (will be expanded later)
- Single root circle; all nodes need parent
- Tasks→circles; soft-goals→tasks
- Circle needs 2+ tasks (else use 1 task)
- AND capsule only when 2+ children
- No duplicate edges; no overlapping nodes/edges
- X spacing ≥400px; edge length ≥30px
- Include cybersecurity requirements
- Short text; color #438D57; width/height as numbers
EXAMPLE:
{"nodes":[{"id":"1","type":"shape","position":{"x":400,"y":50},"style":{"width":200,"height":70},"data":{"type":"circle","contents":"OrderFoodOnline","color":"#438D57"}},{"id":"2","type":"shape","position":{"x":400,"y":180},"style":{"width":42,"height":22},"data":{"type":"capsule","contents":"AND","color":"#438D57"}},{"id":"3","type":"shape","position":{"x":200,"y":300},"style":{"width":200,"height":70},"data":{"type":"circle","contents":"BrowseMenu","color":"#438D57"}}],"edges":[{"type":"editable-edge","style":{"strokeWidth":2},"source":"2","sourceHandle":"top","target":"1","targetHandle":"bottom","id":"xy-edge__2top-1bottom"},{"type":"editable-edge","style":{"strokeWidth":2},"source":"3","sourceHandle":"top","target":"2","targetHandle":"bottom","id":"xy-edge__3top-2bottom"}]}

Output JSON only.`;

/**
 * Extract clean JSON from LLM response (handles markdown code blocks)
 */
function extractJson(text: string): string {
    // Remove markdown code blocks if present
    let cleaned = text.trim();

    // Handle ```json ... ``` or ``` ... ```
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
    }

    // Try to find JSON object/array boundaries
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }

    return cleaned;
}

/**
 * Agent for generating requirements diagrams
 */
export class DiagramAgent {

    /**
     * Start a new diagram generation session
     */
    async startSession(description: string, includeNonFunctional: boolean): Promise<{
        sessionId: string;
        diagram: string;
    }> {
        const model = getDiagramModel();

        const nonFunctionalInstruction = includeNonFunctional
            ? "Include non-functional requirements (soft-goals)." : "Exclude all soft-goal nodes.";
        const descriptionOrDefault = description || "Create requirements for a random software project.";

        const fullPrompt = `${DIAGRAM_SYSTEM_PROMPT} ${nonFunctionalInstruction}` +
            `\nThe system to be modeled is described as: ${descriptionOrDefault}`;

        const response = await model.invoke([new HumanMessage(fullPrompt)]);
        const rawResponse = typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);

        const responseText = extractJson(rawResponse);

        // Create session and store history on server
        const sessionId = sessionStore.create({
            projectDescription: descriptionOrDefault,
            history: [
                {role: "user", parts: [{text: fullPrompt}]},
                {role: "model", parts: [{text: responseText}]}
            ]
        });

        return {sessionId, diagram: responseText};
    }

    /**
     * Expand a task into a sub-diagram
     */
    async expandTask(sessionId: string, taskName: string): Promise<{
        diagram: string;
    }> {
        const session = sessionStore.get(sessionId);
        if (!session) {
            throw new Error("Session not found or expired");
        }

        const model = getDiagramModel();

        const taskPrompt = `Expand task "${taskName}" into sub-graph.` +
            `\nRules: leaf tasks must be more specific than parent, same format, task name as root, exclude unrelated. JSON only.`;

        // Build messages from stored history
        const historyMessages = historyToMessages(session.history);
        const messages = [...historyMessages, new HumanMessage(taskPrompt)];

        const response = await model.invoke(messages);
        const rawResponse = typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);

        const responseText = extractJson(rawResponse);

        // Update session history on server
        sessionStore.appendHistory(sessionId, "user", taskPrompt);
        sessionStore.appendHistory(sessionId, "model", responseText);

        return {diagram: responseText};
    }
}

export const diagramAgent = new DiagramAgent();

