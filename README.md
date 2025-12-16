# SAiFE 
## Architecture

The application uses a client-server architecture

### API Endpoints

- `POST /api/llm/diagram/generate`: Generates the initial diagram from a description.
- `POST /api/llm/diagram/task`: Generates a sub-diagram for a specific task.
- `POST /api/llm/code/generate`: Generates code for a single task.
- `POST /api/llm/code/regenerate`: Refines existing code based on new instructions.
- `POST /api/llm/code/aggregate`: Aggregates code from child nodes into a parent node or the root.

