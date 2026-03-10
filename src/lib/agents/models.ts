import {createAgent} from "langchain";
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";
import {ChatMistralAI} from "@langchain/mistralai";
import {HumanMessage, AIMessage, BaseMessage} from "@langchain/core/messages";

/**
 * Model factory with system prompts built-in
 */

let geminiProModel: ChatGoogleGenerativeAI | null = null;
let geminiFlashModel: ChatGoogleGenerativeAI | null = null;


const DIAGRAM_MODEL_SYSTEM_PROMPT = `You are a Senior Secure Software Architect and your task is to generate a Goal Model as JSON with {nodes, edges}.

NODE TYPES:
- Circle = goal (functional requirement / objective)
- Capsule = AND (decomposition operator)
- Hexagon = task (concrete action / leaf-level work item)

STRUCTURAL RULES:
- Exactly ONE root circle (the strategic, top-level goal).
- Every other node must be reachable from the root.
- Decomposition hierarchy: tasks → AND → goals/sub-goals.
- A goal with 2+ children MUST use an AND capsule as intermediary.
- A goal with only 1 child MUST be a task instead (no single-child goals).
- Tasks are always leaf nodes — they have no children.
- No duplicate edges. No orphan nodes.
- Node labels must be short, descriptive, and action-oriented for tasks.
- Exclude all soft-goal nodes.

OUTPUT FORMAT:
- position: use {"x":0,"y":0} for every node (layout is computed separately).
- style: use {"width":200,"height":70} for circles/hexagons, {"width":50,"height":30} for capsules.
- Each node: {"id":"<unique>","type":"shape","position":{"x":0,"y":0},"style":{...},"data":{"type":"<circle|capsule|hexagon>","contents":"<label>"}}
- Each edge: {"type":"editable-edge","style":{"strokeWidth":2},"source":"<id>","sourceHandle":"top","target":"<id>","targetHandle":"bottom","id":"xy-edge__<source>top-<target>bottom"}

EXAMPLE:
{"nodes":[{"id":"1","type":"shape","position":{"x":0,"y":0},"style":{"width":200,"height":70},"data":{"type":"circle","contents":"Goal1"}},{"id":"2","type":"shape","position":{"x":0,"y":0},"style":{"width":50,"height":30},"data":{"type":"capsule","contents":"AND"}},{"id":"3","type":"shape","position":{"x":0,"y":0},"style":{"width":200,"height":70},"data":{"type":"hexagon","contents":"Task1 Goal1"}},{"id":"4","type":"shape","position":{"x":0,"y":0},"style":{"width":200,"height":70},"data":{"type":"hexagon","contents":"Task2 Goal1"}}],"edges":[{"type":"editable-edge","style":{"strokeWidth":2},"source":"2","sourceHandle":"top","target":"1","targetHandle":"bottom","id":"xy-edge__2top-1bottom"},{"type":"editable-edge","style":{"strokeWidth":2},"source":"3","sourceHandle":"top","target":"2","targetHandle":"bottom","id":"xy-edge__3top-2bottom"},{"type":"editable-edge","style":{"strokeWidth":2},"source":"4","sourceHandle":"top","target":"2","targetHandle":"bottom","id":"xy-edge__4top-2bottom"}]}
Output JSON only.`;


const CODE_MODEL_SYSTEM_PROMPT_BASE = `You are a Senior Secure Software Architect who writes clean, efficient ` +
    `code. Secure by Design and Secure by Default must apply to EVERY piece of code you produce. Output ONLY code.`;

/**
 * Build the code model system prompt, optionally injecting project context.
 * - projectDescription: the formal description of the system (what it does)
 * - technicalRequirements: language, frameworks, libraries, architecture constraints
 * Both are appended to the static base so the model treats them as
 * standing constraints for the entire session rather than per-request hints.
 */
function buildCodeSystemPrompt(projectDescription?: string, technicalRequirements?: string): string {
    let prompt = CODE_MODEL_SYSTEM_PROMPT_BASE;
    if (projectDescription) {
        prompt += `\n\nProject context: ${projectDescription}`;
    }
    if (technicalRequirements) {
        prompt += `\n\nTechnical constraints (apply to every response): ${technicalRequirements}`;
    }
    return prompt;
}

/**
 * Gemini Pro model for diagram generation - includes system prompt
 */
export function getGeminiProModel(): ChatGoogleGenerativeAI {
    if (!geminiProModel) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI API key not configured");

        geminiProModel = new ChatGoogleGenerativeAI({
            model: "gemini-3-flash-preview",
            apiKey,
        });
    }
    return geminiProModel;
}

export async function getDiagramModel() {
    const model = getGeminiProModel();
    return createAgent({
        model,
        tools: [],
        systemPrompt: DIAGRAM_MODEL_SYSTEM_PROMPT
    });
}

/**
 * Gemini Flash model for code generation - includes system prompt
 */
export function getGeminiFlashModel(): ChatGoogleGenerativeAI {
    if (!geminiFlashModel) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI API key not configured");

        geminiFlashModel = new ChatGoogleGenerativeAI({
            model: "gemini-3-flash-preview",
            apiKey,
        });
    }
    return geminiFlashModel;
}

export async function getCodeModel(projectDescription?: string, technicalRequirements?: string) {
    const model = getGeminiFlashModel();
    return createAgent({
        model,
        tools: [],
        systemPrompt: buildCodeSystemPrompt(projectDescription, technicalRequirements)
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

