import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { mergeDraftMessages, transcreateMessageChunk } from '@/lib/babel/transcreate-chunk';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const startSchema = z.object({
  action: z.literal('start'),
  localeCode: z.string().min(2).max(8).transform((s) => s.toLowerCase().trim()),
  targetLabel: z.string().min(2).max(80).optional(),
  batchSize: z.number().int().min(1).max(5).optional(),
});

const continueSchema = z.object({
  action: z.literal('continue'),
  draftId: z.string().uuid(),
});

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: ta('forbidden') }, { status: 403 }) };
  return { user };
}

async function loadFrMessages(): Promise<Record<string, unknown>> {
  const p = path.join(process.cwd(), 'messages', 'fr.json');
  const raw = await readFile(p, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * POST /api/admin/babel-expansion-draft
 * - { action: 'start', localeCode, targetLabel?, batchSize? } : premier lot
 * - { action: 'continue', draftId } : lots suivants
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: ta('openaiKeyMissing') }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const asStart = startSchema.safeParse(body);
  const asCont = continueSchema.safeParse(body);
  if (!asStart.success && !asCont.success) {
    return NextResponse.json(
      {
        error: ta('payloadInvalid'),
        details: asStart.success ? asCont.error.flatten() : asStart.error.flatten(),
      },
      { status: 400 }
    );
  }

  const openai = new OpenAI({ apiKey });

  try {
    if (asCont.success) {
      return runBatch(asCont.data.draftId, openai, auth.user.id);
    }

    if (!asStart.success) {
      return NextResponse.json({ error: ta('payloadInvalid') }, { status: 400 });
    }
    const { localeCode, targetLabel, batchSize = 2 } = asStart.data;
    const fr = await loadFrMessages();
    const allKeys = Object.keys(fr).sort();

    const draft = await prisma.babelExpansionDraft.create({
      data: {
        localeCode,
        targetLabel: targetLabel ?? localeCode.toUpperCase(),
        status: 'processing',
        messagesJson: {},
        topLevelKeysDone: [],
        createdById: auth.user.id,
      },
    });

    return runBatchForDraft(draft.id, fr, allKeys, openai, localeCode, targetLabel ?? localeCode, batchSize);
  } catch (e) {
    console.error('[babel-expansion-draft]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('babelExpansionGenerationFailed') },
      { status: 500 }
    );
  }
}

async function runBatch(draftId: string, openai: OpenAI, userId: string) {
  const ta = apiAdminT();
  const draft = await prisma.babelExpansionDraft.findUnique({ where: { id: draftId } });
  if (!draft) return NextResponse.json({ error: ta('draftNotFound') }, { status: 404 });
  if (draft.createdById != null && draft.createdById !== userId) {
    return NextResponse.json({ error: ta('accessDenied') }, { status: 403 });
  }

  const fr = await loadFrMessages();
  const allKeys = Object.keys(fr).sort();
  return runBatchForDraft(
    draft.id,
    fr,
    allKeys,
    openai,
    draft.localeCode,
    draft.targetLabel ?? draft.localeCode,
    2
  );
}

async function runBatchForDraft(
  draftId: string,
  fr: Record<string, unknown>,
  allKeys: string[],
  openai: OpenAI,
  localeCode: string,
  targetLabel: string,
  batchSize: number
) {
  const ta = apiAdminT();
  const draft = await prisma.babelExpansionDraft.findUnique({ where: { id: draftId } });
  if (!draft) return NextResponse.json({ error: ta('draftNotFound') }, { status: 404 });

  const done = new Set(draft.topLevelKeysDone);
  const pending = allKeys.filter((k) => !done.has(k));
  if (pending.length === 0) {
    await prisma.babelExpansionDraft.update({
      where: { id: draftId },
      data: { status: 'ready', errorMessage: null },
    });
    return NextResponse.json({
      ok: true,
      draftId,
      status: 'ready',
      progress: { total: allKeys.length, done: allKeys.length },
      message: ta('babelExpansionAllKeysDoneMessage'),
    });
  }

  let batch = pending.slice(0, batchSize);
  let chunk: Record<string, unknown> = {};
  for (const k of batch) {
    chunk[k] = fr[k];
  }
  while (JSON.stringify(chunk).length > 120_000 && batch.length > 1) {
    batch = batch.slice(0, batch.length - 1);
    chunk = {};
    for (const k of batch) {
      chunk[k] = fr[k];
    }
  }

  try {
    const translated = await transcreateMessageChunk({
      openai,
      targetLocaleCode: localeCode,
      targetLabel,
      chunk,
    });

    const current = (draft.messagesJson as Record<string, unknown>) ?? {};
    const merged = mergeDraftMessages(current, translated);
    const newDone = [...draft.topLevelKeysDone, ...batch];
    const allDone = newDone.length >= allKeys.length;

    await prisma.babelExpansionDraft.update({
      where: { id: draftId },
      data: {
        messagesJson: merged as object,
        topLevelKeysDone: newDone,
        status: allDone ? 'ready' : 'processing',
        errorMessage: null,
      },
    });

    return NextResponse.json({
      ok: true,
      draftId,
      status: allDone ? 'ready' : 'processing',
      progress: { total: allKeys.length, done: newDone.length, lastBatch: batch },
      message: allDone
        ? ta('babelExpansionDoneDownloadMessage')
        : ta('babelExpansionBatchMessage', { batches: batch.join(', ') }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.babelExpansionDraft.update({
      where: { id: draftId },
      data: { status: 'error', errorMessage: msg },
    });
    return NextResponse.json({ error: msg, draftId }, { status: 500 });
  }
}

/**
 * GET /api/admin/babel-expansion-draft?id=uuid
 * GET /api/admin/babel-expansion-draft — liste récente
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  const id = request.nextUrl.searchParams.get('id')?.trim();
  try {
    if (id) {
      const draft = await prisma.babelExpansionDraft.findUnique({ where: { id } });
      if (!draft) return NextResponse.json({ error: ta('notFound') }, { status: 404 });
      return NextResponse.json({
        draft: {
          id: draft.id,
          localeCode: draft.localeCode,
          targetLabel: draft.targetLabel,
          status: draft.status,
          topLevelKeysDone: draft.topLevelKeysDone,
          errorMessage: draft.errorMessage,
          messagesJson: draft.messagesJson,
          createdAt: draft.createdAt.toISOString(),
          updatedAt: draft.updatedAt.toISOString(),
        },
      });
    }

    const list = await prisma.babelExpansionDraft.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        localeCode: true,
        targetLabel: true,
        status: true,
        topLevelKeysDone: true,
        createdAt: true,
        updatedAt: true,
        errorMessage: true,
      },
    });
    return NextResponse.json({ drafts: list });
  } catch (e) {
    console.error('[babel-expansion-draft GET]', e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : ta('babelExpansionTableMissing'),
      },
      { status: 503 }
    );
  }
}
