/**
 * Subgraph Integration Utility
 * Handles the integration of subgraphs into the main diagram
 */

import { calculateCollisionFreeOffset } from './collision-detection';
import { applyTreeLayout } from '@/lib/tree-layout';

export interface SubgraphIntegrationResult {
    repositionedNodes: any[];
    repositionedEdges: any[];
}

/**
 * Integrate a subgraph into the main diagram by:
 * 1. Applying tree layout to the raw subgraph (LLM returns {x:0,y:0})
 * 2. Removing the duplicate root node
 * 3. Repositioning nodes to avoid collisions
 * 4. Remapping edges to connect to the parent goal
 */
export const integrateSubgraph = (
    subgraphData: { nodes: any[]; edges: any[] },
    originatingNode: any,
    currentNodes: any[],
    cacheKey: string
): SubgraphIntegrationResult => {
    // First, apply tree layout to the raw subgraph so relative positions are meaningful
    applyTreeLayout(subgraphData);

    // Calculate offset position for new nodes (below the originating node)
    const nodeHeight = typeof originatingNode.measured?.height === 'number'
        ? originatingNode.measured.height
        : typeof originatingNode.style?.height === 'number'
        ? originatingNode.style.height
        : 100;
    const offsetY = nodeHeight + 150;
    const originX = originatingNode.position.x;
    const originY = originatingNode.position.y;

    // Find the root node of the subgraph (typically the first node)
    const subgraphRoot = subgraphData.nodes[0];
    const subgraphRootId = subgraphRoot.id;
    const subgraphRootOriginalX = subgraphRoot.position.x;
    const subgraphRootOriginalY = subgraphRoot.position.y;

    // Calculate initial position offset to center the subgraph below the originating node
    const initialDeltaX = originX - subgraphRootOriginalX;
    const initialDeltaY = originY + offsetY - subgraphRootOriginalY;

    // Filter out the root node and create preliminary positioned nodes
    const preliminaryNodes = subgraphData.nodes
        .filter((node: any) => node.id !== subgraphRootId)
        .map((node: any) => ({
            ...node,
            id: `${cacheKey}_${node.id}`,
            position: {
                x: node.position.x + initialDeltaX,
                y: node.position.y + initialDeltaY,
            }
        }));

    // Use collision detection utility to find collision-free offset
    const { deltaX: collisionDeltaX, deltaY: collisionDeltaY } = calculateCollisionFreeOffset(
        preliminaryNodes,
        currentNodes,
        originX,
        originY + offsetY
    );

    // Apply both initial positioning and collision avoidance
    const finalDeltaX = initialDeltaX + collisionDeltaX;
    const finalDeltaY = initialDeltaY + collisionDeltaY;

    // Reposition all subgraph nodes with the collision-free position
    const repositionedNodes = subgraphData.nodes
        .filter((node: any) => node.id !== subgraphRootId)
        .map((node: any) => ({
            ...node,
            id: `${cacheKey}_${node.id}`,
            position: {
                x: node.position.x + finalDeltaX,
                y: node.position.y + finalDeltaY,
            }
        }));

    // Update edge IDs and remap edges that connected to the subgraph root
    // to now connect to the converted goal node instead
    const repositionedEdges = subgraphData.edges
        .map((edge: any) => ({
            ...edge,
            id: `${cacheKey}_${edge.id}`,
            // If source was the subgraph root, replace with the actual goal node
            source: edge.source === subgraphRootId ? originatingNode.id : `${cacheKey}_${edge.source}`,
            // If target was the subgraph root, replace with the actual goal node
            target: edge.target === subgraphRootId ? originatingNode.id : `${cacheKey}_${edge.target}`,
        }))
        .filter((edge: any) => edge.source !== edge.target); // Remove self-loops

    return {
        repositionedNodes,
        repositionedEdges
    };
};

/**
 * Convert a task node (hexagon) to a goal node (circle)
 */
export const convertTaskToGoal = (taskNode: any): any => {
    return {
        ...taskNode,
        data: {
            ...taskNode.data,
            type: 'circle',
        },
        style: {
            ...taskNode.style,
            width: 200,
            height: 70,
        }
    };
};

