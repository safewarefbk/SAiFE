import {useState} from "react";


interface ModalProps {
    onSubmit: (description: string, includeNonFunctional: boolean) => void;
}

const ProjectModal = ({onSubmit}: ModalProps) => {
    const [description, setDescription] = useState("");
    const [includeNonFunctional, setIncludeNonFunctional] = useState(true);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(description, includeNonFunctional);
    };
    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDescription(e.target.value);
    }

    return (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

            <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                    <div
                        className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                        <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start">
                                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                                    <h3 className="text-base font-semibold leading-6 text-gray-900"
                                        id="modal-title">Enter your project details (specify language)</h3>
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-500">
                                            Please write about your project briefly.
                                        </p>
                                    </div>
                                    <textarea
                                        className="bg-gray-200 appearance-none border-2 border-gray-200 rounded w-full py-2 px-4 text-gray-700 text-sm leading-tight focus:outline-none focus:bg-white focus:border-purple-500"
                                        id="project-description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                onSubmit(description, includeNonFunctional);
                                            }
                                        }}
                                        rows={3}></textarea>
                                    <div className="flex items-center mt-2">
                                        <input
                                            id="include-non-functional"
                                            type="checkbox"
                                            checked={includeNonFunctional}
                                            onChange={e => setIncludeNonFunctional(e.target.checked)}
                                            className="mr-2"
                                        />
                                        <label htmlFor="include-non-functional" className="text-sm text-gray-700">
                                            Include non-functional requirements
                                        </label>

                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                            <button type="button"
                                    onClick={handleSubmit}
                                    className="inline-flex w-full justify-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 sm:ml-3 sm:w-auto">Submit
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
export default ProjectModal;