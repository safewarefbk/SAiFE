import {RiMenu3Fill} from "react-icons/ri";
import {Save, Sun, Moon} from "react-feather";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./DropDownMenu/DropDownMenu";
import DownloadJsonButton from "./Downloads/DownloadJson";
import {useTheme} from "@/hooks/useTheme";
import {useDiagram} from "@/hooks/useDiagram";

interface MenuProps {
    themeHook: ReturnType<typeof useTheme>;
    diagram: ReturnType<typeof useDiagram>;
    onSave?: () => void;
}

export const Menu = (props: MenuProps) => {
    return (
        <div className="gap-0 cursor-pointer flex">
            <DropdownMenu>
                <DropdownMenuTrigger
                    className="flex flex-row gap-2 justify-center items-center p-1 pl-2 rounded-md hover:bg-slate-200 hover:dark:bg-slate-700 dark:bg-slate-800">
                    Menu
                    <RiMenu3Fill/>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-white dark:bg-black text-black dark:text-white">
                    {props.onSave && (
                        <DropdownMenuItem>
                            <button
                                onClick={props.onSave}
                                className="w-full dark:text-white dark:hover:bg-slate-800 hover:bg-gray-200 rounded-md p-1 flex flex-row gap-1 justify-between items-center"
                            >
                                Save
                                <Save size={16}/>
                            </button>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem>
                        <DownloadJsonButton useDiagram={props.diagram}/>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <button
                            onClick={props.themeHook.darkModeToggle}
                            className="w-full dark:text-white dark:hover:bg-slate-800 hover:bg-gray-200 rounded-md p-1 flex flex-row gap-1 justify-between items-center"
                        >
                            {props.themeHook.theme === "dark" ? "Light Mode" : "Dark Mode"}
                            {props.themeHook.theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}
                        </button>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
