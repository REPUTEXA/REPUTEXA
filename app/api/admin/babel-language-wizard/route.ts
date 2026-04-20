import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getBabelWizardSessionDelegate } from '@/lib/prisma/babel-wizard-session-delegate';
import type { BabelWizardState } from '@/lib/babel/babel-wizard-types';
import { generateWizardStepContent } from '@/lib/babel/babel-wizard-generate';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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

const saveSchema = z.object({
  action: z.literal('save'),
  id: z.string().uuid().optional(),
  title: z.string().max(120).optional(),
  state: z.custom<BabelWizardState>(),
});

const generateSchema = z.object({
  action: z.literal('generate'),
  stepId: z.enum(['catalog', 'serverPack', 'signup', 'seo']),
  localeCode: z.string().min(2).max(12),
  targetLabel: z.string().min(2).max(80),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  const id = request.nextUrl.searchParams.get('id')?.trim();
  try {
    const wizard = getBabelWizardSessionDelegate();
    if (id) {
      const row = await wizard.findUnique({ where: { id } });
      if (!row) return NextResponse.json({ error: ta('notFound') }, { status: 404 });
      return NextResponse.json({
        session: {
          id: row.id,
          title: row.title,
          state: row.stateJson as unknown as BabelWizardState,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
      });
    }

    const list = await wizard.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ sessions: list });
  } catch (e) {
    console.error('[babel-language-wizard GET]', e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : ta('babelWizardTableMissing'),
      },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const asSave = saveSchema.safeParse(body);
  if (asSave.success) {
    let wizard;
    try {
      wizard = getBabelWizardSessionDelegate();
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : ta('prismaWizardUnavailable') },
        { status: 503 }
      );
    }
    try {
      const { id, title, state } = asSave.data;
      if (id) {
        const updated = await wizard.update({
          where: { id },
          data: {
            title: title ?? undefined,
            stateJson: state as object,
          },
        });
        return NextResponse.json({
          ok: true,
          id: updated.id,
          updatedAt: updated.updatedAt.toISOString(),
        });
      }
      const created = await wizard.create({
        data: {
          title: title ?? `${state.localeCode} — ${state.targetLabel}`,
          stateJson: state as object,
          createdById: auth.user.id,
        },
      });
      return NextResponse.json({
        ok: true,
        id: created.id,
        createdAt: created.createdAt.toISOString(),
      });
    } catch (e) {
      console.error('[babel-language-wizard save]', e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : ta('babelSaveFailed') },
        { status: 503 }
      );
    }
  }

  const asDelete = z.object({ action: z.literal('delete'), id: z.string().uuid() }).safeParse(body);
  if (asDelete.success) {
    try {
      const wizard = getBabelWizardSessionDelegate();
      await wizard.delete({ where: { id: asDelete.data.id } });
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('Prisma') || msg.includes('obsolète')) {
        return NextResponse.json({ error: msg }, { status: 503 });
      }
      return NextResponse.json({ error: ta('deleteFailed') }, { status: 400 });
    }
  }

  const asGen = generateSchema.safeParse(body);
  if (asGen.success) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: ta('openaiKeyMissing') }, { status: 503 });
    }
    const openai = new OpenAI({ apiKey });
    try {
      const { stepId, localeCode, targetLabel } = asGen.data;
      const out = await generateWizardStepContent({
        openai,
        stepId,
        localeCode: localeCode.toLowerCase().trim(),
        targetLabel: targetLabel.trim(),
      });
      return NextResponse.json({
        ok: true,
        content: out.content,
        notes: out.notes ?? null,
      });
    } catch (e) {
      console.error('[babel-language-wizard generate]', e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : ta('babelGenerationFailed') },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: ta('payloadInvalid') }, { status: 400 });
}
