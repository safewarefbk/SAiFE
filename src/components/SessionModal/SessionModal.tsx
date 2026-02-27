import React, { useState, useEffect } from 'react';

interface SessionModalProps {
    onSubmit: (sessionIdentifier: string, isExisting: boolean) => void;
}

const SessionModal: React.FC<SessionModalProps> = ({ onSubmit }) => {
    const [sessionIdentifier, setSessionIdentifier] = useState<string>("");
    const [existingSessions, setExistingSessions] = useState<string[]>([]);
    const [selectedExisting, setSelectedExisting] = useState<string>("");
    const [mode, setMode] = useState<'new' | 'existing'>('new');
    const [error, setError] = useState<string>("");

    useEffect(() => {
        // Load existing sessions
        fetch('/api/session/list')
            .then(res => {
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                return res.json();
            })
            .then(data => {
                if (data.sessions && data.sessions.length > 0) {
                    setExistingSessions(data.sessions);
                    setMode('existing');
                    setSelectedExisting(data.sessions[0]);
                } else {
                    setExistingSessions([]);
                    setMode('new');
                }
            })
            .catch(err => {
                console.error('Error loading sessions:', err);
                setExistingSessions([]);
                setMode('new');
            });
    }, []);

    const handleSubmit = async () => {
        setError("");

        const identifier = mode === 'new' ? sessionIdentifier : selectedExisting;

        if (!identifier || identifier.trim() === "") {
            setError("Please enter a session identifier");
            return;
        }

        if (mode === 'new') {
            // Check if session already exists
            try {
                const response = await fetch('/api/session/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionIdentifier: identifier })
                });

                const data = await response.json();

                if (data.exists) {
                    setError("This session identifier already exists. Please choose a different name or select 'Load Existing Session'.");
                    return;
                }
            } catch (err) {
                setError("Error checking session. Please try again.");
                return;
            }
        }

        onSubmit(identifier, mode === 'existing');
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    Session Management
                </h2>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Enter a session identifier to start or resume your work.
                </p>

                {/* Mode Selector */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setMode('new')}
                        className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                            mode === 'new'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                    >
                        New Session
                    </button>
                    <button
                        onClick={() => setMode('existing')}
                        className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                            mode === 'existing'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                    >
                        Load Existing
                    </button>
                </div>

                {/* Input Section */}
                {mode === 'new' ? (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Session Identifier
                        </label>
                        <input
                            type="text"
                            value={sessionIdentifier}
                            onChange={(e) => setSessionIdentifier(e.target.value)}
                            placeholder="e.g., my-project-demo"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                                     focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSubmit();
                                }
                            }}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Use a unique identifier for your session (e.g., project name, date, etc.)
                        </p>
                    </div>
                ) : (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Select Existing Session
                        </label>
                        {existingSessions.length > 0 ? (
                            <select
                                value={selectedExisting}
                                onChange={(e) => setSelectedExisting(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                {existingSessions.map((session) => (
                                    <option key={session} value={session}>
                                        {session}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                          bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                                No sessions available
                            </div>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {existingSessions.length > 0
                                ? 'Select a session to continue your work'
                                : 'Create a new session to get started'}
                        </p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-md">
                        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={mode === 'existing' && existingSessions.length === 0}
                        className={`px-6 py-2 rounded-md transition-colors
                                 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                                 ${mode === 'existing' && existingSessions.length === 0
                                     ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 dark:text-gray-400 cursor-not-allowed'
                                     : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                 }`}
                    >
                        {mode === 'new' ? 'Create Session' : 'Load Session'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionModal;


