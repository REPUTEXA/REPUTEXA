import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { buildLandingChatFullSystemPrompt } from '@/config/bot-knowledge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const dynamic = 'force-dynamic';

const LANDING_CHAT_MODEL = process.env.OPENAI_LANDING_CHAT_MODEL?.trim() || 'gpt-4o';
const LANDING_CHAT_MAX_TOKENS = Math.min(
  4096,
  Math.max(512, parseInt(process.env.OPENAI_LANDING_CHAT_MAX_TOKENS ?? '2500', 10) || 2500),
);

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return apiJsonError(request, 'errors.openaiNotConfigured', 500);
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const messages = body?.messages;
    const stream = body?.stream === true;
    const userMessageCount = typeof body?.userMessageCount === 'number' ? body.userMessageCount : 0;
    const locale =
      typeof body?.locale === 'string' && (body.locale as string).length <= 10
        ? normalizeAppLocale(body.locale as string)
        : apiLocaleFromRequest(request);
    const t = createServerTranslator('Api', locale);
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: t('errors.invalidMessages') }, { status: 400 });
    }

    const systemPrompt = buildLandingChatFullSystemPrompt(t, userMessageCount, locale);

    if (stream) {
      const completionStream = await openai.chat.completions.create({
        model: LANDING_CHAT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ],
        max_tokens: LANDING_CHAT_MAX_TOKENS,
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
      model: LANDING_CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      max_tokens: LANDING_CHAT_MAX_TOKENS,
    });

    const content =
      completion.choices[0]?.message?.content ?? t('errors.landingChatFallback');
    return NextResponse.json({ message: content });
  } catch (error) {
    console.error('[api/chat]', error);
    return apiJsonError(request, 'errors.unexpectedError', 500);
  }
}
