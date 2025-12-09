import React from "react";
import { Algorithm } from "../edges/EditableEdge/constants";
import { IoAnalyticsOutline } from "react-icons/io5";
import { TbLetterL, TbVectorSpline } from "react-icons/tb";
import { TfiVector } from "react-icons/tfi";
import {Crosshair, Trash2} from "react-feather";
import { RxBorderDotted } from "react-icons/rx";
import { IoRemoveOutline } from "react-icons/io5";
import { useDiagram } from "@/hooks/useDiagram";

const colors = [
  "#a5a4a5",
];

export enum Animation {
  AnimatedDotted = "animatedDotted",
  Dotted = "dotted",
  Solid = "solid",
}


type EdgeToolbarProps = {
  takeSnapshot: () => void;
  useDiagram: ReturnType<typeof useDiagram>;
};

function EdgeToolbar(props: EdgeToolbarProps) {
  const diagram = props.useDiagram;
  const editingEdgeId = diagram.editingEdgeId;
  const edge = diagram.getEdge(`${editingEdgeId}`);
  const activeShape = edge?.data?.algorithm || Algorithm.BezierCatmullRom;
  const activeAnimation = edge?.data?.animation || Animation.Solid;
  const edgeTitle = edge?.data?.title || "";


  const onShapeChange = (shape: Algorithm) => {
    props.takeSnapshot();
    diagram.setEdges((edges) =>
      edges.map((edge) =>
        edge.id === editingEdgeId
          ? { ...edge, data: { ...edge.data, algorithm: shape } }
          : edge
      )
    );
  };

  const onDeleteEdge = () => {
    props.takeSnapshot();
    diagram.setEdges((edges) => edges.filter((edge) => edge.id !== editingEdgeId));
    diagram.setEditingEdgeId(null);
  }

  const setAnimatedDotted = () => {
    props.takeSnapshot();
    diagram.setEdges((edges) =>
      edges.map((edge) =>
        edge.id === editingEdgeId
          ? {
              ...edge,
              animated: true,
              style: {
                ...edge.style,
                strokeDashArray: 1000,
                strokeDashOffset: 1000,
                animation: "dashdraw 0.4s linear infinite",
              },
              data: { ...edge.data, animation: Animation.AnimatedDotted },
            }
          : edge
      )
    );
  };

  const setDotted = () => {
    props.takeSnapshot();
    diagram.setEdges((edges) =>
      edges.map((edge) =>
        edge.id === editingEdgeId
          ? {
              ...edge,
              animated: true,
              style: {
                ...edge.style,
                animation: `dashdraw 0s linear infinite`,
              },
              data: { ...edge.data, animation: Animation.Dotted },
            }
          : edge
      )
    );
  };

  const setSolid = () => {
    props.takeSnapshot();
    diagram.setEdges((edges) =>
      edges.map((edge) =>
        edge.id === editingEdgeId
          ? {
              ...edge,
              animated: false,
              style: {
                ...edge.style,
              },
              data: { ...edge.data, animation: Animation.Solid },
            }
          : edge
      )
    );
  };

  const onUpdateEdgeTitle = (title: string) => {
    props.takeSnapshot();
    diagram.setEdges((edges) =>
      edges.map((edge) =>
        edge.id === editingEdgeId
          ? { ...edge, data: { ...edge.data, title } }
          : edge
      )
    );
  };

  return (
    <div
      className={`nodrag rounded-md flex flex-col bg-transparent gap-1 ${
        editingEdgeId ? "visible" : "hidden"
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-2">
          <button
              onClick={() => onShapeChange(Algorithm.Linear)}
              className={`flex justify-center items-center ${
                  Algorithm.Linear === activeShape
                      ? "border-black dark:border-white border rounded-md"
                      : "border border-transparent"
              }`}
          >
            <IoAnalyticsOutline className="text-black dark:text-white" size={24}/>
          </button>
          <button
              onClick={() => onShapeChange(Algorithm.BezierCatmullRom)}
              className={`flex justify-center items-center ${
                  Algorithm.BezierCatmullRom === activeShape
                      ? "border-black dark:border-white border rounded-md"
                      : "border border-transparent"
              }`}
          >
            <TbVectorSpline/>
          </button>
          <button
              onClick={() => onShapeChange(Algorithm.Straight)}
              className={`flex justify-center items-center ${
                  Algorithm.Straight === activeShape
                      ? "border-black dark:border-white border rounded-md"
                      : "border border-transparent"
              }`}
          >
            <TbLetterL/>
          </button>
          <button onClick={() => onDeleteEdge()}>
            <Trash2 color={"#FF0000"}/>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 justify-between">
        <button
          className={`flex justify-center items-center ${
            activeAnimation === Animation.Dotted
              ? " border-black dark:border-white border rounded-md"
              : "border border-transparent"
          }`}
          onClick={() => {
            setDotted();
          }}
        >
          <RxBorderDotted size={30} />
        </button>
        <button
          className={`flex justify-center items-center ${
            activeAnimation === Animation.Solid
              ? " border-black dark:border-white border rounded-md"
              : "border border-transparent"
          }`}
          onClick={() => setSolid()}
        >
          <IoRemoveOutline size={30} />
        </button>
      </div>
      <div className="grid grid-cols-1 justify-between">
        <input
          type="text"
          value={edgeTitle as string}
          onChange={(e) => onUpdateEdgeTitle(e.target.value)}
          placeholder="Connection Title"
          className="border bg-white dark:bg-black border-black rounded-md p-2 text-black dark:text-white"
        />
      </div>
    </div>
  );
}

function MovingDotsIcon() {
  return (
    <svg
      width="30"
      height="10"
      viewBox="0 0 80 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="5" cy="5" r="5" fill="currentColor">
        <animate
          attributeName="cx"
          values="5;45;5"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="5" cy="5" r="5" fill="currentColor">
        <animate
          attributeName="cx"
          values="5;45;5"
          dur="2s"
          begin="0.5s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="5" cy="5" r="5" fill="currentColor">
        <animate
          attributeName="cx"
          values="5;45;5"
          dur="2s"
          begin="1s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

export default EdgeToolbar;
