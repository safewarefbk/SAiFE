import {getCodeModel, HumanMessage} from './models';

// System context is embedded in prompts since Mistral Codestral works best this way
const CODE_CONTEXT = `Senior software engineer. OWASP/CWE compliant. Output ONLY code.`;

/**
 * Agent for generating and modifying code
 */
export class CodeAgent {

    /**
     * Generate code for a task
     */
    async generate(taskName: string, language: string): Promise<{
        code: string;
        prompt: string;
    }> {
        const model = getCodeModel();

        const prompt = `${CODE_CONTEXT}` +
            `\nTask: ${taskName} | Lang: ${language}` +
            `\nRules: only task-specific logic, short/focused, secure, single file.`;

        const response = await model.invoke([new HumanMessage(prompt)]);
        const code = typeof response.content === 'string'
            ? response.content
            : String(response.content);

        return {code, prompt};
    }

    /**
     * Regenerate/modify existing code
     */
    async regenerate(
        originalPrompt: string,
        currentCode: string,
        additionalPrompt: string
    ): Promise<{ code: string }> {
        const model = getCodeModel();

        const prompt = `${CODE_CONTEXT}` +
            `\nOriginal prompt: ${originalPrompt}` +
            `\nCurrent code:\n${currentCode}` +
            `\nModify as follow: ${additionalPrompt}` +
            `\nFollow original rules. Output complete modified code only.`;

        const response = await model.invoke([new HumanMessage(prompt)]);
        const code = typeof response.content === 'string'
            ? response.content
            : String(response.content);

        return {code};
    }

    /**
     * Aggregate multiple code snippets
     */
    async aggregate(
        type: string,
        goal: string,
        childrenCode: Array<{ type: string; taskName: string; code: string }>,
        language: string,
        projectDescription: string
    ): Promise<{ code: string; prompt: string }> {
        const model = getCodeModel();

        const codeSnippets = childrenCode.map((child, index) =>
            `\n--- ${child.type} ${index + 1}: ${child.taskName} ---\n${child.code}`
        ).join('\n\n');

        let prompt: string;

        if (type === 'circle') {
            prompt = `${CODE_CONTEXT}` +
                `\nGoal: "${goal}" | Context: ${projectDescription}` +
                `\nSnippets:\n${codeSnippets}` +
                `\nIntegrate provided snippets: merge, remove duplicates, resolve conflicts, clean/secure.`;
        } else {
            prompt = `${CODE_CONTEXT}` +
                `\nGoal: "${goal}" | Context: ${projectDescription}` +
                `\nSnippets:\n${codeSnippets}` +
                `\nCreate EXECUTABLE production-ready system.` +
                `\nIntegrate provided snippets: merge, remove duplicates, resolve conflicts, clean/secure.` +
                `\nMultiple files→separate with "// ===== FILE: name.ext ====="`;
        }

        const response = await model.invoke([new HumanMessage(prompt)]);
        const code = typeof response.content === 'string'
            ? response.content
            : String(response.content);

        return {code, prompt};
    }
}

export const codeAgent = new CodeAgent();

