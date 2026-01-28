import {RefObject, useCallback, useRef, useState} from "react";
import {
    BaseEdge,
    EdgeLabelRenderer,
    useReactFlow,
    useStore,
    type Edge,
    type EdgeProps,
    type XYPosition, MarkerType,
} from "@xyflow/react";
import {ControlPoint, type ControlPointData} from "./ControlPoint";
import {getPath, getControlPoints} from "./path";
import {Algorithm} from "./constants";
import {useDiagram} from "@/hooks/useDiagram";
import useDraggableEdgeLabel from "@/hooks/useDraggableEdgeLabel";
import {Animation} from "@/components/EdgeToolbar/EdgeToolbar";

const useIdsForInactiveControlPoints = (points: ControlPointData[]) => {
    const prevIds = useRef<string[]>([]);
    let newPoints: ControlPointData[] = [];
    if (prevIds.current.length === points.length) {
        // reuse control points from last render, just update their position
        newPoints = points.map((point, i) =>
            point.active ? point : {...point, id: prevIds.current[i]}
        );
    } else {
        // calculate new control points
        newPoints = points.map((prevPoint, i) => {
            const id = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
            prevIds.current[i] = id;
            return prevPoint.active ? points[i] : {...points[i], id};
        });
    }

    return newPoints;
};

export type EditableEdgeData = {
    algorithm?: Algorithm;
    points: ControlPointData[];
};

interface EditableEdgeProps extends EdgeProps {
    useDiagram: ReturnType<typeof useDiagram>;
}

export function EditableEdge({
                                 id,
                                 selected,
                                 source,
                                 sourceX,
                                 sourceY,
                                 sourcePosition,
                                 target,
                                 targetX,
                                 targetY,
                                 targetPosition,
                                 markerEnd,
                                 markerStart,
                                 style,
                                 data = {points: []},
                                 useDiagram,
                                 ...delegated
                             }: EditableEdgeProps) {
    const {setEdges} = useReactFlow();

    const sourceOrigin = {x: sourceX, y: sourceY} as XYPosition;
    const targetOrigin = {x: targetX, y: targetY} as XYPosition;
    const color = style?.stroke || "#a5a4a5";
    const shouldShowPoints = useStore((store) => {
        const sourceNode = store.nodeLookup.get(source as string)!;
        const targetNode = store.nodeLookup.get(target as string)!;

        return selected || sourceNode.selected || targetNode.selected;
    });

    const [edgePathRef, draggableEdgeLabelRef] = useDraggableEdgeLabel(
        sourceX,
        sourceY,
        targetX,
        targetY,
        id,
        data.labelPosition as number
    );

    const setControlPoints = useCallback(
        (update: (points: ControlPointData[]) => ControlPointData[]) => {
            setEdges((edges) =>
                edges.map((e) => {
                    if (e.id !== id) return e;
                    if (!isEditableEdge(e)) return e;

                    const points = e.data?.points ?? [];
                    const localData = {...e.data, points: update(points)};

                    return {...e, data: localData};
                })
            );
            /* setTimeout(() => {
              useDiagram.setEdges((edges) =>
                edges.map((e) => {
                  if (e.id !== id) return e;
                  if (!isEditableEdge(e)) return e;

                  const points = e.data?.points ?? [];
                  const localData = { ...e.data, points: update(points) };

                  return { ...e, data: localData };
                })
              );
            }, 1000); */
        },
        [id, setEdges]
    );

    let pathPoints = [
        sourceOrigin,
        ...(Array.isArray(data.points) ? data.points : []),
        targetOrigin,
    ];
    const controlPoints = getControlPoints(
        pathPoints,
        data.algorithm as Algorithm | undefined,
        {
            fromSide: sourcePosition,
            toSide: targetPosition,
        }
    );
    const path = getPath(pathPoints, data.algorithm as Algorithm | undefined, {
        fromSide: sourcePosition,
        toSide: targetPosition,
    });
    const controlPointsWithIds = useIdsForInactiveControlPoints(controlPoints);

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

            {shouldShowPoints &&
                controlPointsWithIds.map((point, index) => (
                    <ControlPoint
                        key={point.id}
                        index={index}
                        setControlPoints={setControlPoints}
                        color={`${color}`}
                        {...point}
                    />
                ))}

        </>
    );
}


const isEditableEdge = (edge: Edge): edge is Edge<EditableEdgeData> =>
    edge.type === "editable-edge";
