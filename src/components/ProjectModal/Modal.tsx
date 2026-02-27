import {useState} from "react";


interface ModalProps {
    onSubmit: (description: string, includeNonFunctional: boolean) => void;
}

const ProjectModal = ({onSubmit}: ModalProps) => {
    const [description, setDescription] = useState("");
    const [error, setError] = useState<string>("");
    // Uncomment below if you want to enable non-functional requirements in the future
    // const [includeNonFunctional, setIncludeNonFunctional] = useState(false);

    const handleSubmit = () => {
        setError("");

        if (!description || description.trim() === "") {
            setError("Please enter a project description");
            return;
        }

        // Change 'false' to 'includeNonFunctional' if you enable the checkbox
        onSubmit(description, false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    Project Details
                </h2>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Describe your project briefly. Make sure to include information about the programming language,
                    key features, and architecture you want.
                </p>

                {/* Input Section */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Project Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g., Create a web scraper in Python that extracts product data from e-commerce sites"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                                 focus:outline-none focus:ring-2 focus:ring-emerald-500
                                 min-h-[100px] resize-y"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        rows={4}
                    />
                </div>

                {/* Non-Functional Requirements Checkbox - Commented out for now */}
                {/* Uncomment this section if you want to enable non-functional requirements */}
                {/*
                <div className="mb-4">
                    <div className="flex items-center">
                        <input
                            id="include-non-functional"
                            type="checkbox"
                            checked={includeNonFunctional}
                            onChange={(e) => setIncludeNonFunctional(e.target.checked)}
                            className="w-4 h-4 text-emerald-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded
                                     focus:ring-emerald-500 focus:ring-2"
                        />
                        <label htmlFor="include-non-functional" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Include non-functional requirements
                        </label>
                    </div>
                </div>
                */}

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
                        className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700
                                 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                                 transition-colors"
                    >
                        Generate Diagram
                    </button>
                </div>
            </div>
        </div>
    )
}
export default ProjectModal;