# SAiFE

**SAiFE** is a web tool for LLM-assisted goal modeling and incremental code generation. Users decompose a software project into a goal model (a hierarchical diagram of goals, sub-goals, and tasks), then generate code for each task. Code can be refined and aggregated bottom-up into a complete implementation.

---

## How it works

1. **Start a session** — provide a project name, a description (for the diagram LLM) and technical requirements (language, frameworks — for the code LLM).
2. **Generate a goal model** — the LLM produces a diagram with goals (circles), tasks (hexagons), and AND connectors (capsules).
3. **Expand tasks** — click any task to decompose it further into a sub-goal tree, optionally guiding the LLM with an extra prompt.
4. **Generate code** — generate code for any leaf task. Code can be edited directly, regenerated with instructions, or deleted.
5. **Aggregate** — once child tasks have validated code, aggregate them into the parent goal — recursively up to the root.
6. **Comparison Test** — generate a full one-shot implementation from the menu for comparison against the incremental approach.
7. **Save** — changes are persisted only on explicit save (Ctrl+S or the Save button in the menu).

---

## API Endpoints

All routes live under `src/app/api/`.

### `/api/llm/` — LLM operations (server-side, call the LLM)

| Method | Path | What it does |
|---|---|---|
| POST | `/api/llm/diagram/generate` | Generate the initial goal model from a project description |
| POST | `/api/llm/diagram/task` | Expand a task node into a sub-diagram (multi-turn, uses full conversation history) |
| POST | `/api/llm/code/generate` | Generate code for a leaf task node |
| POST | `/api/llm/code/regenerate` | Revise existing code with an additional instruction |
| POST | `/api/llm/code/aggregate` | Merge children's code into a goal-level implementation |

### `/api/session/` — Session & persistence (server-side, talk to the DB)

| Method | Path | What it does |
|---|---|---|
| POST/PUT | `/api/session/create` | Create a new session or update its metadata |
| GET | `/api/session/check` | Check whether a session identifier already exists |
| GET | `/api/session/list` | List all visible sessions |
| POST | `/api/session/load` | Load a full session from the DB (nodes, edges, code, history) and reconstruct the graph |
| POST | `/api/session/save-graph` | Persist nodes and edges to the DB |
| POST | `/api/session/save-code` | Persist generated/edited code for a node |
| POST | `/api/session/validate-code` | Toggle the validation status of a node's code |
| POST | `/api/session/delete-code` | Remove the code associated with a node |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Entry point
│   ├── layout.tsx        # Root HTML layout
│   └── api/              # Next.js API routes (see above)
│       ├── llm/          # LLM endpoints
│       └── session/      # Session & persistence endpoints
│
├── components/           # All UI components
│   ├── DiagramFrame.tsx  # Main orchestrator — wires everything together
│   ├── SessionModal/     # Session picker shown on startup
│   ├── ProjectModal/     # New project input form
│   ├── CodeModal/        # Code viewer/editor (Monaco)
│   ├── Menu.tsx          # Top-right dropdown menu
│   ├── Sidebar/          # Left sidebar to drag shapes onto the canvas
│   ├── Toolbar/          # Per-node toolbar (delete)
│   ├── EdgeToolbar/      # Per-edge toolbar (delete, solid/dotted)
│   ├── shape-node/       # React Flow custom node renderer
│   ├── shape/            # SVG shape primitives (circle, hexagon, capsule…)
│   └── edges/            # Custom editable edge with label
│
├── hooks/                # React hooks
│   ├── useDiagram.tsx    # React Flow event handlers + JSON upload
│   ├── useUndoRedo.tsx   # Undo/redo history (Zustand-backed)
│   ├── useTheme.tsx      # Dark/light mode
│   └── ...
│
├── lib/                  # Core logic (no UI)
│   ├── db-service.ts     # All database queries (Prisma)
│   ├── prisma.ts         # Prisma client singleton
│   ├── json-reconstruction.ts   # DB rows → React Flow JSON
│   ├── subgraph-integration.ts  # Merge a sub-diagram into the main canvas
│   ├── tree-layout.ts    # Reingold-Tilford layout algorithm
│   ├── collision-detection.ts   # Prevent overlapping on expand
│   ├── utils.tsx         # Colors, token logging, graph traversal helpers
│   └── agents/           # LLM agents and model pool
│       ├── agents.ts     # Model factories + system prompts
│       ├── models-pool.ts # API key pool, per-session deterministic key assignment
│       ├── diagram-agent.ts
│       └── code-agent.ts
│
├── services/             # Client-side fetch wrappers for API calls
│   ├── llm-operations.ts
│   └── session-management.ts
│
└── store/
    └── store.ts          # Zustand global store

prisma/
├── schema.prisma         # DB schema (Session, Node, Edge, Code, DiagramHistory)
├── prisma.config.ts      # Prisma configuration (no migrations during development)
└── scripts/              # Admin utilities: list, copy, delete, hide sessions
```

---

## Installation

### Option A — Local (Node.js / npm required)

**Prerequisites:** Node.js ≥ 18, npm, a running PostgreSQL instance.

```bash
# 1. Clone the repository
git clone <repo-url>
cd SAiFE

# 2. Configure environment
cp .env.example .env
# Edit .env: set POSTGRES_USER, POSTGRES_PASSWORD, DATABASE_URL, GEMINI_API_KEY

# 3. Install dependencies
npm install

# 4. Push the database schema
npx prisma db push

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### Option B — Docker (no local Node.js needed)

**Prerequisites:** Docker and Docker Compose.

```bash
# 1. Clone the repository
git clone <repo-url>
cd SAiFE

# 2. Configure environment
cp .env.example .env
# Edit .env: set POSTGRES_USER, POSTGRES_PASSWORD, GEMINI_API_KEY (or GEMINI_API_KEYS)

# 3. Build the image and start all services
docker compose up --build
```

The app will be available at [http://localhost:3000](http://localhost:3000) (or HTTPS on port 443 if Caddy is configured).

To stop: `docker compose down`  
To stop and remove all data: `docker compose down -v`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_USER` | ✓ | PostgreSQL username |
| `POSTGRES_PASSWORD` | ✓ | PostgreSQL password |
| `DATABASE_URL` | Local only | Full connection string (computed from above in Docker) |
| `GEMINI_API_KEY` | ✓ (or KEYS) | Single Gemini API key |
| `GEMINI_API_KEYS` | Optional | Comma-separated keys for load distribution (recommended for demos) |
