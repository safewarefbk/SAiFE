import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";

/**
 * Model factory with system prompts built-in
 */

let geminiDiagramModel: ChatGoogleGenerativeAI | null = null;
let mistralCodeModel: ChatMistralAI | null = null;

/**
 * Gemini model for diagram generation - includes system prompt
 */
export function getDiagramModel(): ChatGoogleGenerativeAI {
    if (!geminiDiagramModel) {
        const apiKey = process.env.NEXT_PUBLIC_API_KEY;
        if (!apiKey) throw new Error("GEMINI API key not configured");

        geminiDiagramModel = new ChatGoogleGenerativeAI({
            model: "gemini-2.5-flash",
            // temperature: 0.7,
            apiKey,
            // maxOutputTokens: 65365,
        });
    }
    return geminiDiagramModel;
}

/**
 * Mistral Codestral model for code generation - includes system prompt
 */
export function getCodeModel(): ChatMistralAI {
    if (!mistralCodeModel) {
        const apiKey = process.env.NEXT_PUBLIC_MISTRAL_API_KEY;
        if (!apiKey) throw new Error("MISTRAL API key not configured");

        mistralCodeModel = new ChatMistralAI({
            model: "codestral-latest",
            temperature: 0.2,
            apiKey,
        });
    }
    return mistralCodeModel;
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

export { HumanMessage, AIMessage };

