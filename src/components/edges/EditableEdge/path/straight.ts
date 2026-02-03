import {XYPosition} from "@xyflow/react";

export function getLinearPath(points: Readonly<XYPosition[]>): string {
    if (points.length < 2) return "";
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
}
