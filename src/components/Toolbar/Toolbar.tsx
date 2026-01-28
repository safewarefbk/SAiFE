import { NodeToolbar, Position } from "@xyflow/react";
import { Trash2 } from "react-feather";

type ShapeNodeToolbarProps = {
  onDeleteNode?: () => void;
};

function ShapeNodeToolbar({
  onDeleteNode,
}: ShapeNodeToolbarProps) {

  return (
    <NodeToolbar 
      className="nowheel nodrag flex flex-col" 
      position={Position.Bottom}
      offset={10}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-0.5">
          {onDeleteNode ? (
            <button onClick={() => onDeleteNode()}>
              <Trash2 color={"#FF0000"}/>
            </button>
          ) : null}
        </div>
      </div>
    </NodeToolbar>
  );
}

export default ShapeNodeToolbar;
