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
import { Mistral } from "@mistralai/mistralai";
import {
    PanelGroup,
    PanelResizeHandle,
    Panel as ResizablePanel,
} from "react-resizable-panels";

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
import {GoogleGenerativeAI} from "@google/generative-ai";
import ProjectModal from "@components/ProjectModal/Modal";

const nodeTypes: NodeTypes = {
    shape: ShapeNode,
};

const defaultEdgeOptions: DefaultEdgeOptions = {
    type: "editable-edge",
    style: {strokeWidth: 2},
};

const detectProgrammingLanguage = (description: string): string => {
    const text = description.toLowerCase();
    
    const languagePatterns = [
        {
            name: "TypeScript",
            patterns: ["typescript", "ts", "angular", "nest.js", "nestjs", "deno"],
            keywords: ["interface", "type", "enum", "namespace"],
            score: 0
        },
        {
            name: "JavaScript",
            patterns: ["javascript", "js", "node.js", "nodejs", "react", "vue", "express", "npm"],
            keywords: ["function", "const", "let", "var", "async", "await"],
            score: 0
        },
        {
            name: "Python",
            patterns: ["python", "django", "flask", "fastapi", "pandas", "numpy", "pytorch"],
            keywords: ["def", "class", "import", "from", "__init__"],
            score: 0
        },
        {
            name: "Java",
            patterns: ["java", "spring", "springboot", "maven", "gradle", "jvm"],
            keywords: ["public", "private", "protected", "class", "interface"],
            score: 0
        },
        {
            name: "C#",
            patterns: ["c#", "csharp", "\\.net", "dotnet", "asp\\.net", "blazor"],
            keywords: ["public", "private", "namespace", "using"],
            score: 0
        },
        {
            name: "Go",
            patterns: ["golang", "go lang"],
            keywords: ["func", "package", "import", "goroutine"],
            score: 0
        },
        {
            name: "Rust",
            patterns: ["rust", "cargo"],
            keywords: ["fn", "let", "mut", "struct", "enum", "impl"],
            score: 0
        },
        {
            name: "PHP",
            patterns: ["php", "laravel", "symfony", "wordpress"],
            keywords: ["<\\?php", "function", "class", "\\$"],
            score: 0
        },
        {
            name: "Ruby",
            patterns: ["ruby", "rails", "gem"],
            keywords: ["def", "class", "module", "end"],
            score: 0
        },
        {
            name: "C++",
            patterns: ["c\\+\\+", "cpp", "cplusplus"],
            keywords: ["#include", "namespace", "std::", "class"],
            score: 0
        },
        {
            name: "C",
            patterns: ["\\bc\\b", "embedded", "microcontroller"],
            keywords: ["#include", "stdio.h", "malloc", "printf"],
            score: 0
        }
    ];

    languagePatterns.forEach(lang => {
        lang.patterns.forEach(pattern => {
            try {
                const regex = new RegExp(pattern, 'gi');
                const matches = (text.match(regex) || []).length;
                lang.score += matches * 3;
            } catch (e) {
                console.warn(`Regex error for pattern "${pattern}":`, e);
                if (text.includes(pattern.toLowerCase())) {
                    lang.score += 3;
                }
            }
        });

        lang.keywords.forEach(keyword => {
            if (text.includes(keyword.toLowerCase())) {
                lang.score += 2;
            }
        });

        if (text.includes(lang.name.toLowerCase())) {
            lang.score += 5;
        }
    });

    const bestMatch = languagePatterns.reduce((best, current) => 
        current.score > best.score ? current : best
    );

    return bestMatch.score > 0 ? bestMatch.name : "Python";
};

