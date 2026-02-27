import {createAgent} from "langchain";
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";
import {ChatMistralAI} from "@langchain/mistralai";
import {HumanMessage, AIMessage, BaseMessage} from "@langchain/core/messages";

/**
 * Model factory with system prompts built-in
 */

let geminiDiagramModel: ChatGoogleGenerativeAI | null = null;
let mistralCodeModel: ChatMistralAI | null = null;


const DIAGRAM_MODEL_SYSTEM_PROMPT = `You are a Senior Secure Software Architect and your task is to generate a Goal Model as JSON with {nodes, edges}.

NODE TYPES:
- Circle = goal (functional requirement / objective)
- Capsule = AND (decomposition operator)
- Hexagon = task (concrete action / leaf-level work item)

STRUCTURAL RULES:
- Exactly one root circle (the top-level goal); every other node must have a parent.
- Hierarchy flows: tasks → AND → goals.
- A goal with 2+ children must use an AND capsule as an intermediary.
- A Goal needs 2+ tasks otherwise it must be a task.
- No duplicate edges.
- Include cybersecurity-related requirements as part of the goal tree.
- Node labels must be short and descriptive.
- Exclude all soft-goal nodes.

OUTPUT FORMAT:
- position: use {"x":0,"y":0} for every node (layout is computed separately).
- style: use {"width":200,"height":70} for circles/hexagons, {"width":50,"height":30} for capsules.
- Each node: {"id":"<unique>","type":"shape","position":{"x":0,"y":0},"style":{...},"data":{"type":"<circle|capsule|hexagon>","contents":"<label>"}}
- Each edge: {"type":"editable-edge","style":{"strokeWidth":2},"source":"<id>","sourceHandle":"top","target":"<id>","targetHandle":"bottom","id":"xy-edge__<source>top-<target>bottom"}

EXAMPLE:
{"nodes":[{"id":"1","type":"shape","position":{"x":0,"y":0},"style":{"width":200,"height":70},"data":{"type":"circle","contents":"Goal1"}},{"id":"2","type":"shape","position":{"x":0,"y":0},"style":{"width":50,"height":30},"data":{"type":"capsule","contents":"AND"}},{"id":"3","type":"shape","position":{"x":0,"y":0},"style":{"width":200,"height":70},"data":{"type":"hexagon","contents":"Task1 Goal1"}},{"id":"4","type":"shape","position":{"x":0,"y":0},"style":{"width":200,"height":70},"data":{"type":"hexagon","contents":"Task2 Goal1"}}],"edges":[{"type":"editable-edge","style":{"strokeWidth":2},"source":"2","sourceHandle":"top","target":"1","targetHandle":"bottom","id":"xy-edge__2top-1bottom"},{"type":"editable-edge","style":{"strokeWidth":2},"source":"3","sourceHandle":"top","target":"2","targetHandle":"bottom","id":"xy-edge__3top-2bottom"},{"type":"editable-edge","style":{"strokeWidth":2},"source":"4","sourceHandle":"top","target":"2","targetHandle":"bottom","id":"xy-edge__4top-2bottom"}]}
Output JSON only.`;


const CODE_MODEL_SYSTEM_PROMPT = `You are a Senior Secure Software Architect who writes clean, efficient ` +
    `code in any language with security as the primary directive, ensuring all output is Secure by Design and Secure ` +
    `by Default. Output ONLY code.`

/**
 * Gemini model for diagram generation - includes system prompt
 */
export function getGeminiModel(): ChatGoogleGenerativeAI {
    if (!geminiDiagramModel) {
        const apiKey = process.env.NEXT_PUBLIC_API_KEY;
        if (!apiKey) throw new Error("GEMINI API key not configured");

        geminiDiagramModel = new ChatGoogleGenerativeAI({
            model: "gemini-2.5-flash",
            apiKey,
        });
    }
    return geminiDiagramModel;
}

export async function getDiagramModel() {
    const model = getGeminiModel();
    return createAgent({
        model,
        tools: [],
        systemPrompt: DIAGRAM_MODEL_SYSTEM_PROMPT
    });
}

/**
 * Mistral Codestral model for code generation - includes system prompt
 */
export function getMistralModel(): ChatMistralAI {
    if (!mistralCodeModel) {
        const apiKey = process.env.NEXT_PUBLIC_MISTRAL_API_KEY;
        if (!apiKey) throw new Error("MISTRAL API key not configured");

        mistralCodeModel = new ChatMistralAI({
            model: "codestral-latest",
            apiKey,
        });
    }

    return mistralCodeModel;
}

export async function getCodeModel() {
    const model = getMistralModel();
    return createAgent({
        model,
        tools: [],
        systemPrompt: CODE_MODEL_SYSTEM_PROMPT
    });
}

/**
 * Convert history format to LangChain messages
 */
export function historyToMessages(
    history: Array<{ role: string; parts: Array<{ text: string }> }>
): BaseMessage[] {
    return history.map(h => {
        const text = h.parts[0]?.text || '';
        return h.role === 'user' ? new HumanMessage(text) : new AIMessage(text);
    });
}

export {HumanMessage, AIMessage};

