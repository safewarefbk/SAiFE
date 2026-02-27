/**
 * Tree Layout Algorithm
 *
 * Computes hierarchical (top-down) positions for a goal-model tree.
 * The LLM outputs nodes at {x:0,y:0}; this module assigns real coordinates
 * based on the tree structure derived from edges.
 *
 * Layout strategy:
 *  - Root at top center.
 *  - Each depth level is placed further down (Y increases).
 *  - Siblings are spread horizontally so that no two nodes overlap.
 *  - A Reingold–Tilford-style bottom-up pass computes subtree widths,
 *    then a top-down pass assigns final X coordinates.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const HORIZONTAL_GAP = 40;   // Min gap between adjacent sibling subtrees
const VERTICAL_GAP = 100;     // Gap between depth levels

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface TreeNode {
    id: string;
    width: number;
    height: number;
    children: TreeNode[];
    /** Computed subtree width (including all descendants + gaps) */
    subtreeWidth: number;
    /** Final position */
    x: number;
    y: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNodeSize(node: any): { width: number; height: number } {
    const w = node.style?.width ?? (node.data?.type === 'capsule' ? 50 : 200);
    const h = node.style?.height ?? (node.data?.type === 'capsule' ? 30 : 70);
    return {
        width: typeof w === 'number' ? w : parseInt(w) || 200,
        height: typeof h === 'number' ? h : parseInt(h) || 70,
    };
}

/**
 * Build an adjacency map from edges.
 * In the goal-model convention edges flow bottom→top:
 *   edge.source = child, edge.target = parent.
 */
function buildChildrenMap(edges: any[]): Map<string, string[]> {
    const childrenOf = new Map<string, string[]>();
    for (const edge of edges) {
        const parent = edge.target;
        const child = edge.source;
        if (!childrenOf.has(parent)) childrenOf.set(parent, []);
        childrenOf.get(parent)!.push(child);
    }
    return childrenOf;
}

/**
 * Find the root node (a node that never appears as a source / child in any edge).
 * Fallback: first node in the array.
 */
function findRoot(nodes: any[], edges: any[]): string {
    const childIds = new Set(edges.map((e: any) => e.source));
    for (const node of nodes) {
        if (!childIds.has(node.id)) return node.id;
    }
    return nodes[0]?.id;
}

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

function buildTree(
    nodeId: string,
    nodeMap: Map<string, any>,
    childrenOf: Map<string, string[]>,
): TreeNode {
    const raw = nodeMap.get(nodeId);
    const { width, height } = raw ? getNodeSize(raw) : { width: 200, height: 70 };

    const childIds = childrenOf.get(nodeId) || [];
    const children = childIds.map(cid => buildTree(cid, nodeMap, childrenOf));

    // Subtree width = max(own width, sum of children subtree widths + gaps)
    let childrenTotalWidth = 0;
    for (let i = 0; i < children.length; i++) {
        childrenTotalWidth += children[i].subtreeWidth;
        if (i > 0) childrenTotalWidth += HORIZONTAL_GAP;
    }

    const subtreeWidth = Math.max(width, childrenTotalWidth);

    return { id: nodeId, width, height, children, subtreeWidth, x: 0, y: 0 };
}

/**
 * Assign positions top-down.
 * @param tree   - current tree node
 * @param left   - left boundary allocated for this subtree
 * @param top    - Y position for this node's top edge
 */
function assignPositions(tree: TreeNode, left: number, top: number): void {
    // Center this node within its allocated subtree band
    tree.x = left + (tree.subtreeWidth - tree.width) / 2;
    tree.y = top;

    if (tree.children.length === 0) return;

    // Total width consumed by children (including gaps)
    let childrenTotalWidth = 0;
    for (let i = 0; i < tree.children.length; i++) {
        childrenTotalWidth += tree.children[i].subtreeWidth;
        if (i > 0) childrenTotalWidth += HORIZONTAL_GAP;
    }

    // Center the children block under this node
    let cursor = left + (tree.subtreeWidth - childrenTotalWidth) / 2;
    const childTop = top + tree.height + VERTICAL_GAP;

    for (const child of tree.children) {
        assignPositions(child, cursor, childTop);
        cursor += child.subtreeWidth + HORIZONTAL_GAP;
    }
}

/**
 * Flatten the tree back into a Map<nodeId, {x, y}>.
 */
function collectPositions(tree: TreeNode, out: Map<string, { x: number; y: number }>): void {
    out.set(tree.id, { x: tree.x, y: tree.y });
    for (const child of tree.children) {
        collectPositions(child, out);
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply tree layout to a diagram's nodes in-place.
 *
 * @param diagram - Mutable object with `nodes` and `edges` arrays.
 *                  Node positions will be overwritten.
 * @param originX - X coordinate for the root node's center (default 0).
 * @param originY - Y coordinate for the root node's top (default 0).
 * @returns The same `diagram` reference, mutated.
 */
export function applyTreeLayout(
    diagram: { nodes: any[]; edges: any[] },
    originX: number = 0,
    originY: number = 0,
): { nodes: any[]; edges: any[] } {
    if (!diagram.nodes || diagram.nodes.length === 0) return diagram;

    const nodeMap = new Map<string, any>();
    for (const n of diagram.nodes) nodeMap.set(n.id, n);

    const childrenOf = buildChildrenMap(diagram.edges || []);
    const rootId = findRoot(diagram.nodes, diagram.edges || []);

    const tree = buildTree(rootId, nodeMap, childrenOf);

    // Lay out starting at (0, originY); we'll shift to center on originX afterwards.
    assignPositions(tree, 0, originY);

    const positions = new Map<string, { x: number; y: number }>();
    collectPositions(tree, positions);

    // Shift everything so the root is centered on originX
    const rootPos = positions.get(rootId);
    const rootNode = nodeMap.get(rootId);
    if (rootPos && rootNode) {
        const rootCenterX = rootPos.x + (rootNode.style?.width ?? 200) / 2;
        const shiftX = originX - rootCenterX;
        for (const [, pos] of positions) {
            pos.x += shiftX;
        }
    }

    // Write positions back onto nodes
    for (const node of diagram.nodes) {
        const pos = positions.get(node.id);
        if (pos) {
            node.position = { x: pos.x, y: pos.y };
        }
    }

    return diagram;
}

/**
 * Convenience: parse JSON string → layout → return JSON string.
 */
export function layoutDiagramJson(jsonString: string, originX: number = 0, originY: number = 0): string {
    try {
        const diagram = JSON.parse(jsonString);
        applyTreeLayout(diagram, originX, originY);
        return JSON.stringify(diagram);
    } catch {
        return jsonString;
    }
}

