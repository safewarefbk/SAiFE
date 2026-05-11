/**
 * Chat Agent — streaming conversational AI.
 *
 * Used as a baseline comparison against the guided goal-model approach.
 * Reuses the existing model pool (API keys, LangChain config).
 * Maintains conversation history for multi-turn context.
 *
 * Exports:
 *  - buildChatMessages     — construct the LangChain message list
 *  - getStreamingChatModel — return the model instance for a session
 */

import {HumanMessage, AIMessage, BaseMessage} from '@langchain/core/messages';
import {SystemMessage} from '@langchain/core/messages';
import {getGeminiFlashModel} from './models-pool';

const CHAT_SYSTEM_PROMPT =
    `You are an expert software engineer. The user will describe a software project and you must help them build it. ` +
    `When the user asks you to implement something, produce the full code — not summaries or outlines. ` +
    `Apply secure-by-design principles.`;

export interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Build the LangChain message array: system prompt + history + new user message.
 */
export function buildChatMessages(message: string, history: ChatTurn[] = []): BaseMessage[] {
    return [
        new SystemMessage(CHAT_SYSTEM_PROMPT),
        ...history.map(t =>
            t.role === 'user' ? new HumanMessage(t.content) : new AIMessage(t.content),
        ),
        new HumanMessage(message),
    ];
}

/**
 * Return the streaming Gemini Flash model bound to the given session
 * (deterministic key rotation via models-pool).
 */
export function getStreamingChatModel(sessionId: string) {
    return getGeminiFlashModel(sessionId);
}
