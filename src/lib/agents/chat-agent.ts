/**
 * Agentic Chat Agent — simple request/response conversational AI.
 *
 * Used as a baseline comparison against the guided goal-model approach.
 * Reuses the existing model pool (API keys, LangChain config).
 * Maintains conversation history for multi-turn context.
 */

import {HumanMessage, AIMessage, BaseMessage} from '@langchain/core/messages';
import {SystemMessage} from '@langchain/core/messages';
import {getGeminiFlashModel} from './models-pool';
import {logTokenUsage} from '@/lib/utils';

const CHAT_SYSTEM_PROMPT =
    `You are an expert software engineer. The user will describe a software project and you must help them build it` +
    `When the user asks you to implement something, produce the full code — not summaries or outlines. ` +
    `Apply secure-by-design principles.`;

export interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Send a message to the chat agent with conversation history for context.
 * Returns the assistant's reply and token usage.
 */
export async function chatWithAgent(
    message: string,
    history: ChatTurn[] = [],
    sessionId?: string,
): Promise<{ reply: string; totalTokens: number | null }> {

    const model = getGeminiFlashModel(sessionId);

    // Build message array: system + history + new user message
    const messages: BaseMessage[] = [
        new SystemMessage(CHAT_SYSTEM_PROMPT),
        ...history.map(t =>
            t.role === 'user' ? new HumanMessage(t.content) : new AIMessage(t.content),
        ),
        new HumanMessage(message),
    ];

    const response = await model.invoke(messages);

    const totalTokens = logTokenUsage('Chat Agent', response);

    const reply = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    return {reply, totalTokens};
}