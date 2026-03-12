/**
 * Gemini API key pool and model instance management.
 *
 * KEY POOL
 * --------
 * One ChatGoogleGenerativeAI instance is created per API key at first use and
 * then reused for every subsequent request — no per-call allocation.
 *
 * Separate pools are maintained for the "Pro" and "Flash" model tiers so
 * they can be upgraded/downgraded independently.
 *
 * KEY ASSIGNMENT
 * --------------
 * Each session is deterministically mapped to a key via:
 *   pool[ hash(sessionId) % pool.length ]
 * Guarantees:
 *   • All requests within the same session always use the same key (consistent).
 *   • Different sessions spread evenly across keys (balanced load).
 *   • No DB or in-memory state needed to track the assignment.
 *
 * CONFIG (.env)
 * -------------
 *   GEMINI_API_KEYS=key1,key2,key3   ← multiple keys (recommended)
 *   GEMINI_API_KEY=key1              ← single key fallback (legacy)
 *
 * SECURITY NOTE
 * -------------
 * Keys are injected at container start-time via environment variables.
 * They are NEVER baked into the Docker image — publishing the image is safe.
 *
 * KEY ROTATION
 * ------------
 * Update GEMINI_API_KEYS in .env and restart the container.
 * The pools are lazily re-created on the first request after restart.
 */

import {ChatGoogleGenerativeAI} from "@langchain/google-genai";

const PRO_MODEL_NAME   = "gemini-3-flash-preview"; // temporarily using flash for dev/debug, should be gemini-3.1-pro-preview
const FLASH_MODEL_NAME = "gemini-3-flash-preview";

// In-memory pools of model instances. Lazily initialized on first access.
let _proPool:   ChatGoogleGenerativeAI[] | null = null;
let _flashPool: ChatGoogleGenerativeAI[] | null = null;

// Round-robin index — fallback when no sessionId is provided.
let _rrIndex = 0;


function loadApiKeys(): string[] {
    const multi = process.env.GEMINI_API_KEYS;
    if (multi) {
        const keys = multi.split(",").map(k => k.trim()).filter(Boolean);
        if (keys.length > 0) return keys;
    }
    const single = process.env.GEMINI_API_KEY;
    if (single?.trim()) return [single.trim()];
    throw new Error(
        "No Gemini API key configured. Set GEMINI_API_KEYS (comma-separated) or GEMINI_API_KEY."
    );
}


// Initialize and/or return the Pro-tier model instances. The list size depends on the number of API keys configured.
function getProPool(): ChatGoogleGenerativeAI[] {
    if (!_proPool) {
        _proPool = loadApiKeys().map(key => new ChatGoogleGenerativeAI({
            model: PRO_MODEL_NAME,
            apiKey: key,
        }));
    }
    return _proPool;
}

/** Initialize and/or return the list of Flash-tier model instances. The list size depends on the number of API keys configured. */
function getFlashPool(): ChatGoogleGenerativeAI[] {
    if (!_flashPool) {
        _flashPool = loadApiKeys().map(key => new ChatGoogleGenerativeAI({
            model: FLASH_MODEL_NAME,
            apiKey: key,
        }));
    }
    return _flashPool;
}

// djb2-style hash — stable, positive integer for any string.
function hashSessionId(sessionId: string): number {
    let hash = 5381;
    for (let i = 0; i < sessionId.length; i++) {
        hash = ((hash << 5) + hash) ^ sessionId.charCodeAt(i);
    }
    return Math.abs(hash >>> 0); // unsigned 32-bit
}

function pickFromPool(
    pool: ChatGoogleGenerativeAI[],
    sessionId?: string,
): ChatGoogleGenerativeAI {
    if (sessionId) {
        return pool[hashSessionId(sessionId) % pool.length];
    }
    // Anonymous / fallback — round-robin
    const instance = pool[_rrIndex];
    _rrIndex = (_rrIndex + 1) % pool.length;
    return instance;
}

/**
 * Return the Pro-tier model instance assigned to this session.
 * The same sessionId always returns the same instance (deterministic).
 */
export function getGeminiProModel(sessionId?: string): ChatGoogleGenerativeAI {
    return pickFromPool(getProPool(), sessionId);
}

/**
 * Return the Flash-tier model instance assigned to this session.
 * The same sessionId always returns the same instance (deterministic).
 */
export function getGeminiFlashModel(sessionId?: string): ChatGoogleGenerativeAI {
    return pickFromPool(getFlashPool(), sessionId);
}

