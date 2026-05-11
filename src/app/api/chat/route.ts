import {NextRequest, NextResponse} from 'next/server';
import {buildChatMessages, getStreamingChatModel} from '@/lib/agents/chat-agent';
import {db} from '@/lib/db-service';

/**
 * POST /api/chat
 * Body: { message: string, sessionId: string }
 *
 * Returns a streaming plain-text response so the client renders tokens
 * progressively instead of waiting for the full Gemini reply (5-15 s).
 *
 * Flow:
 *  1. Validate input.
 *  2. Persist the user message.
 *  3. Load history (the entry just saved is excluded via slice).
 *  4. Open a streaming Gemini call.
 *  5. Forward each token chunk to the client while accumulating the full reply.
 *  6. After the stream closes, persist the assistant message.
 */
export async function POST(req: NextRequest) {
    let sessionId: string | undefined;
    try {
        const body = await req.json();
        const message: string = body.message;
        sessionId = body.sessionId;

        if (!message || typeof message !== 'string') {
            return NextResponse.json({error: 'message is required'}, {status: 400});
        }
        if (!sessionId || typeof sessionId !== 'string') {
            return NextResponse.json({error: 'sessionId is required'}, {status: 400});
        }

        // 1. Persist user turn before streaming starts
        await db.appendChatMessage(sessionId, 'user', message);

        // 2. Load history (the entry we just saved is last — exclude it via slice)
        const dbHistory = await db.getChatMessages(sessionId);
        const history = dbHistory
            .slice(0, -1)
            .map(m => ({role: m.role as 'user' | 'assistant', content: m.content}));

        // 3. Build LangChain message list and get streaming model
        const lcMessages = buildChatMessages(message, history);
        const model = getStreamingChatModel(sessionId);

        // 4. Open Gemini stream
        const geminiStream = await model.stream(lcMessages);

        // 5. Build a ReadableStream that forwards tokens to the browser
        const encoder = new TextEncoder();
        let fullReply = '';
        let totalTokens: number | null = null;
        const sid = sessionId; // capture for closure

        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of geminiStream) {
                        const text = typeof chunk.content === 'string' ? chunk.content : '';
                        if (text) {
                            fullReply += text;
                            controller.enqueue(encoder.encode(text));
                        }
                        // Capture token usage from the last chunk's metadata if available
                        const usage = (chunk as any).usage_metadata ?? (chunk as any).usageMetadata;
                        if (usage?.total_tokens) totalTokens = usage.total_tokens;
                    }
                } finally {
                    controller.close();
                    // 6. Persist assistant turn after stream completes
                    db.appendChatMessage(sid, 'assistant', fullReply, totalTokens).catch(
                        err => console.error('[Chat API] Failed to persist assistant message:', err),
                    );
                }
            },
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Content-Type-Options': 'nosniff',
                // Prevent Caddy / nginx from buffering the stream
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
            },
        });

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
