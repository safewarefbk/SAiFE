import {useState} from "react";


interface ModalProps {
    onSubmit: (description: string, technicalRequirements: string, includeNonFunctional: boolean) => void;
}

const ProjectModal = ({onSubmit}: ModalProps) => {
    const [description, setDescription] = useState("");
    const [technicalRequirements, setTechnicalRequirements] = useState("");
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
        onSubmit(description, technicalRequirements, false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-2xl w-full mx-4">
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    Project Details
                </h2>

                {/* Project Description (Formal Requirements) */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Project Description
                        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 font-normal">
                            (goals, features, constraints — used for diagram generation)
                        </span>
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g., Create a web scraper that extracts product data from e-commerce sites and stores it in a database"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                                 focus:outline-none focus:ring-2 focus:ring-emerald-500
                                 min-h-[150px] max-h-[50vh] resize-y"
                        rows={6}
                    />
                </div>

                {/* Technical Requirements (fed to Code Generator LLM) */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Technical Requirements
                        <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 font-normal">
                            (language, frameworks, libraries — used for code generation)
                        </span>
                    </label>
                    <textarea
                        value={technicalRequirements}
                        onChange={(e) => setTechnicalRequirements(e.target.value)}
                        placeholder="e.g., Use Python 3.11 with FastAPI, SQLAlchemy ORM, and PostgreSQL. Follow RESTful patterns."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                                 focus:outline-none focus:ring-2 focus:ring-emerald-500
                                 min-h-[100px] max-h-[30vh] resize-y"
                        rows={4}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
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