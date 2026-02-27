import {
    Handle,
    NodeResizer,
    NodeToolbar,
    Position,
    useKeyPress,
    useReactFlow,
    useStore,
    useUpdateNodeInternals,
} from "@xyflow/react";

import Shape from "../shape";
import {type ShapeType} from "../shape/types";
import NodeLabel from "./label";
import ShapeNodeToolbar from "../Toolbar/Toolbar";
import {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import useUndoRedo from "@/hooks/useUndoRedo";
import {fas} from "@fortawesome/free-solid-svg-icons";
import {library} from "@fortawesome/fontawesome-svg-core";
import {Code, GitBranch, ChevronDown, ChevronUp} from "react-feather";
import {getNodeColorConfig} from "../utils/utils";

library.add(fas);

// this will return the current dimensions of the node (measured internally by react flow)
const useNodeDimensions = (id: string) => {
    const node = useStore((state) => state.nodeLookup.get(id));
    return {
        width: node?.measured?.width || 0,
        height: node?.measured?.height || 0,
    };
};

const ShapeNode = ({id, selected, data}: any) => {
    const {type}: { type: ShapeType } = data as any;
    const isValidated = !!data.isValidated;
    const colors = getNodeColorConfig(data, isValidated);
    const {setNodes, getNodes, getEdges, setEdges} = useReactFlow();
    const updateNodeInternals = useUpdateNodeInternals();
    const {takeSnapshot} = useUndoRedo();
    const {width, height} = useNodeDimensions(id);
    const shiftKeyPressed = useKeyPress("Shift");
    const handleStyle = {backgroundColor: colors.fill};

    // Expand-task prompt state
    const [showExpandPrompt, setShowExpandPrompt] = useState(false);
    const [expandPromptText, setExpandPromptText] = useState("");

    const onResize = () => {
        updateNodeInternals(id);
    };

    const onResizeEnd = () => {
        setTimeout(() => {
            const event = new CustomEvent('saveGraphToHistory');
            window.dispatchEvent(event);
        }, 100);
    };

    const onContentsChange = (contents: any) => {
        takeSnapshot();
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id && node.data.type !== "capsule") {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            contents,
                        },
                    };
                }

                return node;
            })
        );

        setTimeout(() => {
            const event = new CustomEvent('saveGraphToHistory');
            window.dispatchEvent(event);
        }, 100);
    };

    const onDeleteNode = () => {
        takeSnapshot();

        const edges = getEdges();
        const nodes = getNodes();

        // BFS to find all parent nodes
        const findAllParents = (startNodeId: string): string[] => {
            const children: string[] = [];
            const queue: string[] = [startNodeId];
            const visited = new Set<string>();

            while (queue.length > 0) {
                const currentNodeId = queue.shift()!;

                if (visited.has(currentNodeId)) {
                    continue;
                }
                visited.add(currentNodeId);

                const parentEdges = edges.filter(edge => edge.target === currentNodeId);

                parentEdges.forEach(edge => {
                    const parentId = edge.source;
                    if (!visited.has(parentId)) {
                        children.push(parentId);
                        queue.push(parentId);
                    }
                });
            }

            return children;
        };

        const nodesToDelete = [id, ...findAllParents(id)];

        const edgesToKeep = edges.filter(edge =>
            !nodesToDelete.includes(edge.source) && !nodesToDelete.includes(edge.target)
        );

        const remainingNodes = nodes.filter(node => !nodesToDelete.includes(node.id));

        setNodes(remainingNodes);
        setEdges(edgesToKeep);

        setTimeout(() => {
            const event = new CustomEvent('saveGraphToHistory');
            window.dispatchEvent(event);
        }, 200);
    };

    const onAggregateCode = () => {
        const event = new CustomEvent('aggregateCode', {
            detail: {
                circleNodeId: id
            }
        });
        window.dispatchEvent(event);
    };

    const onToggleCollapse = () => {
        const event = new CustomEvent('toggleCollapseNode', {
            detail: {
                nodeId: id
            }
        });
        window.dispatchEvent(event);
    };

    const onGenerateCode = () => {
        const event = new CustomEvent('generateCodeFromHexagon', {
            detail: {
                hexagonNodeId: id,
                taskName: data.contents || "Task"
            }
        });
        window.dispatchEvent(event);
    };

    const onGenerateGraph = () => {
        setShowExpandPrompt(true);
        setExpandPromptText("");
    };

    const onConfirmExpandTask = () => {
        const event = new CustomEvent('generateGraphFromHexagon', {
            detail: {
                hexagonNodeId: id,
                taskName: data.contents || "Task",
                userPrompt: expandPromptText.trim() || undefined
            }
        });
        window.dispatchEvent(event);
        setShowExpandPrompt(false);
        setExpandPromptText("");
    };

    const onCancelExpandTask = () => {
        setShowExpandPrompt(false);
        setExpandPromptText("");
    };

    useEffect(() => {
        updateNodeInternals(id);
    }, [id, updateNodeInternals]);

    return (
        <>
            <ShapeNodeToolbar
                onDeleteNode={onDeleteNode}
            />
            {type === "circle" && selected && (
                <NodeToolbar
                    position={Position.Top}
                    offset={10}
                    className="nodrag"
                >
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onAggregateCode}
                            className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors shadow-md"
                            title="Aggregate code from child tasks"
                        >
                            <Code size={16}/>
                            <span>{data.hasCode ? "Show Code" : "Aggregate Code"}</span>
                        </button>
                        <button
                            onClick={onToggleCollapse}
                            className="flex items-center gap-1 px-3 py-2 bg-teal-600 text-white text-sm rounded-md hover:bg-teal-700 transition-colors shadow-md"
                            title={data.collapsed ? "Expand subgraph" : "Collapse subgraph"}
                        >
                            {data.collapsed ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
                            <span>{data.collapsed ? "Expand" : "Collapse"}</span>
                        </button>
                    </div>
                </NodeToolbar>
            )}
            {type === "hexagon" && selected && (
                <NodeToolbar
                    position={Position.Top}
                    offset={10}
                    className="nodrag"
                >
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onGenerateCode}
                            className="flex items-center gap-1 px-3 py-2 bg-orange-500 text-white text-sm rounded-md hover:bg-orange-600 transition-colors shadow-md"
                            title={data.hasCode ? "Show generated code" : "Generate code for this task"}
                        >
                            <Code size={16}/>
                            <span>{data.hasCode ? "Show Code" : "Generate Code"}</span>
                        </button>
                        {/* Expand Task is only available before code is generated */}
                        {!data.hasCode && (
                            <button
                                onClick={onGenerateGraph}
                                className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors shadow-md"
                                title="Expand this task into sub-tasks"
                            >
                                <GitBranch size={16}/>
                                <span>Expand Task</span>
                            </button>
                        )}
                    </div>
                </NodeToolbar>
            )}
            {/* Expand Task prompt modal — rendered via portal so it escapes ReactFlow's canvas transform */}
            {showExpandPrompt && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) onCancelExpandTask(); }}
                >
                    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800 dark:text-white">
                        <h3 className="mb-3 text-lg font-semibold">Expand Task</h3>
                        <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                            <strong>Optionally</strong> provide additional instructions for how this task should be expanded into sub-tasks.
                        </p>
                        <textarea
                            value={expandPromptText}
                            onChange={(e) => setExpandPromptText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onConfirmExpandTask(); if (e.key === 'Escape') onCancelExpandTask(); }}
                            placeholder="e.g., Focus on security aspects, Split into frontend and backend tasks..."
                            className="w-full resize-none rounded-md border border-gray-300 bg-white p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            rows={4}
                            autoFocus
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={onCancelExpandTask}
                                className="rounded-md bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirmExpandTask}
                                className="flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
                            >
                                <GitBranch size={14}/>
                                Expand
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <NodeResizer
                color={colors.fill}
                keepAspectRatio={shiftKeyPressed}
                isVisible={selected}
                onResize={onResize}
                onResizeStart={takeSnapshot}
                onResizeEnd={onResizeEnd}
            />
            <div style={{position: "relative"}}>
                <Shape
                    type={type}
                    width={width}
                    height={height}
                    fill={colors.fill}
                    strokeWidth={1.5}
                    stroke={colors.stroke}
                    fillOpacity={0.9}
                />
            </div>
            <Handle
                style={handleStyle}
                id="top"
                type="source"
                position={Position.Top}
            />
            <Handle
                style={handleStyle}
                id="right"
                type="source"
                position={Position.Right}
            />
            <Handle
                style={handleStyle}
                id="bottom"
                type="source"
                position={Position.Bottom}
            />
            <Handle
                style={handleStyle}
                id="left"
                type="source"
                position={Position.Left}
            />
            <NodeLabel
                placeholder={data.type}
                data={data.contents}
                onContentsChange={onContentsChange}
            />
        </>
    );
};

export default ShapeNode;
