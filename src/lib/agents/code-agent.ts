import {getCodeModel, HumanMessage} from './models';

/**
 * Agent for generating and modifying code.
 * Pure LLM interaction — no DB logic. All DB operations are the caller's responsibility.
 */
export class CodeAgent {

    /**
     * Generate code for a task.
     * @param taskName - The name/description of the task to implement.
     * @param language - The programming language to use.
     * @param projectDescription - The overall project context (loaded from DB by the caller).
     */
    async generate(taskName: string, language: string, projectDescription: string): Promise<{
        code: string;
        prompt: string;
    }> {
        const model = await getCodeModel();

        const prompt = `In the context of "${projectDescription}" implement code for the following task: ${taskName}.` +
            `\nRules: use ${language}; only task-specific logic, short/focused, single file.`;

        const response: any = await model.invoke({messages: [new HumanMessage(prompt)]});
        const lastMessage = response.messages[response.messages.length - 1];
        const code = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : String(lastMessage.content);

        return {code, prompt};
    }

    /**
     * Regenerate/modify existing code.
     * @param originalPrompt - The original generation prompt (loaded from DB by the caller).
     * @param currentCode - The current code to be modified.
     * @param additionalPrompt - The new modification instructions.
     */
    async regenerate(
        originalPrompt: string,
        currentCode: string,
        additionalPrompt: string
    ): Promise<{ code: string }> {
        const model = await getCodeModel();

        const prompt = `Original prompt: ${originalPrompt}` +
            `\nCurrent code:\n${currentCode}` +
            `\nModify as follows: ${additionalPrompt}` +
            `\nFollow original rules. Output complete modified code only.`;

        const response: any = await model.invoke({messages: [new HumanMessage(prompt)]});
        const lastMessage = response.messages[response.messages.length - 1];
        const code = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : String(lastMessage.content);

        return {code};
    }

    /**
     * Aggregate multiple code snippets into a single implementation.
     * @param type - Node type: 'circle' (goal) or root.
     * @param goal - The goal/task name to implement.
     * @param childrenCode - Array of child code snippets to integrate.
     * @param projectDescription - The overall project context (loaded from DB by the caller).
     */
    async aggregate(
        type: string,
        goal: string,
        childrenCode: Array<{ type: string; taskName: string; code: string }>,
        projectDescription: string
    ): Promise<{ code: string; prompt: string }> {
        const model = await getCodeModel();

        const codeSnippets = childrenCode.map((child, index) =>
            `\n--- ${child.type} ${index + 1}: ${child.taskName} ---\n${child.code}`
        ).join('\n\n');

        let prompt: string;

        if (type === "sub-goal") {
            prompt = `Context: "${projectDescription}"\nGoal: ${goal}\n` +
                `Integrate the following code snippets into a single cohesive implementation.\n` +
                `Rules: merge logic, remove duplicates, resolve conflicts, keep it clean and secure. Only goal-specific logic.\n` +
                `Snippets:\n${codeSnippets}`;
        } else { // type === "main-goal"
            prompt = `Context: "${projectDescription}"\nGoal: ${goal}\n` +
                `Integrate the following code snippets into an EXECUTABLE production-ready system.\n` +
                `Rules: merge logic, remove duplicates, resolve conflicts, keep it clean and secure.\n` +
                `Multiple files → separate with "// ===== FILE: name.ext ====="\n` +
                `Snippets:\n${codeSnippets}`;
        }

        const response: any = await model.invoke({messages: [new HumanMessage(prompt)]});
        const lastMessage = response.messages[response.messages.length - 1];
        const code = typeof lastMessage.content === 'string'
            ? lastMessage.content
            : String(lastMessage.content);

        return {code, prompt};
    }
}

export const codeAgent = new CodeAgent();

