import { getCodeModel, HumanMessage } from './models';

// System context is embedded in prompts since Mistral Codestral works best this way
const CODE_CONTEXT = `You are a senior software engineer and security expert. 
Follow OWASP Top 10 and CWE guidelines. Output ONLY code, no explanations.`;

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

        const prompt = `${CODE_CONTEXT}

Generate secure code for the task: ${taskName}

Instructions:
- Divide the code in logical functions based on functionality.
- Keep code short and focused; avoid placeholders if not necessary.
- Use ${language} as programming language.
- Ensure code is clean, well-structured, and follows best practices.
- Protect against common vulnerabilities (e.g., SQL injection, XSS).
- If ${language} is Java, implement a compilable single class.
- Generate a single file with secure functions.
- If no code is needed, respond with "No code needed for this task."
- Always use the name of the task for naming the class.`;

        const response = await model.invoke([new HumanMessage(prompt)]);
        const code = typeof response.content === 'string'
            ? response.content
            : String(response.content);

        return { code, prompt };
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

        const prompt = `${CODE_CONTEXT}

Original task requirements:
${originalPrompt}

Current code implementation:
${currentCode}

Additional modification instructions:
${additionalPrompt}

Modify the current code to incorporate these additional instructions while maintaining the original requirements. Output ONLY the complete modified code.`;

        const response = await model.invoke([new HumanMessage(prompt)]);
        const code = typeof response.content === 'string'
            ? response.content
            : String(response.content);

        return { code };
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
            prompt = `${CODE_CONTEXT}

You have code snippets from multiple sub-components that implement the functional goal: "${goal}".

Aggregate these into a cohesive implementation.

Code snippets:
${codeSnippets}

Instructions:
- Integrate all code snippets into a unified implementation, do not add new code.
- Remove duplications and resolve any conflicts between snippets.
- Ensure the code flows logically and all parts work together.
- Use ${language} as programming language.
- Keep the code clean, maintainable, and secure.
- If ${language} is Java, create a compilable single class or properly structured classes.
- The code should be applicable for: ${projectDescription}.

Output ONLY the integrated code. Do NOT add comments like "// code from task X".`;
        } else {
            prompt = `${CODE_CONTEXT}

You have code snippets from ALL major components for: "${goal}".

Create a COMPLETE, PRODUCTION-READY implementation by integrating all snippets.

Project Description: ${projectDescription}

Code snippets:
${codeSnippets}

Instructions:
- Integrate all code snippets into a cohesive system, do not add new code.
- Ensure each function is used at least once, otherwise add comment //unused.
- Remove duplications and resolve conflicts.
- Add necessary main entry points, configuration, and initialization code.
- Follow industry best practices and ensure security.
- Use ${language} as programming language.
- If ${language} is Java, create a complete application with proper package structure.
- If ${language} is Python, include necessary imports and a main entry point.
- Add error handling, logging, and proper resource management.

Output ONLY the complete integrated code. If multiple files needed, separate with "// ===== FILE: filename.ext =====".`;
        }

        const response = await model.invoke([new HumanMessage(prompt)]);
        const code = typeof response.content === 'string'
            ? response.content
            : String(response.content);

        return { code, prompt };
    }
}

export const codeAgent = new CodeAgent();

