import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { buildInvestorMetricsChatContext } from '@/lib/admin/investor-metrics-chat-context';
import type { InvestorMetricsPayload } from '@/lib/admin/investor-metrics';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_USER_CHARS = 8000;
const MAX_HISTORY = 12;

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: ta('forbidden') }, { status: 403 }) };
  }
  return { user } as const;
}

/**
 * POST — chat FP&A contextualisé sur le dernier agrégat métriques (non audité).
 */
export async function POST(request: Request) {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const ta = apiAdminT();

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ error: ta('openaiKeyMissing') }, { status: 503 });
  }

  const raw = await request.json().catch(() => ({}));
  const body = raw as {
    messages?: { role: string; content: string }[];
    metrics?: InvestorMetricsPayload;
  };

  const metrics = body.metrics;
  if (!metrics || typeof metrics.generatedAt !== 'string') {
    return NextResponse.json({ error: ta('investorMetricsMetricsRequired') }, { status: 400 });
  }

  const history = (body.messages ?? []).filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  ) as { role: 'user' | 'assistant'; content: string }[];

  const trimmed = history.slice(-MAX_HISTORY).map((m) => ({
    ...m,
    content: m.content.slice(0, MAX_USER_CHARS),
  }));

  const lastUser = [...trimmed].reverse().find((m) => m.role === 'user');
  if (!lastUser) {
    return NextResponse.json({ error: ta('investorMetricsChatUserMessageMissing') }, { status: 400 });
  }

  const context = buildInvestorMetricsChatContext(metrics);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const system = `Tu es un directeur / associé FP&A senior ( français ), pour un comité restreint REPUTEXA.
Tu disposes d’un dossier structuré ci-dessous : MRR, trésorerie Stripe, historique mensuel des factures payées (plusieurs années si Stripe remonte assez loin dans la pagination), mix plans, cohortes courtes et longues, rentabilité estimée par client (prorata MRR), burn vs growth, textes Executive Summary.

Règles strictes :
- Tous les chiffres, pourcentages et dates doivent provenir du dossier. Aucun montant inventé ni « approximatif » sans l’indiquer.
- Si une période ou une donnée n’apparaît pas dans le dossier, dis-le et propose quoi collecter — ne devine pas.
- Croise volontiers MRR, encaissements historiques, cohortes et marges estimées pour une lecture type due diligence interne.
- Style : analyse argumentée, sous-titres courts, puces, ton cabinet de conseil (clair, tranché), sans remplissage.
- Une phrase de cadre : chiffres indicatifs / non audités, pas de décision automatique exécutée sur la base de ce chat.

DOSSIER :
${context}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.35,
      max_tokens: 2800,
      messages: [
        { role: 'system', content: system },
        ...trimmed.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!reply) {
      return NextResponse.json({ error: ta('investorMetricsChatEmptyReply') }, { status: 502 });
    }
    return NextResponse.json({ reply });
  } catch (e) {
    console.error('[admin/investor-metrics/chat]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('investorMetricsChatUnavailable') },
      { status: 502 }
    );
  }
}
