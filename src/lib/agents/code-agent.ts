import {HumanMessage} from './agents';
import {logTokenUsage} from '@/lib/utils';

/**
 * Strip markdown code fences from an LLM response.
 * Removes only the opening fence line (e.g. ```python) and the closing fence line (```).
 * Any ``` that appears *inside* the code is left untouched.
 */
function stripCodeFences(raw: string): string {
    const lines = raw.trim().split('\n');

    // Remove opening fence line if present (e.g. ```python, ```go, ```)
    if (lines.length > 0 && /^```[\w]*$/.test(lines[0].trim())) {
        lines.shift();
    }

    // Remove closing fence line if present
    if (lines.length > 0 && lines[lines.length - 1].trim() === '```') {
        lines.pop();
    }

    return lines.join('\n').trim();
}

/**
 * Agent for generating and modifying code.
 * Pure LLM interaction — no DB logic. All DB operations are the caller's responsibility.
 *
 * Project context (projectDescription, technicalRequirements) is injected into the
 * model's system prompt by the caller via getCodeModel(). The agent methods receive
 * an already-configured model and only deal with task-specific user messages.
 */
export class CodeAgent {

    /**
     * Generate code for a task.
     * @param model - Pre-configured model (system prompt already contains project context).
     * @param taskName - The concrete task to implement.
     */
    async generate(model: any, taskName: string): Promise<{
        code: string;
        prompt: string;
        totalTokens: number | null;
    }> {
        const prompt = `Implement code for the following task: ${taskName}. ` +
            `Only task-specific logic, short/focused, single file.`;

        const response: any = await model.invoke({messages: [new HumanMessage(prompt)]});
        const lastMessage = response.messages[response.messages.length - 1];
        const totalTokens = logTokenUsage('code/generate', lastMessage);
        const raw = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : String(lastMessage.content);
        const code = stripCodeFences(raw);

        return {code, prompt, totalTokens};
    }

    /**
     * Regenerate/modify existing code.
     * @param model - Pre-configured model (system prompt already contains project context).
     * @param originalPrompt - The original generation prompt (loaded from DB by the caller).
     * @param currentCode - The current code to be modified.
     * @param additionalPrompt - The new modification instructions.
     */
    async regenerate(
        model: any,
        originalPrompt: string,
        currentCode: string,
        additionalPrompt: string,
    ): Promise<{ code: string; totalTokens: number | null }> {
        const prompt = `Modify the code below as follows: ${additionalPrompt}` +
            `\nOriginal task prompt: ${originalPrompt}` +
            `\nCurrent code:\n${currentCode}`;

        const response: any = await model.invoke({messages: [new HumanMessage(prompt)]});
        const lastMessage = response.messages[response.messages.length - 1];
        const totalTokens = logTokenUsage('code/regenerate', lastMessage);
        const raw = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : String(lastMessage.content);
        const code = stripCodeFences(raw);

        return {code, totalTokens};
    }

    /**
     * Aggregate multiple code snippets into a single implementation.
     * @param model - Pre-configured model (system prompt already contains project context).
     * @param type - Node type: 'sub-goal' or 'root-goal'.
     * @param goal - The goal/task name to implement.
     * @param childrenCode - Array of child code snippets to integrate.
     */
    async aggregate(
        model: any,
        type: string,
        goal: string,
        childrenCode: Array<{ type: string; taskName: string; code: string }>,
    ): Promise<{ code: string; prompt: string; totalTokens: number | null }> {
        const codeSnippets = childrenCode.map((child, index) =>
            `\n--- ${child.type} ${index + 1}: ${child.taskName} ---\n${child.code}`
        ).join('\n\n');

        let prompt: string;

        if (type === "sub-goal") {
            prompt = `Goal: ${goal}\n` +
                `Merge the following task implementations into a single cohesive module for this goal.\n` +
                `Resolve duplicates and conflicts. Keep only goal-relevant logic.\n` +
                `Multiple files → separate with "// ===== FILE: name.ext ====="\n` +
                `Snippets:\n${codeSnippets}`;
        } else { // type === "root-goal"
            prompt = `Root goal: ${goal}\n` +
                `Merge all snippets below into a complete, executable system.\n` +
                `Add entry point, wiring, and any glue code needed to make it runnable.\n` +
                `Multiple files → separate with "// ===== FILE: name.ext ====="\n` +
                `Snippets:\n${codeSnippets}`;
        }

        const response: any = await model.invoke({messages: [new HumanMessage(prompt)]});
        const lastMessage = response.messages[response.messages.length - 1];
        const totalTokens = logTokenUsage('code/aggregate', lastMessage);
        const raw = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : String(lastMessage.content);
        const code = stripCodeFences(raw);

        return {code, prompt, totalTokens};
    }
}

export const codeAgent = new CodeAgent();
