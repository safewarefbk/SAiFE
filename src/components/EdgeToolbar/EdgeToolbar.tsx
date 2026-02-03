import React from "react";
import { Trash2 } from "react-feather";
import { RxBorderDotted } from "react-icons/rx";
import { IoRemoveOutline } from "react-icons/io5";
import { useDiagram } from "@/hooks/useDiagram";


export enum Animation {
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
  const activeAnimation = edge?.data?.animation || Animation.Solid;

  const onDeleteEdge = () => {
    props.takeSnapshot();
    diagram.setEdges((edges) => edges.filter((edge) => edge.id !== editingEdgeId));
    diagram.setEditingEdgeId(null);
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

  return (
    <div
      className={`nodrag rounded-md flex flex-col bg-transparent gap-1 ${
        editingEdgeId ? "visible" : "hidden"
      }`}
    >
      <div className="flex flex-row gap-2">
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
        <button onClick={() => onDeleteEdge()}>
          <Trash2 color={"#FF0000"}/>
        </button>
      </div>
    </div>
  );
}

export default EdgeToolbar;
