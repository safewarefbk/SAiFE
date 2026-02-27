# SAiFE

## Architecture

Client-server Next.js application with Prisma/SQLite persistence and LLM-powered diagram & code generation.

### Database Schema
- **Session** — user sessions (identifier, project description, language)
- **Node** — graph nodes (position, shape, contents, collapse state, code FK)
- **Edge** — graph edges (source, target, style)
- **Code** — generated code snippets (code, prompt, language, validation state)
- **DiagramHistory** — LLM conversation history for session continuity


### API Endpoints

**LLM**
- `POST /api/llm/diagram/generate` — generate initial diagram from description
- `POST /api/llm/diagram/task` — generate sub-diagram for a task
- `POST /api/llm/code/generate` — generate code for a task node
- `POST /api/llm/code/regenerate` — refine existing code with new instructions
- `POST /api/llm/code/aggregate` — aggregate child code into a parent/root node

**Session**
- `POST /api/session/create` — create or update a session
- `POST /api/session/load` — load session data and reconstruct graph
- `GET  /api/session/list` — list all session identifiers
- `POST /api/session/check` — check if a session exists
- `POST /api/session/save-graph` — save nodes and edges to DB
- `POST /api/session/save-code` — save generated code to DB
- `POST /api/session/validate-code` — set code validation state

