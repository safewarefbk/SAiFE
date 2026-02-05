"use client";
import React, {useState, useEffect} from "react";
import {useTheme} from '@/hooks/useTheme';
import {Edit, Check, X, RefreshCw} from 'react-feather';
import MonacoEditor from '@monaco-editor/react';

interface CodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    code: string;
    isLoading?: boolean;
    onCodeUpdate?: (newCode: string) => void;
    onRegenerate?: (additionalPrompt: string) => void;
    onValidate?: () => void;
    codeLanguage?: string;
}

const CodeModal: React.FC<CodeModalProps> = ({
                                                 isOpen,
                                                 onClose,
                                                 code,
                                                 isLoading,
                                                 onCodeUpdate,
                                                 onRegenerate,
                                                 onValidate,
                                                 codeLanguage
                                             }) => {
    const themeHook = useTheme();
    const [dots, setDots] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedCode, setEditedCode] = useState(code);
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [additionalPrompt, setAdditionalPrompt] = useState('');

    useEffect(() => {
        setEditedCode(code);
    }, [code]);

    useEffect(() => {
        if (!isOpen) {
            setIsEditing(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isLoading) return;

        const interval = setInterval(() => {
            setDots(prev => {
                if (prev === '...') return '';
                return prev + '.';
            });
        }, 500);

        return () => clearInterval(interval);
    }, [isLoading]);


    if (!isOpen) return null;

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(isEditing ? editedCode : code);
        } catch (e) {

        }
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleApply = () => {
        if (onCodeUpdate) {
            onCodeUpdate(editedCode);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        if (editedCode !== code) {
            if (confirm('Discard changes?')) {
                setEditedCode(code);
                setIsEditing(false);
            }
        } else {
            setIsEditing(false);
        }
    };

    const handleOpenPromptModal = () => {
        setIsPromptModalOpen(true);
        setAdditionalPrompt('');
    };

    const handleRegenerate = () => {
        if (additionalPrompt.trim() && onRegenerate) {
            onRegenerate(additionalPrompt.trim());
            setIsPromptModalOpen(false);
            setAdditionalPrompt('');
        }
    };

    const handleClosePromptModal = () => {
        setIsPromptModalOpen(false);
        setAdditionalPrompt('');
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-4xl rounded-lg bg-white p-4 shadow-lg dark:bg-black dark:text-white">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                        {isEditing ? 'Edit Code' : 'Generated Code'}
                        {isEditing && editedCode !== code && (
                            <span className="ml-2 text-sm text-yellow-500">• Modified</span>
                        )}
                    </h2>
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <>
                                <button
                                    onClick={onValidate}
                                    className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                                >
                                    <Check size={14}/>
                                    Validate Code
                                </button>
                                <button
                                    onClick={copyToClipboard}
                                    className="rounded-md bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
                                    disabled={isLoading}
                                >
                                    Copy
                                </button>
                                <button
                                    onClick={handleEdit}
                                    className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                                    disabled={isLoading}
                                >
                                    <Edit size={14}/>
                                    Edit
                                </button>
                                {onRegenerate && (
                                    <button
                                        onClick={handleOpenPromptModal}
                                        className="flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700"
                                        disabled={isLoading}
                                    >
                                        <RefreshCw size={14}/>
                                        Regenerate
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="rounded-md bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700"
                                >
                                    Close
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleApply}
                                    className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
                                >
                                    <Check size={14}/>
                                    Apply
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center gap-1 rounded-md bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700"
                                >
                                    <X size={14}/>
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="max-h-[70vh] overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
                    {isLoading ? (
                        <div className="flex h-40 items-center justify-center text-slate-500">
                            Thinking{dots}
                        </div>
                    ) : (
                        <div style={{ height: '500px', minHeight: '500px' }}>
                            <MonacoEditor
                                height="100%"
                                defaultLanguage={codeLanguage}
                                language={codeLanguage}
                                value={isEditing ? editedCode : code}
                                onChange={val => isEditing && setEditedCode(val ?? '')}
                                theme={themeHook.theme === 'dark' ? 'vs-dark' : 'light'}
                                options={{
                                    fontSize: 14,
                                    fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                                    minimap: { enabled: false },
                                    scrollBeyondLastLine: false,
                                    wordWrap: 'on',
                                    lineNumbers: 'on',
                                    automaticLayout: true,
                                    readOnly: !isEditing,
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Prompt Modal for Regeneration */}
            {isPromptModalOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
                    <div
                        className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800 dark:text-white">
                        <h3 className="mb-4 text-xl font-semibold">Add Instructions for Regeneration</h3>
                        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                            Provide additional instructions or modifications you want to apply to the code. This will be
                            added to the original prompt.
                        </p>
                        <textarea
                            value={additionalPrompt}
                            onChange={(e) => setAdditionalPrompt(e.target.value)}
                            placeholder="e.g., Add error handling, Use async/await pattern, Add comments..."
                            className="w-full resize-none rounded-md border border-gray-300 bg-white p-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            rows={6}
                            autoFocus
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={handleClosePromptModal}
                                className="rounded-md bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRegenerate}
                                disabled={!additionalPrompt.trim()}
                                className="flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RefreshCw size={14}/>
                                Regenerate Code
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CodeModal;
