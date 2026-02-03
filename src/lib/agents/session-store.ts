/**
 * Simple server-side session store for conversation state
 *  Use a DB, (we should also clean up sessions)
 */

interface SessionData {
    history: Array<{ role: string; parts: Array<{ text: string }> }>;
    projectDescription?: string;
    language?: string;
    createdAt: number;
    lastAccess: number;
}

class SessionStore {
    private sessions: Map<string, SessionData> = new Map();

    generateId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    create(initialData?: Partial<SessionData>): string {
        const id = this.generateId();
        const now = Date.now();
        this.sessions.set(id, {
            history: [],
            createdAt: now,
            lastAccess: now,
            ...initialData
        });
        return id;
    }

    get(id: string): SessionData | null {
        const session = this.sessions.get(id);
        if (session) {
            session.lastAccess = Date.now();
            return session;
        }
        return null;
    }

    update(id: string, data: Partial<SessionData>): boolean {
        const session = this.sessions.get(id);
        if (session) {
            Object.assign(session, data, {lastAccess: Date.now()});
            return true;
        }
        return false;
    }

    appendHistory(id: string, role: string, text: string): boolean {
        const session = this.sessions.get(id);
        if (session) {
            session.history.push({role, parts: [{text}]});
            session.lastAccess = Date.now();
            return true;
        }
        return false;
    }

    delete(id: string): boolean {
        return this.sessions.delete(id);
    }
}

// Singleton instance
export const sessionStore = new SessionStore();

