"use client";

import {useState, useRef, useEffect, useCallback} from "react";
import Editor from "@monaco-editor/react";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

/**
 * Split assistant message into text and code blocks for nicer rendering.
 */
function parseBlocks(content: string): Array<{ type: "text" | "code"; lang?: string; value: string }> {
    const blocks: Array<{ type: "text" | "code"; lang?: string; value: string }> = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let last = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
        if (match.index > last) {
            blocks.push({type: "text", value: content.slice(last, match.index).trim()});
        }
        blocks.push({type: "code", lang: match[1] || "plaintext", value: match[2].trim()});
        last = match.index + match[0].length;
    }
    if (last < content.length) {
        const remaining = content.slice(last).trim();
        if (remaining) blocks.push({type: "text", value: remaining});
    }
    return blocks.length > 0 ? blocks : [{type: "text", value: content}];
}

// ─── Session Modal (same style as diagram SessionModal) ───────────────────────

function ChatSessionModal({onSubmit}: { onSubmit: (sessionIdentifier: string, isExisting: boolean) => void }) {
    const [sessionIdentifier, setSessionIdentifier] = useState("");
    const [existingSessions, setExistingSessions] = useState<string[]>([]);
    const [selectedExisting, setSelectedExisting] = useState("");
    const [mode, setMode] = useState<"new" | "existing">("new");
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/session/list?sessionType=chat")
            .then(res => {
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (data.sessions?.length > 0) {
                    setExistingSessions(data.sessions);
                    setMode("existing");
                    setSelectedExisting(data.sessions[0]);
                }
            })
            .catch(() => setMode("new"));
    }, []);

    const handleSubmit = async () => {
        setError("");
        const identifier = mode === "new" ? sessionIdentifier : selectedExisting;
        if (!identifier?.trim()) {
            setError("Please enter a session identifier");
            return;
        }
        if (mode === "new") {
            try {
                const res = await fetch("/api/session/check", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({sessionIdentifier: identifier}),
                });
                const data = await res.json();
                if (data.exists) {
                    setError("Session already exists. Choose a different name or load existing.");
                    return;
                }
            } catch {
                setError("Error checking session.");
                return;
            }
        }
        onSubmit(identifier, mode === "existing");
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Chat Session</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Enter a session identifier to start or resume a chat.
                </p>

                <div className="flex gap-2 mb-4">
                    <button onClick={() => setMode("new")}
                            className={`flex-1 py-2 px-4 rounded-md transition-colors ${mode === "new" ? "bg-emerald-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"}`}>
                        New Session
                    </button>
                    <button onClick={() => setMode("existing")}
                            className={`flex-1 py-2 px-4 rounded-md transition-colors ${mode === "existing" ? "bg-emerald-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"}`}>
                        Load Existing
                    </button>
                </div>

                {mode === "new" ? (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Session Identifier</label>
                        <input type="text" value={sessionIdentifier}
                               onChange={e => setSessionIdentifier(e.target.value)}
                               placeholder="e.g., chat-demo-1"
                               className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                               onKeyDown={e => e.key === "Enter" && handleSubmit()}/>
                    </div>
                ) : (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Existing Session</label>
                        {existingSessions.length > 0 ? (
                            <select value={selectedExisting} onChange={e => setSelectedExisting(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                {existingSessions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        ) : (
                            <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-900 text-gray-500">
                                No sessions available
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-md">
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button onClick={handleSubmit}
                            disabled={mode === "existing" && existingSessions.length === 0}
                            className={`px-6 py-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${mode === "existing" && existingSessions.length === 0 ? "bg-gray-400 text-gray-200 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
                        {mode === "new" ? "Create Session" : "Load Session"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────

export default function ChatPage() {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionName, setSessionName] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
    };

    useEffect(scrollToBottom, [messages]);

    // Handle session selection
    const handleSessionSubmit = async (identifier: string, isExisting: boolean) => {
        if (isExisting) {
            // Load existing session
            try {
                const checkRes = await fetch("/api/session/check", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({sessionIdentifier: identifier}),
                });
                const checkData = await checkRes.json();
                if (checkData.session) {
                    setSessionId(checkData.session.id);
                    setSessionName(identifier);
                    // Load chat history
                    setLoadingHistory(true);
                    const histRes = await fetch(`/api/chat?sessionId=${checkData.session.id}`);
                    const histData = await histRes.json();
                    if (histData.messages) {
                        setMessages(histData.messages.map((m: any) => ({role: m.role, content: m.content})));
                    }
                    setLoadingHistory(false);
                }
            } catch (e) {
                console.error("Error loading session:", e);
            }
        } else {
            // Create new session
            try {
                const res = await fetch("/api/session/create", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({sessionIdentifier: identifier, sessionType: 'chat'}),
                });
                const data = await res.json();
                if (data.session) {
                    setSessionId(data.session.id);
                    setSessionName(identifier);
                    setMessages([]);
                }
            } catch (e) {
                console.error("Error creating session:", e);
            }
        }
    };

    const sendMessage = useCallback(async () => {
        const trimmed = input.trim();
        if (!trimmed || loading || !sessionId) return;

        const userMsg: ChatMessage = {role: "user", content: trimmed};
        // Add the user message and an empty assistant placeholder (streaming=true)
        setMessages(prev => [...prev, userMsg, {role: "assistant", content: "", streaming: true}]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({message: trimmed, sessionId}),
            });

            if (!res.ok || !res.body) {
                const err = await res.json().catch(() => ({error: "Request failed"}));
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: "assistant",
                        content: `⚠️ Error: ${err.error || `HTTP ${res.status}`}`,
                        streaming: false,
                    };
                    return updated;
                });
                return;
            }

            // Consume the text/plain stream chunk by chunk
            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                const text = decoder.decode(value, {stream: true});
                setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    updated[updated.length - 1] = {
                        ...last,
                        content: last.content + text,
                        streaming: true,
                    };
                    return updated;
                });
            }

            // Mark streaming done so parseBlocks / Monaco editor render
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {...updated[updated.length - 1], streaming: false};
                return updated;
            });

        } catch (e: any) {
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: "assistant",
                    content: `⚠️ Error: ${e.message}`,
                    streaming: false,
                };
                return updated;
            });
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }, [input, loading, sessionId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Show session modal if no session selected
    if (!sessionId) {
        return <ChatSessionModal onSubmit={handleSessionSubmit}/>;
    }

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-zinc-900 text-black dark:text-white">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-semibold">SAiFE Chat</h1>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                        Baseline Agent
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Session: {sessionName}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => { setSessionId(null); setMessages([]); setSessionName(""); }}
                            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                        Switch Session
                    </button>
                    <a href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        ← Back to Diagram
                    </a>
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
                {loadingHistory && (
                    <div className="text-center text-zinc-400 animate-pulse mt-10">Loading conversation…</div>
                )}

                {!loadingHistory && messages.length === 0 && (
                    <div className="text-center text-zinc-400 dark:text-zinc-500 mt-20">
                        <p className="text-2xl mb-2">💬</p>
                        <p className="text-sm">Describe your project or ask a question</p>
                        <p className="text-xs mt-1 text-zinc-400">This is the baseline comparison — no goal-model decomposition.</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                            msg.role === "user"
                                ? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        }`}>
                            {msg.role === "assistant" ? (
                                msg.streaming ? (
                                    // While streaming: plain text so we avoid repeated Monaco mount/unmount
                                    <p className="whitespace-pre-wrap">{msg.content}
                                        <span className="inline-block w-2 h-4 ml-0.5 bg-zinc-400 dark:bg-zinc-500 animate-pulse align-middle"/>
                                    </p>
                                ) : (
                                    // Stream complete: render code blocks with Monaco
                                    parseBlocks(msg.content).map((block, j) =>
                                        block.type === "code" ? (
                                            <div key={j} className="my-2 rounded overflow-hidden border border-zinc-300 dark:border-zinc-600">
                                                <div className="text-xs px-3 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                                                    {block.lang}
                                                </div>
                                                <Editor
                                                    height={Math.min(400, block.value.split("\n").length * 20 + 20)}
                                                    language={block.lang}
                                                    value={block.value}
                                                    theme="vs-dark"
                                                    options={{
                                                        readOnly: true,
                                                        minimap: {enabled: false},
                                                        scrollBeyondLastLine: false,
                                                        fontSize: 13,
                                                        lineNumbers: "on",
                                                        wordWrap: "on",
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <p key={j}>{block.value}</p>
                                        ),
                                    )
                                )
                            ) : (
                                msg.content
                            )}
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef}/>
            </div>

            {/* Input */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 px-4 py-3 bg-zinc-50 dark:bg-zinc-800">
                <div className="flex gap-2 max-w-4xl mx-auto">
                    <textarea
                        ref={inputRef}
                        className="flex-1 resize-none rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Describe your project or ask a question… (Enter to send, Shift+Enter for newline)"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={loading}
                    />
                    <button onClick={sendMessage}
                            disabled={loading || !input.trim()}
                            className="self-end px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
