import { RiMenu3Fill } from "react-icons/ri";
import ThemeToggle from "./Downloads/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./DropDownMenu/DropDownMenu";
import DownloadJsonButton from "./Downloads/DownloadJson";
import { useTheme } from "@/hooks/useTheme";
import { useDiagram } from "@/hooks/useDiagram";

interface MenuProps {
  themeHook: ReturnType<typeof useTheme>;
  diagram: ReturnType<typeof useDiagram>;
}

export const Menu = (props: MenuProps) => {
  return (
    <div className="gap-0 cursor-pointer flex">
      <ThemeToggle
        onClick={props.themeHook.darkModeToggle}
        isDarkMode={props.themeHook.theme === "dark"}
      />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex flex-row gap-2 justify-center items-center p-1 pl-2 rounded-md hover:bg-slate-200 hover:dark:bg-slate-700 dark:bg-slate-800">
          Menu
          <RiMenu3Fill />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-white dark:bg-black text-black dark:text-white">
          <DropdownMenuItem>
            <DownloadJsonButton useDiagram={props.diagram} />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
