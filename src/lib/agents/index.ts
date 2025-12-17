/**
 * LangChain-based agents for diagram and code generation
 *
 * Key design:
 * - Session-based: server keeps state, client only sends sessionId + minimal data
 * - No unnecessary dependencies (no zod)
 * - Simple, clean implementation
 */

export { diagramAgent, DiagramAgent } from './diagram-agent';
export { codeAgent, CodeAgent } from './code-agent';
export { sessionStore } from './session-store';

