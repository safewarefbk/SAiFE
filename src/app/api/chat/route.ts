import {NextRequest, NextResponse} from 'next/server';
import {chatWithAgent} from '@/lib/agents/chat-agent';
import {db} from '@/lib/db-service';

/**
 * POST /api/chat
 * Body: { message: string, sessionId: string }
 * Persists user + assistant messages to DB. History is loaded from DB.
 */
export async function POST(req: NextRequest) {
    try {
        const {message, sessionId} = await req.json();

        if (!message || typeof message !== 'string') {
            return NextResponse.json({error: 'message is required'}, {status: 400});
        }
        if (!sessionId || typeof sessionId !== 'string') {
            return NextResponse.json({error: 'sessionId is required'}, {status: 400});
        }

        // Save user message to DB
        await db.appendChatMessage(sessionId, 'user', message);

        // Load full conversation history from DB (excluding the message we just saved — it's already there)
        const dbHistory = await db.getChatMessages(sessionId);
        const history = dbHistory.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        }));

        // Call agent with full history (the last entry is the user message we just saved)
        const result = await chatWithAgent(message, history.slice(0, -1), sessionId);

        // Save assistant response to DB
        await db.appendChatMessage(sessionId, 'assistant', result.reply, result.totalTokens);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[Chat API Error]', error);
        return NextResponse.json(
            {error: error.message ?? 'Internal server error'},
            {status: 500},
        );
    }
}

/**
 * GET /api/chat?sessionId=xxx
 * Load chat history for a session.
 */
export async function GET(req: NextRequest) {
    try {
        const sessionId = req.nextUrl.searchParams.get('sessionId');
        if (!sessionId) {
            return NextResponse.json({error: 'sessionId is required'}, {status: 400});
        }

        const messages = await db.getChatMessages(sessionId);
        return NextResponse.json({messages});
    } catch (error: any) {
        console.error('[Chat API Error]', error);
        return NextResponse.json(
            {error: error.message ?? 'Internal server error'},
            {status: 500},
        );
    }
}
