import {
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
import MiniMapNode from "./minimap-node";
import {useDiagram} from "@/hooks/useDiagram";
import {CornerUpLeft, CornerUpRight} from "react-feather";
import useUndoRedo from "@/hooks/useUndoRedo";
import {
    PanelGroup,
    Panel as ResizablePanel,
} from "react-resizable-panels";
import {
    detectProgrammingLanguage,
    findRootNodes,
    findDirectCodeChildren,
    findAllDescendants
} from "@/lib/utils";
import { integrateSubgraph, convertTaskToGoal } from "@/lib/subgraph-integration";
import * as SessionManager from "@/services/session-management";
import { deleteCodeFromDatabase } from "@/services/session-management";
import * as LLMOperations from "@/services/llm-operations";


import {useCallback, useEffect, useRef, useState} from "react";
import {EditableEdge} from "./edges/EditableEdge";
import {ConnectionLine} from "./edges/ConnectionLine";
import savedDiagramJson from "../../public/examples/DiagramX.json";
import {useTheme} from "@/hooks/useTheme";
import {Menu} from "./Menu";
import CodeModal from "@components/CodeModal/CodeModal";
import ProjectModal from "@components/ProjectModal/Modal";
import Sidebar from "./Sidebar/Sidebar";
import SessionModal from "@components/SessionModal/SessionModal";


const nodeTypes: NodeTypes = {
    shape: ShapeNode,
};

const defaultEdgeOptions: DefaultEdgeOptions = {
    type: "editable-edge",
    style: {strokeWidth: 2},
};


const Flow = () => {
    const [sessionIdentifier, setSessionIdentifier] = useState<string | null>(null);  // Database session identifier (user-friendly name)
    const [dbSessionId, setDbSessionId] = useState<string | null>(null);  // Database session ID (actual ID for DB queries)
    const [sessionModalOpen, setSessionModalOpen] = useState(true);  // Show session modal on startup
    const diagram = useDiagram();
    const {setNodes, setEdges, getNodes, getEdges} = diagram.useReactFlow();
    const {takeSnapshot, setExtraStateCallbacks, clearHistory} = useUndoRedo();
    const [isModalOpen, setIsModalOpen] = useState(false);  // Changed to false, will open after session selection
    const [originalDescription, setOriginalDescription] = useState<string>("");
    const [technicalRequirements, setTechnicalRequirements] = useState<string>("");
    const themeHook = useTheme();
    const [codeModalOpen, setCodeModalOpen] = useState(false);
    const [generatedCode, setGeneratedCode] = useState<string>("");
    const [codeLoading, setCodeLoading] = useState(false);
    const [currentCodeCacheKey, setCurrentCodeCacheKey] = useState<string>("");
    const [currentOriginalPrompt, setCurrentOriginalPrompt] = useState<string>("");
    const [thinking, setThinking] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [codeCache, setCodeCache] = useState<Map<string, string>>(new Map());
    const [promptCache, setPromptCache] = useState<Map<string, string>>(new Map());
    const [validationCache, setValidationCache] = useState<Map<string, boolean>>(new Map());
    const [codeIdCache, setCodeIdCache] = useState<Map<string, string>>(new Map()); // nodeId → DB codeId
    const [savedMessage, setSavedMessage] = useState<boolean>(false);

    // ── Undo/redo: include code caches in every snapshot ──
    // We use refs so the capture/restore closures always see current values
    // without needing to re-register on every state change.
    const codeCacheRef = useRef(codeCache);
    const promptCacheRef = useRef(promptCache);
    const validationCacheRef = useRef(validationCache);
    const codeIdCacheRef = useRef(codeIdCache);
    codeCacheRef.current = codeCache;
    promptCacheRef.current = promptCache;
    validationCacheRef.current = validationCache;
    codeIdCacheRef.current = codeIdCache;

    useEffect(() => {
        setExtraStateCallbacks({
            capture: () => ({
                codeCache: new Map(codeCacheRef.current),
                promptCache: new Map(promptCacheRef.current),
                validationCache: new Map(validationCacheRef.current),
                codeIdCache: new Map(codeIdCacheRef.current),
            }),
            restore: (state: any) => {
                setCodeCache(new Map(state.codeCache));
                setPromptCache(new Map(state.promptCache));
                setValidationCache(new Map(state.validationCache));
                setCodeIdCache(new Map(state.codeIdCache));
                // Close code modal so stale code doesn't stay visible after undo/redo
                setCodeModalOpen(false);
                setGeneratedCode("");
            },
        });
    }, [setExtraStateCallbacks]);

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
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
                 style={{zIndex: 99999}}>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="flex-shrink-0">
                            <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                      clipRule="evenodd"/>
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

    const SavedMessage = () => {
        if (!savedMessage) return null;
        return (
            <div className="fixed top-4 right-4 z-[9999] animate-fade-in">
                <div className="bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"/>
                    </svg>
                    <span className="font-medium">Saved</span>
                </div>
            </div>
        );
    };

    // =====================
    // SESSION MANAGEMENT
    // =====================

    /**
     * Handle session selection/creation from SessionModal
     */
    const handleSessionSubmit = async (identifier: string, isExisting: boolean) => {
        setThinking(true);
        setError("");
        setSessionIdentifier(identifier);

        try {
            if (isExisting) {
                // Load existing session
                const data = await SessionManager.loadSessionFromDatabase(identifier);
                const { session, codes, graphs } = data;

                // Set the database session ID for LLM operations
                setDbSessionId(session.id);

                setOriginalDescription(session.projectDescription || '');
                setTechnicalRequirements(session.technicalRequirements || '');

                // Reconstruct the single graph
                if (graphs.length > 0) {
                    // Load the single graph (index 0)
                    diagram.uploadJson(graphs[0].jsonData);

                    // Reconstruct code cache — only include codes still linked to a node
                    const newCodeCache = new Map<string, string>();
                    const newPromptCache = new Map<string, string>();
                    const newValidationCache = new Map<string, boolean>();
                    const newCodeIdCache = new Map<string, string>();

                    // Build a set of nodeIds that still reference a code
                    const linkedNodeIds = new Set(
                        (data.nodes as any[])
                            .filter((n: any) => n.codeId)
                            .map((n: any) => n.id)
                    );

                    codes.forEach((code: any) => {
                        // Only restore code that is still linked to a node
                        if (!linkedNodeIds.has(code.nodeId)) return;

                        newCodeCache.set(code.nodeId, code.code);
                        if (code.prompt) {
                            newPromptCache.set(code.nodeId, code.prompt);
                        }
                        if (code.isValidated) {
                            newValidationCache.set(code.nodeId, true);
                        }
                        if (code.id) {
                            newCodeIdCache.set(code.nodeId, code.id);
                        }
                    });

                    setCodeCache(newCodeCache);
                    setPromptCache(newPromptCache);
                    setValidationCache(newValidationCache);
                    setCodeIdCache(newCodeIdCache);
                }

                setSessionModalOpen(false);

            } else {
                // Create new session
                const response = await SessionManager.createSessionInDatabase(identifier);

                // Set the database session ID for the new session
                setDbSessionId(response.session.id);

                setSessionModalOpen(false);
                setIsModalOpen(true);  // Show project modal for new sessions
            }
        } catch (e: any) {
            setError(e.message || 'Failed to initialize session');
            setSessionModalOpen(true);
        } finally {
            setThinking(false);
        }
    };

    /**
     * Save graph to database
     * @param showMessage - If true, shows a "Saved" message for 2 seconds
     */
    const saveGraphToDatabase = useCallback(async (showMessage: boolean = false) => {
        if (!sessionIdentifier) {
            setError("No active session to save");
            return;
        }

        const nodes = getNodes();
        const edges = getEdges();

        // Safety guard: never overwrite the DB with an empty snapshot.
        if (nodes.length === 0) {
            console.warn('saveGraphToDatabase skipped: node list is empty, refusing to overwrite DB.');
            return;
        }

        try {
            await SessionManager.saveGraphToDatabase(sessionIdentifier, nodes, edges);

            if (showMessage) {
                setSavedMessage(true);
                setTimeout(() => setSavedMessage(false), 2000);
            } else {
                console.log('Graph auto-saved to database');
            }
        } catch (e) {
            console.error('Failed to save graph to database:', e);
            if (showMessage) {
                setError('Failed to save to database');
            }
        }
    }, [sessionIdentifier, getNodes, getEdges]);

    /**
     * Save code to database when it's generated/updated.
     * Returns the codeId so the caller can update node state via the codeCache useEffect.
     */
    const saveCodeToDatabase = useCallback(async (nodeId: string, code: string, prompt?: string, totalTokens?: number | null): Promise<string | null> => {
        if (!sessionIdentifier || !code) return null;

        try {
            const codeId = await SessionManager.saveCodeToDatabase(
                sessionIdentifier,
                nodeId,
                code,
                prompt || '',
                validationCache.get(nodeId) || false,
                totalTokens ?? null
            );

            console.log('Code saved to database:', nodeId, 'codeId:', codeId);
            return codeId;
        } catch (e) {
            console.error('Failed to save code to database:', e);
            return null;
        }
    }, [sessionIdentifier, validationCache]);


    // Function to generate the first graph of the project
    const handleModalSubmit = async (description: string, techReqs: string, includeNonFunctional: boolean) => {
        setThinking(true);
        setError("");
        setIsModalOpen(false);
        setOriginalDescription(description);
        setTechnicalRequirements(techReqs);

        try {
            if (!dbSessionId) {
                throw new Error("No active session. Please create a session first.");
            }

            // Diagram LLM receives only the formal description (no technical noise)
            const {responseText} = await LLMOperations.generateDiagram(description, includeNonFunctional, dbSessionId);

            let parsedJson;
            try {
                parsedJson = JSON.parse(responseText);
            } catch {
                throw new Error("Invalid JSON returned by the diagram generator. Please try again.");
            }

            if (parsedJson) {
                takeSnapshot();
                diagram.uploadJson(responseText);

                if (sessionIdentifier) {
                    try {
                        await SessionManager.updateSessionMetadata(sessionIdentifier, description, techReqs);
                        setTimeout(() => { saveGraphToDatabase(); }, 500);
                    } catch (e) {
                        console.error('Failed to save project description to session:', e);
                    }
                }
            }
        } catch (e) {
            setError("An error occurred while generating the diagram. Please try again.");
            setIsModalOpen(true);
        } finally {
            setThinking(false);
        }
    }

    // Function to generate a graph for a single specific task
    const generateTaskDiagram = async (taskName: string, actualNodeId: string, userPrompt?: string) => {
        setThinking(true);
        setError("");

        if (taskName == "") {
            setError("Task name cannot be empty.");
            setThinking(false);
            return;
        }

        if (!dbSessionId) {
            setError("No active session. Please generate a diagram first.");
            setThinking(false);
            return;
        }

        try {
            // Call LLM to generate task diagram (with optional user instructions)
            const { responseText } = await LLMOperations.generateTaskDiagram(dbSessionId, taskName, userPrompt);
            const subgraphData = JSON.parse(responseText);

            if (subgraphData && subgraphData.nodes && subgraphData.edges) {
                // Snapshot BEFORE mutating so Ctrl+Z can revert subgraph generation
                takeSnapshot();

                // Get current nodes
                const currentNodes = getNodes();

                // Find the originating node (the task/hexagon that triggered this)
                const originatingNode = currentNodes.find((n: any) => n.id === actualNodeId);

                if (!originatingNode) {
                    console.error('Could not find node with ID:', actualNodeId);
                    console.error('Available node IDs:', currentNodes.map(n => n.id));
                    throw new Error("Originating node not found");
                }

                // Convert the hexagon node to a circle (goal) node
                const updatedOriginatingNode = convertTaskToGoal(originatingNode);


                // Integrate the subgraph (position nodes, remap edges, avoid collisions)
                const { repositionedNodes, repositionedEdges } = integrateSubgraph(
                    subgraphData,
                    originatingNode,
                    currentNodes,
                    actualNodeId
                );

                // Update the diagram: modify the originating node and add new nodes/edges
                setNodes((nodes) => [
                    ...nodes.map((n: any) => n.id === actualNodeId ? updatedOriginatingNode : n),
                    ...repositionedNodes
                ]);

                setEdges((edges) => [
                    ...edges,
                    ...repositionedEdges
                ]);

                // Auto-save after graph generation
                setTimeout(() => {
                    saveGraphToDatabase();
                }, 500);
            }
        } catch (e) {
            console.error("Error generating task diagram:", e);
            setError("An error occurred while generating the task diagram. Please try again.");
        } finally {
            setThinking(false);
        }
    };

    // function to generate code for a single leaf node (hexagon)
    const generateCodeForLeaf = async (nodeId: string, taskName: string) => {
        if (taskName === "Task" || taskName === "") {
            setError("Task name cannot be empty.");
            return;
        }

        setCurrentCodeCacheKey(nodeId);
        setError("");

        // Serve from cache immediately — no LLM call needed
        if (nodeId && codeCache.has(nodeId)) {
            const cachedCode = codeCache.get(nodeId)!;
            const cachedPrompt = promptCache.get(nodeId) || "";
            setGeneratedCode(cachedCode);
            setCurrentOriginalPrompt(cachedPrompt);
            setCodeLoading(false);
            setCodeModalOpen(true);
            return;
        }

        // Show modal in loading state only when we are about to call the LLM
        setGeneratedCode("");
        setCodeLoading(true);
        setCodeModalOpen(true);

        try {
            const {code, prompt, totalTokens} = await LLMOperations.generateCode(
                dbSessionId!,
                nodeId,
                taskName,
            );

            // Snapshot BEFORE mutating caches so Ctrl+Z can revert code generation
            takeSnapshot();

            setCurrentOriginalPrompt(prompt);
            setGeneratedCode(code);
            setCodeCache(prev => new Map(prev).set(nodeId, code));
            setPromptCache(prev => new Map(prev).set(nodeId, prompt));

            // Save to database — only on success, never on error
            const codeId = await saveCodeToDatabase(nodeId, code, prompt, totalTokens);
            if (codeId) {
                setCodeIdCache(prev => new Map(prev).set(nodeId, codeId));
            }
        } catch (e) {
            console.error("API Error:", e);
            // Close the modal so no broken/empty code is shown
            setCodeModalOpen(false);
            setGeneratedCode("");
            if (e instanceof Error) {
                setError(`Code generation error: ${e.message}`);
            } else {
                setError("An error occurred while generating the code. Please try again.");
            }
        } finally {
            setCodeLoading(false);
        }
    }

    // Function to regenerate code with additional prompt instructions
    const regenerateCodeWithPrompt = async (additionalPrompt: string) => {
        try {
            setCodeLoading(true);
            setError("");

            // Server loads originalPrompt from DB via nodeId, saves updated code+prompt, sets isValidated=false
            const {code, updatedPrompt} = await LLMOperations.regenerateCode(
                dbSessionId!,
                currentCodeCacheKey,   // nodeId — server uses this to fetch originalPrompt from DB
                generatedCode,
                additionalPrompt
            );

            // Snapshot BEFORE mutating caches so Ctrl+Z can revert regeneration
            takeSnapshot();

            setGeneratedCode(code);
            setCodeCache(prev => new Map(prev).set(currentCodeCacheKey, code));

            // Update the local prompt cache with the accumulated prompt
            setPromptCache(prev => new Map(prev).set(currentCodeCacheKey, updatedPrompt));

            // Invalidate validation in UI — server already persisted isValidated=false
            setValidationCache(prev => new Map(prev).set(currentCodeCacheKey, false));
            setNodes(nodes => nodes.map(n =>
                n.id === currentCodeCacheKey
                    ? { ...n, data: { ...n.data, isValidated: false } }
                    : n
            ));

            // Close and reopen modal to show updated code
            setCodeModalOpen(false);
            setTimeout(() => setCodeModalOpen(true), 100);

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

    // Function to aggregate the code of the direct children inside the circles.
    // When isRoot=true, uses the root-level aggregation prompt; otherwise uses the child-level one.
    const aggregateCode = async (circleNodeId: string, isRoot: boolean = false): Promise<boolean> => {
        const cacheKey = circleNodeId;

        // Serve from cache immediately — no LLM call needed
        if (codeCache.has(cacheKey)) {
            const cachedCode = codeCache.get(cacheKey)!;
            const cachedPrompt = promptCache.get(cacheKey) || (isRoot ? "Complete project implementation" : "Aggregated code for functional goal");
            setGeneratedCode(cachedCode);
            setCurrentCodeCacheKey(cacheKey);
            setCurrentOriginalPrompt(cachedPrompt);
            setCodeLoading(false);
            setCodeModalOpen(true);
            return true;
        }

        const edges = getEdges();
        const nodes = getNodes();

        const codeNodeIds = findDirectCodeChildren(circleNodeId, nodes, edges);
        const childNodes = nodes.filter(node => codeNodeIds.includes(node.id));

        if (childNodes.length === 0) {
            setError("No children with code found for goal. Generate code for child tasks first.");
            return false;
        }

        const childrenCode: Array<{ taskName: string, code: string, type: string }> = [];
        const missingNodes: string[] = [];

        for (const childNode of childNodes) {
            if (codeCache.has(childNode.id) && validationCache.get(childNode.id)) {
                const code = codeCache.get(childNode.id)!;
                const taskName = String(childNode.data.contents || "Unknown");
                const nodeType = childNode.data?.type === "circle" ? "Goal" : "Task";
                childrenCode.push({taskName, code, type: nodeType});
            } else {
                missingNodes.push(String(childNode.data.contents || childNode.id));
            }
        }

        if (missingNodes.length > 0) {
            setError(`Missing validated code for: ${missingNodes.join(', ')}. Please generate and validate all children first.`);
            return false;
        }

        // Show modal in loading state only when we are about to call the LLM
        setGeneratedCode("");
        setCodeLoading(true);
        setCodeModalOpen(true);
        setCurrentCodeCacheKey(cacheKey);

        try {
            const targetNode = nodes.find(n => n.id === circleNodeId);
            const goalLabel = String(targetNode?.data?.contents || "Goal");
            const typeLabel = isRoot ? "root-goal" : "sub-goal";

            const {code, prompt, totalTokens} = await LLMOperations.aggregateCode(typeLabel, goalLabel, childrenCode, dbSessionId!);

            // Snapshot BEFORE mutating caches so Ctrl+Z can revert aggregation
            takeSnapshot();

            setGeneratedCode(code);
            setCodeCache(prev => new Map(prev).set(cacheKey, code));
            setPromptCache(prev => new Map(prev).set(cacheKey, prompt));
            setCurrentOriginalPrompt(prompt);

            // Save to database — only on success
            const codeId = await saveCodeToDatabase(cacheKey, code, prompt, totalTokens);
            if (codeId) {
                setCodeIdCache(prev => new Map(prev).set(cacheKey, codeId));
            }
            return true;

        } catch (e) {
            console.error("API Error:", e);
            setCodeModalOpen(false);
            setGeneratedCode("");
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

    /**
     * Delete the generated code for the currently open node:
     * - clears all local caches
     * - updates node data so buttons revert to "Generate Code"
     * - removes the code record from the DB
     */
    const handleDeleteCode = useCallback(async () => {
        const nodeId = currentCodeCacheKey;
        if (!nodeId) return;

        // Clear the entire undo/redo history: after a DB deletion there is no
        // safe state to restore (the code no longer exists in the database).
        clearHistory();

        // Clear local caches
        setCodeCache(prev => { const m = new Map(prev); m.delete(nodeId); return m; });
        setPromptCache(prev => { const m = new Map(prev); m.delete(nodeId); return m; });
        setValidationCache(prev => { const m = new Map(prev); m.delete(nodeId); return m; });
        setCodeIdCache(prev => { const m = new Map(prev); m.delete(nodeId); return m; });

        // Update node data immediately
        setNodes(nodes => nodes.map(n =>
            n.id === nodeId
                ? { ...n, data: { ...n.data, hasCode: false, codeId: null, isValidated: false } }
                : n
        ));

        // Close the modal
        setCodeModalOpen(false);
        setGeneratedCode("");

        // Persist deletion to DB
        if (sessionIdentifier) {
            try {
                await deleteCodeFromDatabase(sessionIdentifier, nodeId);
            } catch (e) {
                console.error('Failed to delete code from database:', e);
            }
        }
    }, [currentCodeCacheKey, sessionIdentifier, clearHistory, setNodes]);

    const EditableEdgeWrapper = useCallback(
        (props: EdgeProps) => {
            return <EditableEdge {...props} useDiagram={diagram}/>;
        },
        [diagram]
    );
    const edgeTypes: EdgeTypes = {
        "editable-edge": EditableEdgeWrapper,
    };

    const handleGenerateCodeFromTask = useCallback((taskName: string, nodeId: string) => {
        setTimeout(() => {
            generateCodeForLeaf(nodeId, taskName);
        }, 200);
    }, [generateCodeForLeaf]);

    const handleGenerateGraphFromTask = useCallback((taskName: string, nodeId: string, userPrompt?: string) => {
        // Check if node is already a circle (goal) - meaning subgraph already generated
        const nodes = getNodes();
        const targetNode = nodes.find((n: any) => n.id === nodeId);

        if (targetNode?.data?.type === 'circle') {
            // Node already converted to goal, subgraph exists
            return;
        }

        // Generate new subgraph and merge it into current view
        generateTaskDiagram(taskName, nodeId, userPrompt);
    }, [generateTaskDiagram, getNodes]);

    const handleAggregateCode = useCallback(async (nodeId: string, isRoot: boolean = false) => {
        await aggregateCode(nodeId, isRoot);
    }, [aggregateCode]);



    const handleValidateCode = async () => {
        const isCurrentlyValidated = validationCache.get(currentCodeCacheKey) === true;
        const newValidated = !isCurrentlyValidated;

        // Toggle in local cache
        setValidationCache(prev => new Map(prev).set(currentCodeCacheKey, newValidated));

        // Update isValidated on the node data so color updates immediately
        setNodes(nodes => nodes.map(n =>
            n.id === currentCodeCacheKey
                ? { ...n, data: { ...n.data, isValidated: newValidated } }
                : n
        ));

        // Persist to DB
        if (sessionIdentifier) {
            try {
                if (newValidated) {
                    await SessionManager.validateCodeInDatabase(sessionIdentifier, currentCodeCacheKey);
                } else {
                    await SessionManager.invalidateCodeInDatabase(sessionIdentifier, currentCodeCacheKey);
                }
            } catch (e) {
                console.error('Failed to save validation state:', e);
            }
        }

        setCodeModalOpen(false);
    };


    /**
     * Toggle collapse/expand state for a node and its descendants
     * When collapsed: hides all descendant nodes and their connecting edges
     * When expanded: shows all previously hidden descendant nodes
     * Note: This does NOT delete nodes, just hides them - preventing ID conflicts
     */
    const handleToggleCollapseNode = useCallback((nodeId: string) => {
        const nodes = getNodes();
        const edges = getEdges();

        const targetNode = nodes.find(n => n.id === nodeId);

        // Find all descendants of this node
        const descendants = findAllDescendants(nodeId, nodes, edges);

        if (!targetNode || descendants.length === 0) {
            console.warn('Cannot collapse: node has no subgraph or descendants');
            return;
        }

        const isCurrentlyCollapsed = targetNode.data?.collapsed || false;
        const newCollapsedState = !isCurrentlyCollapsed;


        takeSnapshot();

        // Update the collapsed state of the target node and visibility of descendants
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === nodeId) {
                    // Toggle collapsed state on the parent node
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            collapsed: newCollapsedState,
                        },
                    };
                } else if (descendants.includes(node.id)) {
                    // Hide/show descendant nodes
                    return {
                        ...node,
                        hidden: newCollapsedState,
                    };
                }
                return node;
            })
        );

        // Hide/show edges that connect descendants
        // Only hide edges where BOTH source and target are in the collapsed subtree
        // Keep the edge from parent to first child visible (it connects to the collapsed node)
        setEdges((edges) =>
            edges.map((edge) => {
                const sourceIsDescendant = descendants.includes(edge.source);
                const targetIsDescendant = descendants.includes(edge.target);

                // Hide edge if it's between descendants OR from descendant to another descendant
                // Keep the edge from parent (nodeId) to children visible
                if (sourceIsDescendant || targetIsDescendant) {
                    return {
                        ...edge,
                        hidden: newCollapsedState,
                    };
                }
                return edge;
            })
        );
    }, [getNodes, getEdges, setNodes, setEdges, takeSnapshot]);

    // Event listener for "Aggregate Code" button clicks on circle nodes
    useEffect(() => {
        const handleAggregateCodeEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ circleNodeId: string }>;
            const {circleNodeId} = customEvent.detail;
            const rootNodes = findRootNodes(getNodes(), getEdges());
            const isRootNode = rootNodes.some(node => node.id === circleNodeId);
            handleAggregateCode(circleNodeId, isRootNode);
        };

        window.addEventListener('aggregateCode', handleAggregateCodeEvent);

        return () => {
            window.removeEventListener('aggregateCode', handleAggregateCodeEvent);
        };
    }, [handleAggregateCode]);

    // Event listener for "Generate Code" button clicks on hexagon nodes
    useEffect(() => {
        const handleGenerateCodeEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ hexagonNodeId: string; taskName: string }>;
            const {hexagonNodeId, taskName} = customEvent.detail;
            handleGenerateCodeFromTask(taskName, hexagonNodeId);
        };

        window.addEventListener('generateCodeFromHexagon', handleGenerateCodeEvent);

        return () => {
            window.removeEventListener('generateCodeFromHexagon', handleGenerateCodeEvent);
        };
    }, [handleGenerateCodeFromTask]);

    // Event listener for "Generate Graph" button clicks on hexagon nodes
    useEffect(() => {
        const handleGenerateGraphEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ hexagonNodeId: string; taskName: string; userPrompt?: string }>;
            const {hexagonNodeId, taskName, userPrompt} = customEvent.detail;
            handleGenerateGraphFromTask(taskName, hexagonNodeId, userPrompt);
        };

        window.addEventListener('generateGraphFromHexagon', handleGenerateGraphEvent);

        return () => {
            window.removeEventListener('generateGraphFromHexagon', handleGenerateGraphEvent);
        };
    }, [handleGenerateGraphFromTask]);

    // Event listener for collapse/expand toggle on circle nodes
    useEffect(() => {
        const handleToggleCollapseEvent = (event: Event) => {
            const customEvent = event as CustomEvent<{ nodeId: string }>;
            const { nodeId } = customEvent.detail;
            handleToggleCollapseNode(nodeId);
        };

        window.addEventListener('toggleCollapseNode', handleToggleCollapseEvent);

        return () => {
            window.removeEventListener('toggleCollapseNode', handleToggleCollapseEvent);
        };
    }, [handleToggleCollapseNode]);

    // Keyboard shortcut: Ctrl+S / Cmd+S to save
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for Ctrl+S (Windows/Linux) or Cmd+S (Mac)
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault(); // Prevent browser's default save dialog
                saveGraphToDatabase(true); // Show "Saved" message
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [saveGraphToDatabase]);

    // Single setNodes call that syncs hasCode, codeId, and isValidated.
    // Triggered when codeCache, codeIdCache, or validationCache changes.
    // Color is NOT stored here — it is computed dynamically at render time by ShapeNode.
    useEffect(() => {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.data?.type === "hexagon" || node.data?.type === "circle") {
                    const hasCode = codeCache.has(node.id) || !!node.data?.codeId;
                    const isValidated = validationCache.get(node.id) === true;
                    const newCodeId = codeIdCache.get(node.id) ?? node.data?.codeId ?? null;

                    return {
                        ...node,
                        data: {
                            ...node.data,
                            hasCode,
                            codeId: newCodeId,
                            isValidated,
                        },
                    };
                }
                return node;
            })
        );
    }, [codeCache, codeIdCache, validationCache, setNodes]);

    return (
        <div className="w-full h-full">
            <ThinkingIndicator/>
            <ErrorModal/>
            <SavedMessage/>
            {sessionModalOpen && (
                <SessionModal onSubmit={handleSessionSubmit} />
            )}
            {isModalOpen &&
                <ProjectModal
                    onSubmit={handleModalSubmit}
                />
            }
            <PanelGroup direction="horizontal" style={{display: thinking || isModalOpen || sessionModalOpen ? "none" : "flex"}}>
                <ResizablePanel order={2}>
                    <PanelGroup direction="horizontal">
                        <ResizablePanel minSize={30} order={1}>
                            <div
                                className="w-full h-full"
                                style={{ background: themeHook.theme === "dark" ? "#000" : "#fff" }}
                            >
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
                                panOnDrag={true}  // Enable panning with left mouse button
                                selectionOnDrag={true}  // Enable box selection when holding Shift
                                selectionKeyCode="Shift"  // Box selection only when holding Shift
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
                                <Panel position="top-left">
                                    <Sidebar/>
                                </Panel>
                                <Panel position="top-right">
                                    <Menu
                                        themeHook={themeHook}
                                        diagram={diagram}
                                        onSave={() => saveGraphToDatabase(true)}
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
                            </div>
                        </ResizablePanel>
                    </PanelGroup>
                </ResizablePanel>
            </PanelGroup>
            <CodeModal
                isOpen={codeModalOpen}
                onClose={() => setCodeModalOpen(false)}
                code={generatedCode}
                codeLanguage={detectProgrammingLanguage(technicalRequirements)}
                isLoading={codeLoading}
                isValidated={validationCache.get(currentCodeCacheKey) === true}
                onValidate={handleValidateCode}
                onDeleteCode={handleDeleteCode}
                onCodeUpdate={async (newCode) => {
                    setGeneratedCode(newCode);
                    setCodeCache(prev => new Map(prev).set(currentCodeCacheKey, newCode));

                    // Invalidate validation — manual edit means code needs re-validation
                    setValidationCache(prev => new Map(prev).set(currentCodeCacheKey, false));
                    setNodes(nodes => nodes.map(n =>
                        n.id === currentCodeCacheKey
                            ? { ...n, data: { ...n.data, isValidated: false } }
                            : n
                    ));
                    if (sessionIdentifier) {
                        SessionManager.invalidateCodeInDatabase(sessionIdentifier, currentCodeCacheKey)
                            .catch(e => console.error('Failed to invalidate code after edit:', e));
                    }

                    // Persist the edited code to DB
                    const prompt = promptCache.get(currentCodeCacheKey) || '';
                    const codeId = await saveCodeToDatabase(currentCodeCacheKey, newCode, prompt);
                    if (codeId) {
                        setCodeIdCache(prev => new Map(prev).set(currentCodeCacheKey, codeId));
                    }

                    setCodeModalOpen(false);
                    setTimeout(() => { setCodeModalOpen(true); }, 100);
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

