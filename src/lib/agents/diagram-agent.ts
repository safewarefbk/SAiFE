import { getDiagramModel, HumanMessage, historyToMessages } from './models';
import { sessionStore } from './session-store';

const DIAGRAM_SYSTEM_PROMPT = `You are a requirements analyst. Your task is to generate an Initial Requirements Model of a software system as a tree-structured graph in JSON format, with two sections: nodes and edges.

Node types:
- Circle = functional goal (main or sub-goal).
- Capsule = logical operator AND.
- Hexagon = task (implementable activity).
- Round-rectangle = soft goal (non-functional requirement).

Rules:
1. General structure:
    - Only one main functional goal (circle) as the root.
    - Every other node must have at least one parent.
    - Each hexagon (task) must connect to a circle.
    - Each round-rectangle (soft goal) must connect to a hexagon.
    - A circle must be connected to at least two hexagons (tasks) otherwise just use one hexagon.
2. Connections:
    - No duplicate edges between two nodes.
    - Only edges to soft goals MUST be dotted.
    - Dotted edges to soft goals MUST have a '+' if the impact is positive or a '-' label in the middle of the edge.
    - A node cannot have both + and - impacts to the same soft goal.
    - All other edges must be solid.
3. AND operator:
    - Use capsule: AND only if a node has two or more children.
    - The AND operator must be placed above its children.
4. Layout:
    - NEVER make nodes overlap.
    - Edges must NEVER cross other edges or nodes.
    - Subtrees must be visually well composed and distinguishable.
    - Nodes at the same y-axis MUST be at least 400px apart on the x-axis.
    - Edges MUST be at least 30px long.
5. Style:
    - Keep it concise and simple.
    - The text of the nodes must NEVER be longer than the node itself.
    - Remember to implement cybersecurity requirements.
    - Use short text for node contents.
    - Remember to insert the '+' or '-' label on dotted edges to soft goals.
    - All nodes must have color #438D57.
    - Node sizes must be consistent with the provided example.
    - IMPORTANT: "style.width" and "style.height" must be NUMERIC values, not strings with "px".
    - Edges must follow this format:
    {
        "type": "editable-edge",
        "style": { "strokeWidth": 2 },
        "source": "nodeId1",
        "sourceHandle": "top",
        "target": "nodeId2",
        "targetHandle": "bottom",
        "id": "xy-edge__nodeId1top-nodeId2bottom"
    }

Here is an example of the expected JSON format:
{
  "nodes": [
    {
      "id": "1",
      "type": "shape",
      "position": { "x": 400, "y": 50 },
      "style": { "width": 200, "height": 70 },
      "data": { "type": "circle", "contents": "Order Food Online", "color": "#438D57" }
    },
    {
      "id": "2",
      "type": "shape",
      "position": { "x": 400, "y": 180 },
      "style": { "width": 42, "height": 22 },
      "data": { "type": "capsule", "contents": "AND", "color": "#438D57" }
    },
    {
      "id": "3",
      "type": "shape",
      "position": { "x": 200, "y": 300 },
      "style": { "width": 200, "height": 70 },
      "data": { "type": "circle", "contents": "Browse Menu", "color": "#438D57" }
    }
  ],
  "edges": [
    {
      "type": "editable-edge",
      "style": { "strokeWidth": 2 },
      "source": "2",
      "sourceHandle": "top",
      "target": "1",
      "targetHandle": "bottom",
      "id": "xy-edge__2top-1bottom"
    },
    {
      "type": "editable-edge",
      "style": { "strokeWidth": 2 },
      "source": "3",
      "sourceHandle": "top",
      "target": "2",
      "targetHandle": "bottom",
      "id": "xy-edge__3top-2bottom"
    }
  ]
}

Output only the JSON, no explanations.`;

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
            ? "Include also non-functional requirements (soft goals, round-rectangle nodes) in the model."
            : "Do NOT include non-functional requirements (no soft goals, no round-rectangle nodes) in the model.";

        const fullPrompt = `${DIAGRAM_SYSTEM_PROMPT}

${nonFunctionalInstruction}

The system to be modeled is described as: ${
            description || "I don't have any ideas currently so, you can create requirements for any software project as an example"
        }`;

        const response = await model.invoke([new HumanMessage(fullPrompt)]);
        const rawResponse = typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);

        const responseText = extractJson(rawResponse);

        // Create session and store history on server
        const sessionId = sessionStore.create({
            projectDescription: description,
            history: [
                { role: "user", parts: [{ text: fullPrompt }] },
                { role: "model", parts: [{ text: responseText }] }
            ]
        });

        return { sessionId, diagram: responseText };
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

        const taskPrompt = `Now, focus ONLY on the task: ${taskName}. Generate a smaller requirements graph than the previous one, the number of nodes MUST be reduced, for this specific task, keeping the context of the original description, and using the same exact rules.
NEVER include nodes that are not related to this specific task, or that are already implemented in previous graphs. Always use the name of the task for the root node.
Output only the JSON, no explanations.`;

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

        return { diagram: responseText };
    }
}

export const diagramAgent = new DiagramAgent();

