import {useCallback, useEffect} from "react";
import {Edge, Node, useReactFlow} from "@xyflow/react";
import {create} from "zustand";

type UseUndoRedoOptions = {
    maxHistorySize?: number;
    enableShortcuts?: boolean;
};

/**
 * Optional callbacks so callers can include arbitrary extra state
 * (e.g. code caches) in every snapshot.  When omitted the hook
 * behaves exactly as before — only nodes & edges are tracked.
 */
export type ExtraStateCallbacks<T = unknown> = {
    /** Return the current extra state to store in the snapshot */
    capture: () => T;
    /** Restore previously captured extra state */
    restore: (state: T) => void;
};

type HistoryItem = {
    nodes: Node[];
    edges: Edge[];
    /** Opaque extra state captured via ExtraStateCallbacks */
    extra?: unknown;
};

// ── Shared zustand store so ALL useUndoRedo() consumers share one history ──
interface UndoRedoStore {
    past: HistoryItem[];
    future: HistoryItem[];
    extraCallbacks: ExtraStateCallbacks | null;
    pushPast: (item: HistoryItem, maxSize: number) => void;
    popPast: () => HistoryItem | undefined;
    pushFuture: (item: HistoryItem) => void;
    popFuture: () => HistoryItem | undefined;
    clearFuture: () => void;
    clearAll: () => void;
    setExtraCallbacks: (cb: ExtraStateCallbacks) => void;
}

const useUndoRedoStore = create<UndoRedoStore>((set, get) => ({
    past: [],
    future: [],
    extraCallbacks: null,

    pushPast: (item, maxSize) =>
        set((s) => ({
            past: [...s.past.slice(s.past.length - maxSize + 1), item],
        })),

    popPast: () => {
        const {past} = get();
        if (past.length === 0) return undefined;
        const last = past[past.length - 1];
        set({past: past.slice(0, -1)});
        return last;
    },

    pushFuture: (item) =>
        set((s) => ({future: [...s.future, item]})),

    popFuture: () => {
        const {future} = get();
        if (future.length === 0) return undefined;
        const last = future[future.length - 1];
        set({future: future.slice(0, -1)});
        return last;
    },

    clearFuture: () => set({future: []}),

    clearAll: () => set({past: [], future: []}),

    setExtraCallbacks: (cb) => set({extraCallbacks: cb}),
}));

/** Single source of truth for undo/redo history depth */
const MAX_HISTORY_SIZE = 5;

const defaultOptions = {
    maxHistorySize: MAX_HISTORY_SIZE,
    enableShortcuts: false,
};

export const useUndoRedo = ({
                                maxHistorySize = defaultOptions.maxHistorySize,
                                enableShortcuts = defaultOptions.enableShortcuts,
                            }: UseUndoRedoOptions = {}) => {
    const {setNodes, setEdges, getNodes, getEdges} = useReactFlow();

    const store = useUndoRedoStore;          // direct access to zustand store
    const canUndo = useUndoRedoStore((s) => s.past.length > 0);
    const canRedo = useUndoRedoStore((s) => s.future.length > 0);

    const setExtraStateCallbacks = useCallback((cb: ExtraStateCallbacks) => {
        store.getState().setExtraCallbacks(cb);
    }, [store]);

    const takeSnapshot = useCallback(() => {
        const extra = store.getState().extraCallbacks?.capture();
        store.getState().pushPast(
            {nodes: getNodes(), edges: getEdges(), extra},
            maxHistorySize,
        );
        store.getState().clearFuture();
    }, [getNodes, getEdges, maxHistorySize, store]);

    const getSnapshotJson = useCallback(() => {
        return JSON.stringify({nodes: getNodes(), edges: getEdges()});
    }, [getNodes, getEdges]);

    const clearHistory = useCallback(() => {
        store.getState().clearAll();
    }, [store]);

    const undo = useCallback(() => {
        const pastState = store.getState().popPast();
        if (pastState) {
            const extra = store.getState().extraCallbacks?.capture();
            store.getState().pushFuture({nodes: getNodes(), edges: getEdges(), extra});
            setNodes(pastState.nodes);
            setEdges(pastState.edges);
            if (pastState.extra !== undefined && store.getState().extraCallbacks) {
                store.getState().extraCallbacks!.restore(pastState.extra);
            }
        }
    }, [setNodes, setEdges, getNodes, getEdges, store]);

    const redo = useCallback(() => {
        const futureState = store.getState().popFuture();
        if (futureState) {
            const extra = store.getState().extraCallbacks?.capture();
            store.getState().pushPast(
                {nodes: getNodes(), edges: getEdges(), extra},
                maxHistorySize,
            );
            setNodes(futureState.nodes);
            setEdges(futureState.edges);
            if (futureState.extra !== undefined && store.getState().extraCallbacks) {
                store.getState().extraCallbacks!.restore(futureState.extra);
            }
        }
    }, [setNodes, setEdges, getNodes, getEdges, maxHistorySize, store]);

    useEffect(() => {
        if (!enableShortcuts) return;

        const keyDownHandler = (event: KeyboardEvent) => {
            if (
                event.key === "z" &&
                (event.ctrlKey || event.metaKey) &&
                event.shiftKey
            ) {
                redo();
            } else if (event.key === "z" && (event.ctrlKey || event.metaKey)) {
                undo();
            }
        };

        document.addEventListener("keydown", keyDownHandler);
        return () => document.removeEventListener("keydown", keyDownHandler);
    }, [undo, redo, enableShortcuts]);

    return {
        undo,
        redo,
        takeSnapshot,
        getSnapshotJson,
        clearHistory,
        canUndo: !canUndo,   // inverted to match original API (true = cannot undo)
        canRedo: !canRedo,
        setExtraStateCallbacks,
    };
};

export default useUndoRedo;
