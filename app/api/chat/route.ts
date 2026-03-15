import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { SYSTEM_PROMPT_BASE, LEAD_CAPTURE_INSTRUCTION } from '@/config/bot-knowledge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const dynamic = 'force-dynamic';

function buildSystemPrompt(userMessageCount: number): string {
  let prompt = SYSTEM_PROMPT_BASE;
  if (userMessageCount >= 3) {
    prompt += '\n\n' + LEAD_CAPTURE_INSTRUCTION;
  }
  return prompt;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const messages = body?.messages;
    const stream = body?.stream === true;
    const userMessageCount = typeof body?.userMessageCount === 'number' ? body.userMessageCount : 0;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(userMessageCount);

    if (stream) {
      const completionStream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ],
        max_tokens: 400,
        stream: true,
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of completionStream) {
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) {
                controller.enqueue(encoder.encode(delta));
              }
            }
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      max_tokens: 400,
    });

    const content = completion.choices[0]?.message?.content ?? 'Désolé, une erreur est survenue.';
    return NextResponse.json({ message: content });
  } catch (error) {
    console.error('[api/chat]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
