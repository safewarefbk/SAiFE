import {RefObject} from "react";
import {
    EdgeLabelRenderer,
    type EdgeProps,
    type XYPosition,
} from "@xyflow/react";
import {getLinearPath} from "./path/straight";
import {useDiagram} from "@/hooks/useDiagram";
import useUndoRedo from "@/hooks/useUndoRedo";
import useDraggableEdgeLabel from "@/hooks/useDraggableEdgeLabel";
import EdgeToolbar from "../../EdgeToolbar/EdgeToolbar";

interface EditableEdgeProps extends EdgeProps {
    useDiagram: ReturnType<typeof useDiagram>;
}

export function EditableEdge({
                                 id,
                                 selected,
                                 sourceX,
                                 sourceY,
                                 targetX,
                                 targetY,
                                 markerEnd,
                                 style,
                                 data = {points: []},
                                 useDiagram: diagram
                             }: EditableEdgeProps) {
    const {takeSnapshot} = useUndoRedo();
    const sourceOrigin = {x: sourceX, y: sourceY} as XYPosition;
    const targetOrigin = {x: targetX, y: targetY} as XYPosition;
    const color = style?.stroke || "#a5a4a5";

    // Calculate midpoint of the edge for toolbar positioning
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    // Position toolbar near the center of the edge with a small offset below
    const toolbarY = midY + 20; // Small offset below the center, similar to NodeToolbar offset of 10

    const [edgePathRef, draggableEdgeLabelRef] = useDraggableEdgeLabel(
        sourceX,
        sourceY,
        targetX,
        targetY,
        id,
        data.labelPosition as number
    );

    let pathPoints = [
        sourceOrigin,
        ...(Array.isArray(data.points) ? data.points : []),
        targetOrigin,
    ];
    const path = getLinearPath(pathPoints);

    return (
        <>
            <svg>
                <defs>
                    <marker
                        id={`arrow-end-${id}`}
                        viewBox="0 0 10 10"
                        refX="5"
                        refY="5"
                        markerWidth="3"
                        markerHeight="3"
                        orient="auto"
                    >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill={color}/>
                    </marker>
                </defs>
            </svg>
            <path
                d={path}
                style={{
                    strokeWidth: 4,
                    stroke: "transparent",
                    strokeDasharray: "none",
                    markerEnd: `url(#arrow-end-${id})`,
                }}
                fill="transparent"
            />
            <path
                id={id}
                d={path}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    strokeWidth: 4,
                    stroke: color,
                }}
                ref={edgePathRef}
                fill="transparent"
            />
            <EdgeLabelRenderer>
                <div
                    ref={draggableEdgeLabelRef}
                    style={{
                        position: "absolute",
                        transform: `translate(-50%, -50%)`,
                        pointerEvents: "all",
                        zIndex: 1000,
                    }}
                    className="nodrag nopan"
                >
                    {data.title ? (
                        <foreignObject x="10" y="10" width="100" height="100">
                            <div
                                ref={draggableEdgeLabelRef as RefObject<HTMLInputElement>}
                                className={`bottom-full p-2 text-center text-sm dark:bg-black bg-white rounded-md`}
                            >{`${data.title}`}</div>
                        </foreignObject>
                    ) : null}
                </div>
            </EdgeLabelRenderer>

            {/* Render EdgeToolbar when this edge is selected */}
            {selected && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: "absolute",
                            left: midX,
                            top: toolbarY,
                            transform: "translate(-50%, 0%)",
                            pointerEvents: "all",
                            zIndex: 1000,
                        }}
                        className="nowheel nodrag flex flex-col bg-white dark:bg-slate-800 shadow-lg rounded-lg border border-slate-200 dark:border-slate-700 p-2"
                    >
                        <EdgeToolbar
                            takeSnapshot={takeSnapshot}
                            useDiagram={diagram}
                        />
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}