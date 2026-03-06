import {type ClassValue, clsx} from "clsx";
import {twMerge} from "tailwind-merge";
import {Node, Edge} from "@xyflow/react";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// =====================
// NODE COLOR SYSTEM
// =====================
// Color is NEVER stored in DB or JSON — it is derived at render time.

export interface NodeColorConfig {
    /** Internal / fill color */
    fill: string;
    /** Border color (darker shade of fill) */
    stroke: string;
}

// Palette per node state — uniform pastel (soft, low-saturation) colors
const COLORS: Record<string, NodeColorConfig> = {
    // Default — fresh node, no code (pastel blue)
    default:   { fill: '#A3C4F3', stroke: '#6B9AD6' },
    // Node has code but NOT yet validated (pastel orange)
    hasCode:   { fill: '#FFD6A5', stroke: '#D4A060' },
    // Code has been validated (pastel green)
    validated: { fill: '#A8D5BA', stroke: '#6AAF84' },
    // Capsule (AND) nodes — neutral connector (pastel grey)
    capsule:   { fill: '#C8CDD3', stroke: '#8E959E' },
};

/**
 * Resolve the full color config for a node based on its data.
 */
export function getNodeColorConfig(nodeData: any, isValidated: boolean = false): NodeColorConfig {
    if (nodeData?.type === 'capsule') return COLORS.capsule;
    if (isValidated) return COLORS.validated;
    if (nodeData?.hasCode || nodeData?.codeId) return COLORS.hasCode;
    return COLORS.default;
}

/**
 * Simple flat-color helper (backwards-compatible, used by minimap etc.)
 */
export function getNodeColor(nodeData: any, isValidated: boolean = false): string {
    return getNodeColorConfig(nodeData, isValidated).fill;
}


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

/**
 * Find all descendants (children, grandchildren, etc.) of a given node
 * This is used for collapse/expand functionality
 */
export const findAllDescendants = (nodeId: string, nodes: Node[], edges: Edge[]): string[] => {
    const descendants: string[] = [];
    const queue: string[] = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        // Find all edges where the current node is the target (children are sources)
        const childEdges = edges.filter(edge => edge.target === currentId);

        for (const edge of childEdges) {
            const childId = edge.source;
            if (!visited.has(childId)) {
                descendants.push(childId);
                queue.push(childId);
            }
        }
    }

    return descendants;
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

/**
 * Logs token usage from an AIMessage's usage_metadata to the console.
 * Returns the total token count (or null if unavailable) so callers can persist it.
 */
export function logTokenUsage(label: string, message: any): number | null {
    const usage = message?.usage_metadata;
    if (!usage) return null;
    const parts: string[] = [];
    if (usage.input_tokens !== undefined)  parts.push(`input=${usage.input_tokens}`);
    if (usage.output_tokens !== undefined) parts.push(`output=${usage.output_tokens}`);
    if (usage.input_token_details?.cache_read !== undefined)
        parts.push(`cache_read=${usage.input_token_details.cache_read}`);
    if (usage.output_token_details?.reasoning !== undefined)
        parts.push(`thinking=${usage.output_token_details.reasoning}`);
    if (usage.total_tokens !== undefined)  parts.push(`total=${usage.total_tokens}`);
    console.log(`[Token usage] ${label} → ${parts.join(', ')}`);
    return usage.total_tokens ?? null;
}
