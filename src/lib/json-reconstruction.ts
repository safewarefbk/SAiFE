/**
 * JSON Reconstruction Utilities
 * Converts database records (explicit columns) back to React Flow JSON format
 */

import { NodeData, EdgeData } from './db-service';

/**
 * Convert database node records to React Flow node format
 */
export function reconstructNodesJson(dbNodes: NodeData[]): any[] {
    return dbNodes.map(node => ({
        id: node.id,
        type: 'shape',  // Always "shape" - React Flow maps this to ShapeNode component
        position: {
            x: node.positionX,
            y: node.positionY
        },
        data: {
            type: node.shapeType,  // The actual shape type: hexagon, circle, etc.
            contents: node.contents,
            collapsed: node.collapsed,
            codeId: node.codeId,  // Link to Code record if code exists
            expandPrompt: node.expandPrompt  // User prompt for subgraph expansion
        },
        width: node.width,
        height: node.height,
        hidden: node.hidden || false
    }));
}

/**
 * Convert database edge records to React Flow edge format
 */
export function reconstructEdgesJson(dbEdges: EdgeData[]): any[] {
    return dbEdges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: 'top',  // Always connect from top of source node
        targetHandle: 'bottom',     // Always connect to bottom of target node
        type: 'editable-edge',  // App constant — not stored in DB
        label: edge.label,
        style: {
            strokeWidth: 2,  // App constant — not stored in DB
            strokeDasharray: edge.strokeDasharray
        },
        hidden: edge.hidden || false
    }));
}

/**
 * Reconstruct complete graph JSON from database records
 * Since we now have a single expanding graph, return one graph with all nodes/edges
 */
export function reconstructGraphFromRecords(dbNodes: NodeData[], dbEdges: EdgeData[]): string {
    return JSON.stringify({
        nodes: reconstructNodesJson(dbNodes),
        edges: reconstructEdgesJson(dbEdges)
    });
}