const Flow = () => {
    const [chatSessions, setChatSessions] = useState<{ [key: string]: Array<{role: string, parts: Array<{text: string}>}> }>({});
    const [codeSessions, setCodeSessions] = useState<Array<{role: "user" | "assistant", content: string}>>([]);
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
    const GeminiApiKey = process.env.NEXT_PUBLIC_API_KEY;
    if (!GeminiApiKey) {
    throw new Error("GEMINI_API_KEY not found");
    }
    const genAI = new GoogleGenerativeAI(GeminiApiKey);
    const MistralApiKey = process.env.NEXT_PUBLIC_MISTRAL_API_KEY;
    if (!MistralApiKey) {
        throw new Error("MISTRAL_API_KEY not found");
    }
    const mistral = new Mistral({apiKey: MistralApiKey});
    const [codeModalOpen, setCodeModalOpen] = useState(false);
    const [generatedCode, setGeneratedCode] = useState<string>("");
    const [codeLoading, setCodeLoading] = useState(false);
    const [graphIndex, setGraphIndex] = useState<number>(-1);
    const graphIndexRef = useRef<number>(-1);
    const graphsHistory = useRef<string[]>([]);
    const [secondRequest, setSecondRequest] = useState<boolean>(false);
    const [thinking, setThinking] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [codeCache, setCodeCache] = useState<Map<string, string>>(new Map());
    const [graphCache, setGraphCache] = useState<Map<string, number>>(new Map());
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-pro",
    });

    const DEFAULT_MODEL = "codestral-latest";

    const generationConfig = {
        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 65365,
        responseMimeType: "application/json",
    };

    const getChatHistory = (sessionKey: string) => {
        return chatSessions[sessionKey] || [];
    };

    const getCodeHistory = () => {
        return codeSessions || [];
    };

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
                                setIsModalOpen(true);
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



    const handleModalSubmit = async (description: string, includeNonFunctional: boolean) => {
        setThinking(true);
        setError("");
        setIsModalOpen(false);
        setOriginalDescription(description);
        const detectedLanguage = detectProgrammingLanguage(description);
        setCodeLanguage(detectedLanguage);
        const nonFunctionalInstruction = includeNonFunctional
            ? "Include also non-functional requirements (soft goals, round-rectangle nodes) in the model."
            : "Do NOT include non-functional requirements (no soft goals, no round-rectangle nodes) in the model.";
        const originalPrompt = `You are a requirements analyst. Your task is to generate an Initial Requirements Model of a software system as a tree-structured graph in JSON format, with two sections: nodes and edges.
                ${nonFunctionalInstruction}

                Node types:
                - Circle = functional goal (main or sub-goal).
                - Capsule = logical operator AND.
                - Hexagon = task (implementable activity).
                - Round-rectangle = soft goal (non-functional requirement).

                Input:
                The system to be modeled is described as: ${
                            description !== ""
                                ? description
                                : "I don't have any ideas currently so, you can create requirements for any software project as an example"
                            }

                Expected output:
                - A tree graph in JSON with nodes and edges.
                - Each node must include x,y coordinates and consistent style.
                - The graph must follow the rules below.
                
                Rules:
                1. General structure:
                    - Only one main functional goal (circle) as the root.
                    - Every other node must have at least one parent.
                    - Each hexagon (task) must connect to a circle.
                    - Each round-rectangle (soft goal) must connect to a circle or a hexagon.
                    - A circle must be connected to at least two hexagons (tasks) otherwise just use one hexagon.
                2. Connections:
                    - No duplicate edges between two nodes.
                    - Only edges to soft goals MUST be dotted.
                    - Dotted edges to soft goals MUST have a '+' if the impact is positive or a '-' label in the middle of the edge.
                    - A node cannot have both + and - impacts to the same soft goal.
                    - All other edges must be solid.
                3. AND operator:
                    - Use capsule: AND only if a node has two or more children.
                    - The AND operator must be placed above its children.
                4. Layout:
                    - NEVER make nodes overlap.
                    - Edges must NEVER cross other edges or nodes.
                    - Subtrees must be visually well composed and distinguishable.
                    - Nodes at the same y-axis MUST be at least 400px apart on the x-axis.
                    - Edges MUST be at least 30px long.
                5. Style:
                    - Keep it coincise and simple.
                    - The text of the nodes must NEVER be longer than the node itself.
                    - Remember to implement cybersecurity requirements.
                    - Use short text for node contents.
                    - Remember to insert the '+' or '-' label on dotted edges to soft goals.
                    - All nodes must have color #438D57.
                    - Node sizes must be consistent with the provided example.
                    - IMPORTANT: "style.width" and "style.height" must be NUMERIC values, not strings with "px".
                    - Edges must follow this format:
                    {
                        "type": "editable-edge",
                        "style": { "strokeWidth": 2 },
                        "source": "nodeId1",
                        "sourceHandle": "top",
                        "target": "nodeId2",
                        "targetHandle": "bottom",
                        "id": "xy-edge__nodeId1top-nodeId2bottom"
                    }

                Here is an example of the expected JSON format:
                {
                "nodes": [
                    {
                    "id": "1",
                    "type": "shape",
                    "position": { "x": 400, "y": 50 },
                    "style": { "width": 200, "height": 70 },
                    "data": { "type": "circle", "contents": "Order Food Online", "color": "#438D57" }
                    },
                    {
                    "id": "2",
                    "type": "shape",
                    "position": { "x": 400, "y": 180 },
                    "style": { "width": 42, "height": 22 },
                    "data": { "type": "capsule", "contents": "AND", "color": "#438D57" }
                    },
                    {
                    "id": "3",
                    "type": "shape",
                    "position": { "x": 200, "y": 300 },
                    "style": { "width": 200, "height": 70 },
                    "data": { "type": "circle", "contents": "Browse Menu", "color": "#438D57" }
                    }
                ],
                "edges": [
                    {
                    "type": "editable-edge",
                    "style": { "strokeWidth": 2 },
                    "source": "2",
                    "sourceHandle": "top",
                    "target": "1",
                    "targetHandle": "bottom",
                    "id": "xy-edge__2top-1bottom"
                    },
                    {
                    "type": "editable-edge",
                    "style": { "strokeWidth": 2 },
                    "source": "3",
                    "sourceHandle": "top",
                    "target": "2",
                    "targetHandle": "bottom",
                    "id": "xy-edge__3top-2bottom"
                    }
                ]
                }
                Output only the JSON, no explanations.`;
        
        try {
            const chatSession = model.startChat({
                generationConfig,
                history: []
            });

            const result = await chatSession.sendMessage(originalPrompt);
            const responseText = result.response.text();
            
            setChatSessions(prev => ({
                ...prev,
                ["main"]: [
                    { role: "user", parts: [{ text: originalPrompt }] },
                    { role: "model", parts: [{ text: responseText }] }
                ]
            }));
            
            if (JSON.parse(responseText)) {
                diagram.uploadJson(responseText);
                console.log(diagram);
                console.log(responseText);
                graphsHistory.current = [responseText];
                setGraphIndex(0);
            }
        } catch (e) {
            setError("An error occurred while generating the diagram. Please try again.");

        } finally {
            setThinking(false);
        }
    }

    // function to generate code for a single leaf node (hexagon)
    const generateCodeForLeaf  = async (cacheKey: string, taskName: string) => {
        try{
                setCodeModalOpen(true);
                setCodeLoading(true);
                setError("");
            
                if (cacheKey && codeCache.has(cacheKey)) {
                    const cachedCode = codeCache.get(cacheKey)!;
                    setGeneratedCode(cachedCode);
                    setCodeLoading(false);
                    return;
                } else {
                    const leafPrompt = `You are a senior software engineer. Generate secure, based on OWASP top 10 and CWEs, code that reflects the task, output ONLY code.
                    Instructions:
                    - Implement what is written in the task: ${taskName}.
                    - Divide the code in logical functions based on functionality.
                    - Keep code short and focused; avoid placeholders if not necessary.
                    - Use ${codeLanguage} as programming language.
                    - Ensure code is clean, well-structured, and follows best practices.
                    - Make the code secure, following OWASP Top 10 and common CWEs.
                    - Protect against common vulnerabilities (e.g., SQL injection, XSS).
                    - If ${codeLanguage} is Java, implement a compilable single class.
                    - Generate a single file with secure functions.
                    - If no code is needed, respond with "No code needed for this task.
                    - Always use the name of the task for naming the class."`;

                    const messages = [{ role: "user", content: leafPrompt }];

                    const result = await mistral.chat.complete({
                    model: DEFAULT_MODEL,
                    messages: messages as any
                    });

                    let text = "";
                    if (result.choices && result.choices.length > 0 && result.choices[0].message) {
                        const content = result.choices[0].message.content;
                        if (typeof content === 'string') {
                            text = content;
                        } else if (Array.isArray(content)) {
                            text = content.map(chunk => {
                                if (typeof chunk === 'string') {
                                    return chunk;
                                }
                                if ('text' in chunk) {
                                    return chunk.text;
                                }
                                return '';
                            }).join('');
                        }
                    }
                
                    if (!text) {
                        text = "Error: No code generated. Please try again.";
                    }
                    
                    setGeneratedCode(text);
                    setCodeCache(prev => new Map(prev).set(cacheKey, text));

                }
        } catch (e) {
            console.error("Mistral API Error:", e);
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

    const aggregateCode = async (circleNodeId: string, currentGraphIndex: number): Promise<boolean> => {
        try {
            const cacheKey = `${currentGraphIndex}_${circleNodeId}`;
            
            if (codeCache.has(cacheKey)) {
                console.log(`Using cached aggregated code for circle: ${cacheKey}`);
                const cachedCode = codeCache.get(cacheKey)!;
                setCodeModalOpen(true);
                setGeneratedCode(cachedCode);
                setCodeLoading(false);
                return true;
            }
            
            const edges = getEdges();
            const nodes = getNodes();
            
            const findCodeChildren = (nodeId: string, visited = new Set<string>()): string[] => {
                if (visited.has(nodeId)) return [];
                visited.add(nodeId);
                
                const childEdges = edges.filter(edge => edge.target === nodeId);
                const childNodeIds = childEdges.map(edge => edge.source);
                
                const codeNodeIds: string[] = [];
                
                for (const childId of childNodeIds) {
                    const childNode = nodes.find(n => n.id === childId);
                    if (!childNode) continue;
                    
                    if (childNode.data?.type === "hexagon" || childNode.data?.type === "circle") {
                        codeNodeIds.push(childId);
                    } else if (childNode.data?.type === "capsule") {
                        const nestedNodes = findCodeChildren(childId, visited);
                        codeNodeIds.push(...nestedNodes);
                    }
                }
                
                return codeNodeIds;
            };
            
            const codeNodeIds = findCodeChildren(circleNodeId);
            const childNodes = nodes.filter(node => codeNodeIds.includes(node.id));
            
            if (childNodes.length === 0) {
                setError("No children with code found for this circle. Generate code for child tasks first.");
                return false;
            }
            
            
            
            const childrenCode: Array<{taskName: string, code: string, type: string}> = [];
            let missingCode = false;
            
            for (const childNode of childNodes) {
                const childCacheKey = `${currentGraphIndex}_${childNode.id}`;
                
                if (codeCache.has(childCacheKey)) {
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
                setError("Some children don't have generated code yet. Please generate/aggregate code for all children first.");
                setCodeLoading(false);
                return false;
            }

            setCodeModalOpen(true);
            setCodeLoading(true);
            
            const circleNode = nodes.find(n => n.id === circleNodeId);
            const circleGoal = circleNode?.data?.contents || "Goal";
            
            const codeSnippets = childrenCode.map((child, index) => 
                `\n--- ${child.type} ${index + 1}: ${child.taskName} ---\n${child.code}`
            ).join('\n\n');
            
            const aggregationPrompt = `You are a senior software engineer. You have been given code snippets from multiple sub-components (tasks and/or goals) that together implement the higher-level functional goal: "${circleGoal}".

Your task is to integrate and aggregate these code snippets into a cohesive, well-structured implementation that represents the complete functional goal.

Code snippets from sub-components:
${codeSnippets}

Instructions:
- Integrate all code snippets into a unified implementation.
- Remove duplications and resolve any conflicts between snippets.
- Ensure the code flows logically and all parts work together.
- Use ${codeLanguage} as programming language.
- Keep the code clean, maintainable, and following best practices.
- Make the code secure, following OWASP Top 10 and common CWEs.
- If ${codeLanguage} is Java, create a compilable single class or properly structured classes.
- Ensure all sub-component functionalities are preserved in the integrated code.
- The code should be then applicable for this project: ${originalDescription}.

VERY IMPORTANT:
- Output ONLY the integrated code, NO explanations.
- Do NOT add comments like "// code from task X" - integrate naturally.`;

            const messages = [{ role: "user", content: aggregationPrompt }];
            const result = await mistral.chat.complete({
                model: DEFAULT_MODEL,
                messages: messages as any
            });

            let text = "";
            if (result.choices && result.choices.length > 0 && result.choices[0].message) {
                const content = result.choices[0].message.content;
                if (typeof content === 'string') {
                    text = content;
                } else if (Array.isArray(content)) {
                    text = content.map(chunk => {
                        if (typeof chunk === 'string') return chunk;
                        if ('text' in chunk) return chunk.text;
                        return '';
                    }).join('');
                }
            }
            
            if (!text) {
                text = "Error: No aggregated code generated. Please try again.";
            }
            
            setGeneratedCode(text);
            setCodeCache(prev => new Map(prev).set(cacheKey, text));
            return true;
            
        } catch (e) {
            console.error("Mistral API Error:", e);
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

    const generateTaskDiagram = async (taskName: string, nodeId?: string) => {
        setThinking(true);
        setError("");

        const taskPrompt = `Now, focus ONLY on the task: ${taskName}. Generate a smaller requirements graph than the previous one, the number of nodes MUST be reduced, for this specific task, keeping the context of the original description, and using the same exact rules.
        NEVER include nodes that are not related to this specific task, or that are already implemented in previous graphs.
        \nOutput only the JSON, no explanations.`;

        try {
            const currentHistory = getChatHistory("main");
            const chatSession = model.startChat({
                generationConfig,
                history: currentHistory
            });
            console.log(currentHistory);
            const result = await chatSession.sendMessage(taskPrompt);
            const responseText = result.response.text();
            console.log(responseText);
            setChatSessions(prev => ({
                ...prev,
                ["main"]: [
                    ...currentHistory,
                    { role: "user", parts: [{ text: taskPrompt }] },
                    { role: "model", parts: [{ text: responseText }] }
                ]
            }));

            if (JSON.parse(responseText)) {
                diagram.uploadJson(responseText);
                setSecondRequest(true);
                graphsHistory.current.push(responseText);
                const newGraphIndex = graphsHistory.current.length - 1;
                setGraphIndex(newGraphIndex);
                
                if (nodeId) {
                    setGraphCache(prev => new Map(prev).set(nodeId, newGraphIndex));
                }
            }
        } catch (e) {
            setError("An error occurred while generating the task diagram. Please try again.");
        } finally {
            setThinking(false);
        }
    };

    const getDefaultSize = (w: number) => {
        if (w < 1024) {
            return 33;
        } else return 20;
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
        const cacheKey = `${currentGraphIndex}_${nodeId}`;
        
        generateCodeForLeaf(cacheKey, taskName);
        
        setTimeout(() => {
            const event = new CustomEvent('saveGraphToHistory');
            window.dispatchEvent(event);
        }, 200);
    }, [generateCodeForLeaf]);


    const handleGenerateGraphFromTask = useCallback((taskName: string, nodeId: string, currentGraphIndex: number) => {
        const cacheKey = `${currentGraphIndex}_${nodeId}`;
        
        if (graphCache.has(cacheKey)) {
            const cachedGraphIndex = graphCache.get(cacheKey)!;
            setGraphIndex(cachedGraphIndex);
            const graph = graphsHistory.current[cachedGraphIndex];
            diagram.uploadJson(graph);
        } else {
            generateTaskDiagram(taskName, cacheKey);
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
            handleAggregateCodeFromCircle(circleNodeId, currentGraphIndex);
        };
        
        window.addEventListener('aggregateCode', handleAggregateCodeEvent);
        
        return () => {
            window.removeEventListener('aggregateCode', handleAggregateCodeEvent);
        };
    }, [handleAggregateCodeFromCircle]);
    
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
                    const cacheKey = `${graphIndex}_${node.id}`;
                    const hasCode = codeCache.has(cacheKey);
                    const hasGraph = graphCache.has(cacheKey);
                    
                    let color = node.data.color;
                    if (hasCode) {
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
    }, [codeCache, graphCache, graphIndex, setNodes]);

    return (
        <div className="w-full h-full">
            <ThinkingIndicator />
            <ErrorModal />
            {isModalOpen &&
                <ProjectModal
                    onSubmit={handleModalSubmit}
                />
            }
            <PanelGroup direction="horizontal" style={{display: thinking ? "none" : "block"}}>
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
                                panOnScroll={true}
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
                                isRightSidebarOpen === true
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
                isLoading={codeLoading}
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
