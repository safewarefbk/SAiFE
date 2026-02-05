import {type ClassValue, clsx} from "clsx";
import {twMerge} from "tailwind-merge";
import {Node, Edge} from "@xyflow/react";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const getDefaultSize = (width: number) => {
    if (width < 1024) {
        return 33;
    } else return 20;
};

export const getCacheKey = (graphIndex: number, nodeId: string) => {
    return `${graphIndex}_${nodeId}`;
};

export const findRootNodes = (nodes: Node[], edges: Edge[]) => {
    return nodes.filter(node => !edges.some(edge => edge.source === node.id));
};

export const findDirectCodeChildren = (nodeId: string, nodes: Node[], edges: Edge[]): string[] => {
    const queue: string[] = [nodeId];
    const visited = new Set<string>();
    const codeNodeIds: string[] = [];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const childEdges = edges.filter(edge => edge.target === currentId);

        for (const edge of childEdges) {
            const childNode = nodes.find(n => n.id === edge.source);
            if (!childNode) continue;

            if (childNode.data?.type === "circle" || childNode.data?.type === "hexagon") {
                codeNodeIds.push(edge.source);
            } else if (childNode.data?.type === "capsule" || childNode.data?.type === "round-rectangle") {
                queue.push(edge.source);
            }
        }
    }

    return codeNodeIds;
};

// Unified language mapping for Monaco
const languageMap: { [key: string]: string } = {
    'py': 'python',
    'python': 'python',
    'js': 'javascript',
    'javascript': 'javascript',
    'ts': 'typescript',
    'typescript': 'typescript',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'c++': 'cpp',
    'cs': 'csharp',
    'c#': 'csharp',
    'csharp': 'csharp',
    'go': 'go',
    'golang': 'go',
    'rb': 'ruby',
    'ruby': 'ruby',
    'php': 'php',
    'rs': 'rust',
    'rust': 'rust',
    'json': 'json',
    'md': 'markdown',
    'markdown': 'markdown',
};

// Checks for language keywords/acronyms/extensions in any text.
// Languages matched Monaco Editor naming conventions.
export function detectProgrammingLanguage(text: string): string {
    const lower = text.toLowerCase();
    for (const [pattern, language] of Object.entries(languageMap)) {
        // Match as a word, acronym, or extension
        const regex = new RegExp(`\\b${pattern.replace(/[.+]/g, "\\$&")}\\b`);
        if (regex.test(lower)) {
            return language;
        }
    }
    // Fallback
    return 'python';
}
