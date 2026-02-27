/**
 * Collision Detection Utility for Graph Nodes
 * Handles positioning of new subgraphs to avoid overlaps with existing nodes
 */

export interface NodeBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Position {
    x: number;
    y: number;
}

/**
 * Check if two rectangles overlap with a padding buffer
 */
export const rectanglesOverlap = (
    rect1: NodeBounds,
    rect2: NodeBounds,
    padding: number = 50
): boolean => {
    return !(
        rect1.x + rect1.width + padding < rect2.x ||
        rect2.x + rect2.width + padding < rect1.x ||
        rect1.y + rect1.height + padding < rect2.y ||
        rect2.y + rect2.height + padding < rect1.y
    );
};

/**
 * Extract dimensions from a node object
 */
const getNodeDimensions = (node: any): { width: number; height: number } => {
    const width = node.measured?.width || node.style?.width || node.width || 200;
    const height = node.measured?.height || node.style?.height || node.height || 70;

    return {
        width: typeof width === 'number' ? width : parseInt(width) || 200,
        height: typeof height === 'number' ? height : parseInt(height) || 70
    };
};

/**
 * Calculate the bounding box of a group of nodes
 */
export const calculateBoundingBox = (nodes: any[]): NodeBounds => {
    if (nodes.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
        const { width, height } = getNodeDimensions(node);
        const nodeMaxX = node.position.x + width;
        const nodeMaxY = node.position.y + height;

        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, nodeMaxX);
        maxY = Math.max(maxY, nodeMaxY);
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
};

/**
 * Check if a group of nodes (treated as a bounding box) overlaps with any existing nodes
 */
export const hasOverlapWithExistingNodes = (
    proposedNodes: any[],
    existingNodes: any[],
    offsetX: number = 0,
    offsetY: number = 0,
    padding: number = 50
): boolean => {
    const proposedBounds = calculateBoundingBox(proposedNodes);

    // Apply offset to the bounding box
    proposedBounds.x += offsetX;
    proposedBounds.y += offsetY;

    for (const existingNode of existingNodes) {
        const { width, height } = getNodeDimensions(existingNode);

        const existingBounds: NodeBounds = {
            x: existingNode.position.x,
            y: existingNode.position.y,
            width,
            height
        };

        if (rectanglesOverlap(proposedBounds, existingBounds, padding)) {
            return true;
        }
    }

    return false;
};

/**
 * Generate candidate positions in a spiral pattern
 * This creates more natural-looking layouts
 */
const generateCandidatePositions = (
    centerX: number,
    centerY: number,
    proposedWidth: number,
    proposedHeight: number
): Position[] => {
    const positions: Position[] = [];

    // Start with the ideal position (centered below)
    positions.push({ x: centerX - proposedWidth / 2, y: centerY });

    // Generate positions in expanding rings
    const rings = [
        { distance: 200, angles: 8 },   // Close ring
        { distance: 400, angles: 12 },  // Medium ring
        { distance: 600, angles: 16 },  // Far ring
    ];

    for (const ring of rings) {
        for (let i = 0; i < ring.angles; i++) {
            const angle = (i / ring.angles) * 2 * Math.PI;
            const x = centerX + Math.cos(angle) * ring.distance - proposedWidth / 2;
            const y = centerY + Math.sin(angle) * ring.distance;

            // Prefer positions below or to the sides (not above)
            if (y >= centerY - 100) {
                positions.push({ x, y });
            }
        }
    }

    // Add some additional strategic positions
    positions.push(
        { x: centerX + proposedWidth + 100, y: centerY }, // Far right
        { x: centerX - proposedWidth * 2 - 100, y: centerY }, // Far left
        { x: centerX - proposedWidth / 2, y: centerY + 300 }, // Further below
        { x: centerX - proposedWidth / 2, y: centerY + 500 }, // Even further below
    );

    return positions;
};

/**
 * Find the best non-overlapping position for a group of nodes
 * Uses an improved algorithm with spiral search pattern
 */
export const findNonOverlappingPosition = (
    proposedNodes: any[],
    existingNodes: any[],
    preferredX: number,
    preferredY: number,
    padding: number = 50
): Position => {
    if (proposedNodes.length === 0) {
        return { x: preferredX, y: preferredY };
    }

    const proposedBounds = calculateBoundingBox(proposedNodes);
    const proposedWidth = proposedBounds.width;
    const proposedHeight = proposedBounds.height;

    // Generate candidate positions
    const candidates = generateCandidatePositions(
        preferredX,
        preferredY,
        proposedWidth,
        proposedHeight
    );

    // Try each candidate position
    for (const candidate of candidates) {
        const testOffsetX = candidate.x - proposedBounds.x;
        const testOffsetY = candidate.y - proposedBounds.y;

        if (!hasOverlapWithExistingNodes(proposedNodes, existingNodes, testOffsetX, testOffsetY, padding)) {
            // Return the offset needed to position the top-left of the bounding box
            return {
                x: candidate.x,
                y: candidate.y
            };
        }
    }

    // If no non-overlapping position found, use a fallback position far below and to the right
    const fallbackX = preferredX + 800;
    const fallbackY = preferredY + 800;

    return { x: fallbackX, y: fallbackY };
};

/**
 * Calculate the delta needed to reposition nodes from their current position
 * to avoid overlaps with existing nodes
 */
export const calculateCollisionFreeOffset = (
    proposedNodes: any[],
    existingNodes: any[],
    preferredX: number,
    preferredY: number
): { deltaX: number; deltaY: number } => {
    const newPosition = findNonOverlappingPosition(
        proposedNodes,
        existingNodes,
        preferredX,
        preferredY
    );

    const currentBounds = calculateBoundingBox(proposedNodes);

    return {
        deltaX: newPosition.x - currentBounds.x,
        deltaY: newPosition.y - currentBounds.y
    };
};


