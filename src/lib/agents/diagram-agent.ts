import {getDiagramModel, HumanMessage, historyToMessages} from './models';
import {applyTreeLayout} from '@/lib/tree-layout';
import {logTokenUsage} from '@/lib/utils';

// NODE TYPES:
//- Round-rectangle = soft-goal
// RULES:
// - Tasks→AND→goals; goals→AND→soft-goals
// - Soft-goal edges: dotted with "+" or "-" label; others: solid

/**
 * Extract clean JSON from LLM response (handles markdown code blocks)
 */
function extractJson(text: string): string {
    let cleaned = text.trim();
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
    }
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }
    return cleaned;
}

/**
 * Post-process diagram JSON:
 *  1. Add required flags (collapsed)
 *  2. Compute tree layout positions (the LLM returns {x:0,y:0} for every node)
 */
function postProcessDiagramJson(jsonString: string): string {
    try {
        const diagram = JSON.parse(jsonString);
        if (diagram.nodes && Array.isArray(diagram.nodes)) {
            diagram.nodes = diagram.nodes.map((node: any) => {
                if (!node.data) node.data = {};
                if (node.data.collapsed === undefined) node.data.collapsed = false;
                return node;
            });
        }

        // Compute hierarchical tree positions from the structural edges
        applyTreeLayout(diagram);

        return JSON.stringify(diagram);
    } catch (e) {
        console.error('Failed to post-process diagram JSON:', e);
        return jsonString;
    }
}

/**
 * Agent for generating requirements diagrams.
 * Pure LLM interaction — no DB logic. All DB operations are the caller's responsibility.
 */
export class DiagramAgent {

    /**
     * Start a new diagram generation session.
     * Returns the generated diagram JSON and the user/model messages to be stored by the caller.
     */
    async startSession(
        description: string,
        includeNonFunctional: boolean
    ): Promise<{
        diagram: string;
        userMessage: string;
        modelMessage: string;
        totalTokens: number | null;
    }> {
        const model = await getDiagramModel();

        const descriptionOrDefault = description || "Create requirements for a random software project.";
        const fullPrompt = `Model the system described as: ${descriptionOrDefault}`;

        const response = await model.invoke({messages: [new HumanMessage(fullPrompt)]});
        const lastMessage = response.messages[response.messages.length - 1];
        const totalTokens = logTokenUsage('diagram/startSession', lastMessage);
        const rawResponse = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);

        const cleanedJson = extractJson(rawResponse);
        const responseText = postProcessDiagramJson(cleanedJson);

        return {
            diagram: responseText,
            userMessage: fullPrompt,
            modelMessage: responseText,
            totalTokens,
        };
    }

    /**
     * Expand a task into a sub-diagram.
     * Receives conversation history from the caller (loaded from DB).
     * Returns the generated diagram JSON and the user/model messages to be stored by the caller.
     * @param userInstructions - Optional user-provided instructions for the expansion.
     */
    async expandTask(
        taskName: string,
        history: Array<{ role: string; parts: Array<{ text: string }> }>,
        userInstructions?: string
    ): Promise<{
        diagram: string;
        userMessage: string;
        modelMessage: string;
        totalTokens: number | null;
    }> {
        if (history.length === 0) {
            throw new Error("No conversation history provided. Session may not have been initialized properly.");
        }

        const model = await getDiagramModel();

        let taskPrompt = `Consider task "${taskName}" a goal and expand it.` +
            `\nRules: leaf tasks must be more specific than parent, same format, exclude unrelated.` +
            `\nJSON only with task name as root`;

        if (userInstructions) {
            taskPrompt += `\nAdditional instructions: ${userInstructions}`;
        }

        const historyMessages = historyToMessages(history);
        const messages = [...historyMessages, new HumanMessage(taskPrompt)];

        const response = await model.invoke({messages});
        const lastMessage = response.messages[response.messages.length - 1];
        const totalTokens = logTokenUsage('diagram/expandTask', lastMessage);
        const rawResponse = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);

        const cleanedJson = extractJson(rawResponse);
        const responseText = postProcessDiagramJson(cleanedJson);

        return {
            diagram: responseText,
            userMessage: taskPrompt,
            modelMessage: responseText,
            totalTokens,
        };
    }
}

export const diagramAgent = new DiagramAgent();

