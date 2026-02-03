import { ShapeComponents, ShapeType } from "../shape/types";
import SidebarItem from "./SidebarItem";

function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-label flex flex-row gap-1 justify-center items-center">
        Shapes
      </div>
      <div className="grid grid-cols-1">
        {Object.keys(ShapeComponents).map((type) => (
          <SidebarItem type={type as ShapeType} key={type} />
        ))}
      </div>
    </div>
  );
}

export default Sidebar;
