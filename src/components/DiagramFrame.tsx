import {
    Background,
    ConnectionLineType,
    ConnectionMode,
    ControlButton,
    Controls,
    DefaultEdgeOptions,
    MiniMap,
    NodeTypes,
    ReactFlow,
    ReactFlowProvider,
    Panel,
    EdgeTypes,
    EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./nodeStyles.css";
import ShapeNode from "./shape-node";
import Sidebar from "./Sidebar/Sidebar";
import MiniMapNode from "./minimap-node";
import {useDiagram} from "@/hooks/useDiagram";
import {CornerUpLeft, CornerUpRight} from "react-feather";
import useUndoRedo from "@/hooks/useUndoRedo";
import {
    PanelGroup,
    PanelResizeHandle,
    Panel as ResizablePanel,
} from "react-resizable-panels";
import { 
    detectProgrammingLanguage, 
    getDefaultSize, 
    getCacheKey, 
    findRootNodes, 
    findDirectCodeChildren 
} from "./utils/utils";

const JsonViewer = dynamic(() => import("./JsonViewer/JsonViewer"), {
    ssr: false,
});
import {useCallback, useEffect, useRef, useState} from "react";
import {useWindowSize} from "@/hooks/useWindowSize";
import dynamic from "next/dynamic";
import {EditableEdge} from "./edges/EditableEdge";
import EdgeToolbar from "./EdgeToolbar/EdgeToolbar";
import {ConnectionLine} from "./edges/ConnectionLine";
import savedDiagramJson from "../json-diagrams/DiagramX.json";
import {useTheme} from "@/hooks/useTheme";
import {Menu} from "./Menu";
import CodeModal from "@components/CodeModal/CodeModal";
import ProjectModal from "@components/ProjectModal/Modal";


const nodeTypes: NodeTypes = {
    shape: ShapeNode,
};

const defaultEdgeOptions: DefaultEdgeOptions = {
    type: "editable-edge",
    style: {strokeWidth: 2},
};


const Flow = () => {
    const [sessionId, setSessionId] = useState<string | null>(null);  // Server manages chat history
    const [codeLanguage, setCodeLanguage] = useState<string>("Python");
    const diagram = useDiagram();
    const { setNodes, getNodes, getEdges } = diagram.useReactFlow();
    const {getSnapshotJson, takeSnapshot} = useUndoRedo();
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(false);
    const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(false);
    const [width] = useWindowSize();
    const [isModalOpen, setIsModalOpen] = useState(true);
    const [originalDescription, setOriginalDescription] = useState<string>("");
    const themeHook = useTheme();
    const [codeModalOpen, setCodeModalOpen] = useState(false);
    const [generatedCode, setGeneratedCode] = useState<string>("");
    const [codeLoading, setCodeLoading] = useState(false);
    const [currentCodeCacheKey, setCurrentCodeCacheKey] = useState<string>("");
    const [currentOriginalPrompt, setCurrentOriginalPrompt] = useState<string>("");
    const [graphIndex, setGraphIndex] = useState<number>(-1);
    const graphIndexRef = useRef<number>(-1);
    const graphsHistory = useRef<string[]>([]);
    const [secondRequest, setSecondRequest] = useState<boolean>(false);
    const [thinking, setThinking] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [codeCache, setCodeCache] = useState<Map<string, string>>(new Map());
    const [promptCache, setPromptCache] = useState<Map<string, string>>(new Map());
    const [graphCache, setGraphCache] = useState<Map<string, number>>(new Map());
    const [graphParentMap, setGraphParentMap] = useState<Map<number, { parentGraphIndex: number, parentNodeId: string }>>(new Map());
    const [validationCache, setValidationCache] = useState<Map<string, boolean>>(new Map());

    const ThinkingIndicator = () => {
        const [dots, setDots] = useState('');
        
        // Animation for the thinking dots while AI is processing
        useEffect(() => {
            if (!thinking) return;
            
            const interval = setInterval(() => {
                setDots(prev => {
                    if (prev === '...') return '';
                    return prev + '.';
                });
            }, 500);
            
            return () => clearInterval(interval);
        }, [thinking]);
        
        if (!thinking) return null;
        
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
                    <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                            Thinking{dots}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    const ErrorModal = () => {
        if (!error) return null;
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" style={{zIndex: 99999}}>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="flex-shrink-0">
                            <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            Error
                        </h3>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-6">
                        {error}
                    </p>
                    <div className="flex justify-end">
                        <button 
                            onClick={() => {
                                setError("");
                            }}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        );
    };


    // Function to generate the first graph of the project
    const handleModalSubmit = async (description: string, includeNonFunctional: boolean) => {
        setThinking(true);
        setError("");
        setIsModalOpen(false);
        setOriginalDescription(description);
        const detectedLanguage = detectProgrammingLanguage(description);
        setCodeLanguage(detectedLanguage);

        try {
            const response = await fetch('/api/llm/diagram/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ description, includeNonFunctional }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate diagram');
            }

            const { responseText, sessionId: newSessionId } = await response.json();

            // Store sessionId - server keeps the history
            setSessionId(newSessionId);

            if (JSON.parse(responseText)) {
                diagram.uploadJson(responseText);
                console.log(diagram);
                console.log(responseText);
                graphsHistory.current = [responseText];
                setGraphIndex(0);
            }
        } catch (e) {
            setError("An error occurred while generating the diagram. Please try again.");
            setIsModalOpen(true);
        } finally {
            setThinking(false);
        }
    }

    // Function to generate a graph for a single specific task
    const generateTaskDiagram = async (taskName: string, nodeId?: string, currentGraphIndex?: number) => {
        setThinking(true);
        setError("");
        
        if(taskName == "Task") {
            setError("Task name cannot be empty.");
            setThinking(false);
            return;
        }

        if (!sessionId) {
            setError("No active session. Please generate a diagram first.");
            setThinking(false);
            return;
        }

        try {
            // Only send sessionId and taskName - server has the history
            const response = await fetch('/api/llm/diagram/task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId, taskName }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate task diagram');
            }

            const { responseText } = await response.json();

            if (JSON.parse(responseText)) {
                diagram.uploadJson(responseText);
                setSecondRequest(true);
                graphsHistory.current.push(responseText);
                const newGraphIndex = graphsHistory.current.length - 1;
                setGraphIndex(newGraphIndex);
                
                if (nodeId) {
                    setGraphCache(prev => new Map(prev).set(nodeId, newGraphIndex));

                    // Save the parent-child relationship
                    if (currentGraphIndex !== undefined) {
                        setGraphParentMap(prev => new Map(prev).set(newGraphIndex, {
                            parentGraphIndex: currentGraphIndex,
                            parentNodeId: nodeId.replace(`${currentGraphIndex}_`, '')
                        }));
                    }
                }
            }
        } catch (e) {
            setError("An error occurred while generating the task diagram. Please try again.");
        } finally {
            setThinking(false);
        }
    };

    // function to generate code for a single leaf node (hexagon)
    const generateCodeForLeaf  = async (cacheKey: string, taskName: string) => {
        try{
                if(taskName == "Task") {
                    setError("Task name cannot be empty.");
                    setThinking(false);
                    return;
                }

                setCodeModalOpen(true);
                setCodeLoading(true);
                setError("");
                setCurrentCodeCacheKey(cacheKey);

                if (cacheKey && codeCache.has(cacheKey)) {
                    const cachedCode = codeCache.get(cacheKey)!;
                    setGeneratedCode(cachedCode);
                    setCodeLoading(false);
                    return;
                } else {
                    const response = await fetch('/api/llm/code/generate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ taskName, language: codeLanguage }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to generate code');
                    }

                    const { code, prompt } = await response.json();

                    setCurrentOriginalPrompt(prompt);
                    setGeneratedCode(code);
                    setCodeCache(prev => new Map(prev).set(cacheKey, code));
                    setPromptCache(prev => new Map(prev).set(cacheKey, prompt));
                }
        } catch (e) {
            console.error("API Error:", e);
            if (e instanceof Error) {
                setError(`Code generation error: ${e.message}`);
            } else {
                setError("An error occurred while generating the code. Please try again.");
            }
        }
        finally {
            setCodeLoading(false);
        }
    }

    // Function to regenerate code with additional prompt instructions
    const regenerateCodeWithPrompt = async (additionalPrompt: string) => {
        try {
            setCodeLoading(true);
            setError("");

            const response = await fetch('/api/llm/code/regenerate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    originalPrompt: currentOriginalPrompt,
                    currentCode: generatedCode,
                    additionalPrompt
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to regenerate code');
            }

            const { code } = await response.json();

            setGeneratedCode(code);
            setCodeCache(prev => new Map(prev).set(currentCodeCacheKey, code));

            // Close and reopen modal to show updated code
            setCodeModalOpen(false);
            setTimeout(() => {
                setCodeModalOpen(true);
            }, 100);

        } catch (e) {
            console.error("API Error:", e);
            if (e instanceof Error) {
                setError(`Code regeneration error: ${e.message}`);
            } else {
                setError("An error occurred while regenerating the code. Please try again.");
            }
        } finally {
            setCodeLoading(false);
        }
    };

    // Function to aggregate the code of the direct children inside the circles
    const aggregateCode = async (circleNodeId: string, currentGraphIndex: number): Promise<boolean> => {
        try {
            const cacheKey = getCacheKey(currentGraphIndex, circleNodeId);

            if (codeCache.has(cacheKey)) {
                console.log(`Using cached aggregated code for circle: ${cacheKey}`);
                const cachedCode = codeCache.get(cacheKey)!;
                const cachedPrompt = promptCache.get(cacheKey) || "Aggregated code for functional goal";
                setCodeModalOpen(true);
                setGeneratedCode(cachedCode);
                setCurrentCodeCacheKey(cacheKey);
                setCurrentOriginalPrompt(cachedPrompt);
                setCodeLoading(false);
                return true;
            }

            const edges = getEdges();
            const nodes = getNodes();

            const codeNodeIds = findDirectCodeChildren(circleNodeId, nodes, edges);
            const childNodes = nodes.filter(node => codeNodeIds.includes(node.id));

            if (childNodes.length === 0) {
                setError("No children with code found for this circle. Generate code for child tasks first.");
                return false;
            }

            const childrenCode: Array<{taskName: string, code: string, type: string}> = [];
            let missingCode = false;

            for (const childNode of childNodes) {
                const childCacheKey = getCacheKey(currentGraphIndex, childNode.id);

                if (codeCache.has(childCacheKey) && validationCache.get(childCacheKey)) {
                    const code = codeCache.get(childCacheKey)!;
                    const taskName = String(childNode.data.contents || "Unknown");
                    const nodeType = childNode.data?.type === "circle" ? "Goal" : "Task";
                    childrenCode.push({ taskName, code, type: nodeType });
                } else {
                    missingCode = true;
                    console.warn(`Missing code for child node: ${childNode.id} (type: ${childNode.data?.type})`);
                }
            }

            if (missingCode) {
                setError("Some children don't have generated/validated code yet. Please generate/aggregate code for all children first.");
                setCodeLoading(false);
                return false;
            }

            setCodeModalOpen(true);
            setCodeLoading(true);
            setCurrentCodeCacheKey(cacheKey);

            const circleNode = nodes.find(n => n.id === circleNodeId);
            const circleGoal = circleNode?.data?.contents || "Goal";

            const response = await fetch('/api/llm/code/aggregate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'circle',
                    goal: circleGoal,
                    childrenCode,
                    language: codeLanguage,
                    projectDescription: originalDescription
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to aggregate code');
            }

            const { code, prompt } = await response.json();

            setGeneratedCode(code);
            setCodeCache(prev => new Map(prev).set(cacheKey, code));
            setPromptCache(prev => new Map(prev).set(cacheKey, prompt));
            setCurrentOriginalPrompt(prompt);

            // If this is a subgraph and we're aggregating the root circle, copy to parent
            if (graphParentMap.has(currentGraphIndex)) {
                const rootNodes = findRootNodes(nodes, edges);
                const isRootNode = rootNodes.some(node => node.id === circleNodeId);

                if (isRootNode) {
                    const parentInfo = graphParentMap.get(currentGraphIndex)!;
                    const parentCacheKey = getCacheKey(parentInfo.parentGraphIndex, parentInfo.parentNodeId);
                    setCodeCache(prev => new Map(prev).set(parentCacheKey, code));
                    setPromptCache(prev => new Map(prev).set(parentCacheKey, prompt));
                    console.log(`Code copied from subgraph root circle to parent node: ${parentCacheKey}`);
                    console.log(parentInfo);
                }
            }

            return true;

        } catch (e) {
            console.error("API Error:", e);
            if (e instanceof Error) {
                setError(`Code aggregation error: ${e.message}`);
            } else {
                setError("An error occurred while aggregating the code. Please try again.");
            }
            return false;
        } finally {
            setCodeLoading(false);
        }
    };

    // Function to aggregate the code of the entire graph from the root node
    const aggregateCodeFromRoot = async (rootNodeId: string, currentGraphIndex: number): Promise<boolean> => {
        try {
            const cacheKey = getCacheKey(currentGraphIndex, rootNodeId);

            if (codeCache.has(cacheKey)) {
                console.log(`Using cached aggregated code for root: ${cacheKey}`);
                const cachedCode = codeCache.get(cacheKey)!;
                const cachedPrompt = promptCache.get(cacheKey) || "Complete project implementation";
                setCodeModalOpen(true);
                setGeneratedCode(cachedCode);
                setCurrentCodeCacheKey(cacheKey);
                setCurrentOriginalPrompt(cachedPrompt);
                setCodeLoading(false);
                return true;
            }

            const edges = getEdges();
            const nodes = getNodes();

            // Get first level children
            const codeNodeIds = findDirectCodeChildren(rootNodeId, nodes, edges);
            const childNodes = nodes.filter(node => codeNodeIds.includes(node.id));

            if (childNodes.length === 0) {
                setError("No children with code found for the root node. Generate code for child tasks first.");
                return false;
            }

            const childrenCode: Array<{taskName: string, code: string, type: string}> = [];
            let missingCode = false;

            for (const childNode of childNodes) {
                const childCacheKey = getCacheKey(currentGraphIndex, childNode.id);

                if (codeCache.has(childCacheKey) && validationCache.get(childCacheKey)) {
                    const code = codeCache.get(childCacheKey)!;
                    const taskName = String(childNode.data.contents || "Unknown");
                    const nodeType = childNode.data?.type === "circle" ? "Goal" : "Task";
                    childrenCode.push({ taskName, code, type: nodeType });
                } else {
                    missingCode = true;
                    console.warn(`Missing code for child node: ${childNode.id} (type: ${childNode.data?.type})`);
                }
            }

            if (missingCode) {
                setError("Some children don't have generated/validated code yet. Please generate/aggregate code for all children first.");
                setCodeLoading(false);
                return false;
            }

            setCodeModalOpen(true);
            setCodeLoading(true);
            setCurrentCodeCacheKey(cacheKey);

            const rootNode = nodes.find(n => n.id === rootNodeId);
            const rootGoal = rootNode?.data?.contents || "Main Goal";

            const response = await fetch('/api/llm/code/aggregate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'root',
                    goal: rootGoal,
                    childrenCode,
                    language: codeLanguage,
                    projectDescription: originalDescription
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to aggregate root code');
            }

            const { code, prompt } = await response.json();

            setGeneratedCode(code);
            setCodeCache(prev => new Map(prev).set(cacheKey, code));
            setPromptCache(prev => new Map(prev).set(cacheKey, prompt));
            setCurrentOriginalPrompt(prompt);
            return true;

        } catch (e) {
            console.error("API Error:", e);
            if (e instanceof Error) {
                setError(`Root code aggregation error: ${e.message}`);
            } else {
                setError("An error occurred while aggregating the root code. Please try again.");
            }
            return false;
        } finally {
            setCodeLoading(false);
        }
    };

    const toggleRightSidebar = () => {
        setIsRightSidebarOpen(!isRightSidebarOpen);
    };

    const toggleLeftSidebar = () => {
        setIsLeftSidebarOpen(!isLeftSidebarOpen);
    };

    const EditableEdgeWrapper = useCallback(
        (props: EdgeProps) => {
            return <EditableEdge {...props} useDiagram={diagram}/>;
        },
        [diagram]
    );
    const edgeTypes: EdgeTypes = {
        "editable-edge": EditableEdgeWrapper,
    };

    const handleGenerateCodeFromTask = useCallback((taskName: string, nodeId: string, currentGraphIndex: number) => {
        const cacheKey = getCacheKey(currentGraphIndex, nodeId);

        setTimeout(() => {
        generateCodeForLeaf(cacheKey, taskName);
        }, 200);

        setTimeout(() => {

            const event = new CustomEvent('saveGraphToHistory');
            window.dispatchEvent(event);
        }, 200);
    }, [generateCodeForLeaf]);


    const handleGenerateGraphFromTask = useCallback((taskName: string, nodeId: string, currentGraphIndex: number) => {
        const cacheKey = getCacheKey(currentGraphIndex, nodeId);

        if (graphCache.has(cacheKey)) {
            const cachedGraphIndex = graphCache.get(cacheKey)!;
            setGraphIndex(cachedGraphIndex);
            const graph = graphsHistory.current[cachedGraphIndex];
            diagram.uploadJson(graph);
        } else {
            generateTaskDiagram(taskName, cacheKey, currentGraphIndex);
        }
    }, [graphCache, generateTaskDiagram, diagram]);


    const handleAggregateCodeFromCircle = useCallback(async (circleNodeId: string, currentGraphIndex: number) => {
        const success = await aggregateCode(circleNodeId, currentGraphIndex);
        if (success) {
            setTimeout(() => {
                const event = new CustomEvent('saveGraphToHistory');
                window.dispatchEvent(event);
            }, 200);
        }
    }, [aggregateCode]);

    const handleAggregateCodeFromRoot = useCallback(async (rootNodeId: string, currentGraphIndex: number) => {
        const success = await aggregateCodeFromRoot(rootNodeId, currentGraphIndex);
        if (success) {
            setTimeout(() => {
                const event = new CustomEvent('saveGraphToHistory');
                window.dispatchEvent(event);
            }, 200);
        }
    }, [aggregateCodeFromRoot]);


    const handleValidateCode = () => {
        setValidationCache(prev => new Map(prev).set(currentCodeCacheKey, true));
        console.log(`Code validated for key: ${currentCodeCacheKey}`);
        setCodeModalOpen(false);
    };

    const previousGraph = () => {
        if (graphIndex > 0) {
            const newIndex = graphIndex - 1;
            setGraphIndex(newIndex);
            const graph = graphsHistory.current[newIndex];
            diagram.uploadJson(graph);
        }
    };

    const homeGraph = () => {
        if (graphIndex !== 0 && graphsHistory.current.length > 0) {
            setGraphIndex(0);
            const graph = graphsHistory.current[0];
            diagram.uploadJson(graph);
        }
    };

    // Event listener to save the current graph state to history
    useEffect(() => {
        const handleSaveGraphToHistory = () => {
            const currentGraph = getSnapshotJson();
            const currentIndex = graphIndexRef.current;

            if (currentGraph && currentIndex >= 0) {
                graphsHistory.current[currentIndex] = currentGraph;
            }
        };

        window.addEventListener('saveGraphToHistory', handleSaveGraphToHistory);

        return () => {
            window.removeEventListener('saveGraphToHistory', handleSaveGraphToHistory);
        };
    }, [getSnapshotJson]);

    // Event listener for "Aggregate Code" button clicks on circle nodes
    useEffect(() => {
        const handleAggregateCodeEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ circleNodeId: string }>;
            const { circleNodeId } = customEvent.detail;
            const currentGraphIndex = graphIndexRef.current;
            const rootNodes = findRootNodes(getNodes(), getEdges());
            const isRootNode = rootNodes.some(node => node.id === circleNodeId);

            if (isRootNode && currentGraphIndex === 0) {
                handleAggregateCodeFromRoot(circleNodeId, currentGraphIndex);
            } else {
                handleAggregateCodeFromCircle(circleNodeId, currentGraphIndex);
            }
        };

        window.addEventListener('aggregateCode', handleAggregateCodeEvent);

        return () => {
            window.removeEventListener('aggregateCode', handleAggregateCodeEvent);
        };
    }, [handleAggregateCodeFromCircle, handleAggregateCodeFromRoot]);

    // Event listener for "Generate Code" button clicks on hexagon nodes
    useEffect(() => {
        const handleGenerateCodeEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ hexagonNodeId: string; taskName: string }>;
            const { hexagonNodeId, taskName } = customEvent.detail;
            const currentGraphIndex = graphIndexRef.current;
            handleGenerateCodeFromTask(taskName, hexagonNodeId, currentGraphIndex);
        };

        window.addEventListener('generateCodeFromHexagon', handleGenerateCodeEvent);

        return () => {
            window.removeEventListener('generateCodeFromHexagon', handleGenerateCodeEvent);
        };
    }, [handleGenerateCodeFromTask]);

    // Event listener for "Generate Graph" button clicks on hexagon nodes
    useEffect(() => {
        const handleGenerateGraphEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ hexagonNodeId: string; taskName: string }>;
            const { hexagonNodeId, taskName } = customEvent.detail;
            const currentGraphIndex = graphIndexRef.current;
            handleGenerateGraphFromTask(taskName, hexagonNodeId, currentGraphIndex);
        };

        window.addEventListener('generateGraphFromHexagon', handleGenerateGraphEvent);

        return () => {
            window.removeEventListener('generateGraphFromHexagon', handleGenerateGraphEvent);
        };
    }, [handleGenerateGraphFromTask]);


    // Keeps the graphIndexRef in sync with the graphIndex state
    useEffect(() => {
        graphIndexRef.current = graphIndex;
    }, [graphIndex]);

    // Cleanup function that runs when the component unmounts
    useEffect(() => {
        return () => {
            graphsHistory.current = [];
            setGraphIndex(-1);
        };
    }, []);

    // Updates all hexagon and circle nodes when codeCache or graphCache changes
    useEffect(() => {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.data?.type === "hexagon" || node.data?.type === "circle") {
                    const cacheKey = getCacheKey(graphIndex, node.id);
                    const hasCode = codeCache.has(cacheKey);
                    const hasGraph = graphCache.has(cacheKey);
                    const isValidated = validationCache.has(cacheKey);
                    let color = node.data.color;
                    if (isValidated) {
                        color = "#F7931E";
                    }

                    return {
                        ...node,
                        data: {
                            ...node.data,
                            hasCode,
                            hasGraph,
                            color,
                        },
                    };
                }
                return node;
            })
        );
    }, [codeCache, graphCache, graphIndex, setNodes, validationCache]);

    return (
        <div className="w-full h-full">
            <ThinkingIndicator />
            <ErrorModal />
            {isModalOpen &&
                <ProjectModal
                    onSubmit={handleModalSubmit}
                />
            }
            <PanelGroup direction="horizontal" style={{display: thinking || isModalOpen ? "none" : "flex"}}>
                {isLeftSidebarOpen ? (
                    <ResizablePanel
                        order={1}
                        className="bg-white dark:bg-black"
                        defaultSize={getDefaultSize(width)}
                        minSize={getDefaultSize(width)}
                    >
                    </ResizablePanel>
                ) : null}
                <PanelResizeHandle
                    className={`w-1 cursor-col-resize ${
                        isLeftSidebarOpen
                            ? "bg-stone-600 visible"
                            : "bg-transparent hidden"
                    }`}
                />
                <ResizablePanel order={2}>
                    <PanelGroup direction="horizontal">
                        <ResizablePanel minSize={30} order={1}>
                            <ReactFlow
                                className={themeHook.theme || "light"}
                                onConnect={diagram.onConnect}
                                isValidConnection={diagram.isValidConnection}
                                onConnectStart={diagram.onConnectStart}
                                connectionLineComponent={ConnectionLine}
                                proOptions={{hideAttribution: true}}
                                onPaneClick={diagram.onPaneClick}
                                nodeTypes={nodeTypes}
                                edgeTypes={edgeTypes}
                                defaultNodes={savedDiagramJson.nodes}
                                defaultEdges={savedDiagramJson.edges}
                                defaultEdgeOptions={defaultEdgeOptions}
                                connectionLineType={ConnectionLineType.SmoothStep}
                                connectionMode={ConnectionMode.Loose}
                                panOnScroll={false}
                                panOnDrag={true}
                                zoomOnScroll={true}
                                onDrop={diagram.onDrop}
                                snapToGrid={false}
                                snapGrid={[10, 10]}
                                onDragOver={diagram.onDragOver}
                                zoomOnDoubleClick={false}
                                onNodesChange={diagram.onNodesChange}
                                onNodeDragStart={diagram.onNodeDragStart}
                                onNodeDragStop={diagram.onNodeDragStop}
                                onSelectionDragStart={diagram.onSelectionDragStart}
                                onSelectionDragStop={diagram.onSelectionDragStop}
                                onNodesDelete={diagram.onNodesDelete}
                                onEdgesDelete={diagram.onEdgesDelete}
                                onEdgeClick={diagram.onEdgeClick}
                                elevateEdgesOnSelect
                                elevateNodesOnSelect
                                maxZoom={10}
                                minZoom={0.1}
                                multiSelectionKeyCode={["Meta", "Control"]}
                            >
                                <Background
                                    color="grey"
                                    bgColor={themeHook.theme === "dark" ? "black" : "white"}
                                />
                                <Panel position="top-left">
                                    <Sidebar/>
                                </Panel>
                                {diagram.editingEdgeId ? (
                                    <Panel position="top-center">
                                        <EdgeToolbar
                                            takeSnapshot={takeSnapshot}
                                            useDiagram={diagram}
                                        />
                                    </Panel>
                                ) : null}
                                <Panel position="top-right">
                                    <Menu
                                        themeHook={themeHook}
                                        diagram={diagram}
                                        isRightSidebarOpen={isRightSidebarOpen}
                                        toggleRightSidebar={toggleRightSidebar}
                                        toggleLeftSidebar={toggleLeftSidebar}
                                    />
                                </Panel>
                                <Controls className="" showInteractive={false}>
                                    <ControlButton onClick={() => diagram.undo()} title="Undo">
                                        <CornerUpLeft fillOpacity={0}/>
                                    </ControlButton>
                                    <ControlButton onClick={() => diagram.redo()} title="Redo">
                                        <CornerUpRight fillOpacity={0}/>
                                    </ControlButton>
                                </Controls>
                                <MiniMap
                                    zoomable
                                    pannable
                                    draggable
                                    nodeComponent={MiniMapNode}
                                />
                                <diagram.HelperLines
                                    horizontal={diagram.helperLineHorizontal}
                                    vertical={diagram.helperLineVertical}
                                />
                                <diagram.Markers/>
                            </ReactFlow>
                        </ResizablePanel>
                        <PanelResizeHandle
                            className={`w-1 cursor-col-resize ${
                                isRightSidebarOpen
                                    ? "bg-stone-600 visible"
                                    : "bg-transparent hidden"
                            }`}
                        />
                        {isRightSidebarOpen ? (
                            <ResizablePanel
                                order={2}
                                defaultSize={getDefaultSize(width)}
                                minSize={getDefaultSize(width)}
                            >
                                <JsonViewer
                                    jsonString={getSnapshotJson()}
                                    toggleRightSidebar={toggleRightSidebar}
                                />
                            </ResizablePanel>
                        ) : null}
                    </PanelGroup>
                </ResizablePanel>
            </PanelGroup>
            {!thinking && secondRequest && (
                <div className="fixed bottom-4 right-4 z-[9998]">
                    <div className="rounded-md bg-white/80 p-2 shadow-md backdrop-blur dark:bg-black/60">
                        <button
                            disabled={graphIndex === 0}
                            onClick={homeGraph}
                            className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Go to First Graph"
                        >
                            Home
                        </button>
                        <button
                            disabled={graphIndex <= 0}
                            onClick={previousGraph}
                            className="ml-2 rounded-md bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Previous Graph"
                        >
                            Previous
                        </button>
                    </div>
                </div>
            )}
            <CodeModal
                isOpen={codeModalOpen}
                onClose={() => setCodeModalOpen(false)}
                code={generatedCode}
                codeLanguage={codeLanguage}
                isLoading={codeLoading}
                onValidate={handleValidateCode}
                onCodeUpdate={(newCode) => {
                    setGeneratedCode(newCode);
                    setCodeCache(prev => new Map(prev).set(currentCodeCacheKey, newCode));
                    setCodeModalOpen(false);
                    setTimeout(() => {
                        setCodeModalOpen(true);
                    }, 100);
                }}
                onRegenerate={(additionalPrompt) => {
                    regenerateCodeWithPrompt(additionalPrompt);
                }}
            />
        </div>
    );
};

const DiagramFrame = () => {
    return (
        <ReactFlowProvider>
            <Flow/>
        </ReactFlowProvider>
    );
};

export default DiagramFrame;

