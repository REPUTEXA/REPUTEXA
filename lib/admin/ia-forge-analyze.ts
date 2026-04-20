import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IaForgeAgentKey } from '@/lib/admin/ia-forge-constants';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type AnalyzeResult = {
  snippets: { agent_key: IaForgeAgentKey; body: string }[];
  crossLearn: { pattern: string; notes: string }[];
  summary: string;
};

function parseAnalyzeJson(raw: string): AnalyzeResult {
  try {
    const j = JSON.parse(raw) as {
      snippets?: { agent_key?: string; body?: string }[];
      cross_learn?: { pattern?: string; notes?: string }[];
      summary?: string;
    };
    const validAgents: IaForgeAgentKey[] = [
      'reputexa_core',
      'babel',
      'nexus',
      'sentinel',
      'guardian',
    ];
    const snippets = (j.snippets ?? [])
      .filter(
        (s): s is { agent_key: IaForgeAgentKey; body: string } =>
          typeof s.body === 'string' &&
          s.body.length > 10 &&
          typeof s.agent_key === 'string' &&
          (validAgents as string[]).includes(s.agent_key)
      )
      .slice(0, 24);
    const crossLearn = (j.cross_learn ?? [])
      .filter(
        (c): c is { pattern: string; notes: string } =>
          typeof c.pattern === 'string' && c.pattern.length > 3 && typeof c.notes === 'string'
      )
      .slice(0, 20);
    return {
      snippets,
      crossLearn,
      summary: typeof j.summary === 'string' ? j.summary.slice(0, 4000) : '',
    };
  } catch {
    return { snippets: [], crossLearn: [], summary: '' };
  }
}

/**
 * Agrège des extraits réels (avis, audits) et produit des « snippets » de consigne + patterns cross-NEGO-GUARD.
 */
export async function runIaForgeAnalysis(
  admin: SupabaseClient,
  opts: { depth: 'batch' | 'deep'; extraCorpus?: string }
): Promise<{ insertedSnippets: number; crossInserted: number }> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OPENAI_API_KEY manquant');
  }

  const { data: reviewRows } = await admin
    .from('reviews')
    .select('rating, comment, ai_response, response_text, source')
    .eq('status', 'published')
    .not('ai_response', 'is', null)
    .order('created_at', { ascending: false })
    .limit(opts.depth === 'deep' ? 120 : 60);

  const reviewsBlock = (reviewRows ?? [])
    .map(
      (r, i) =>
        `[${i + 1}] note=${r.rating} src=${r.source ?? '?'} avis="${String(r.comment).slice(0, 220)}" IA="${String(r.ai_response).slice(0, 280)}" pub="${String(r.response_text ?? '').slice(0, 200)}"`
    )
    .join('\n');

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const { data: auditRows } = await admin
    .from('support_audit_log')
    .select('action_type, confidence_score, created_at')
    .gte('created_at', since.toISOString())
    .limit(40);

  const auditBlock = (auditRows ?? [])
    .map(
      (a, i) =>
        `[${i + 1}] ${a.action_type} conf=${a.confidence_score ?? '—'} @${String(a.created_at).slice(0, 19)}`
    )
    .join('\n');

  const corpus =
    opts.extraCorpus && opts.extraCorpus.trim().length > 0
      ? opts.extraCorpus.trim().slice(0, 24_000)
      : '';

  const userContent = `Tu es le meta-optimiseur de prompts pour la plateforme REPUTEXA (e-réputation, support Nexus, prospection Babel, correctifs Sentinel, conformité Guardian).
Tâche : à partir des échantillons RÉELS ci-dessous, produis des extraits courts (snippets) réutilisables dans des system prompts — pas du JSON d'exemple, du texte opérationnel actionnable.
Profondeur : ${opts.depth === 'deep' ? 'Deep-Dive (priorité négociation / objections / ton)' : 'Batch hebdo (tendances langage, pièges fréquents)'}.

Échantillon avis publiés :
${reviewsBlock || '(aucun)'}

Échantillon audits support (14j) :
${auditBlock || '(aucun)'}

${corpus ? `Corpus additionnel (extrait) :\n${corpus}\n` : ''}

Réponds UNIQUEMENT en JSON :
{
  "summary": "2-4 phrases en français sur les axes d'amélioration prioritaires",
  "snippets": [
    { "agent_key": "reputexa_core", "body": "…" },
    { "agent_key": "nexus", "body": "…" }
  ],
  "cross_learn": [
    { "pattern": "objection ou situation client récurrente", "notes": "comment NEGO-GUARD / commercial peut la retourner (1-2 phrases)" }
  ]
}

Contraintes :
- agent_key ∈ reputexa_core | babel | nexus | sentinel | guardian
- 4 à 12 snippets au total, chaque body 120-600 caractères, français professionnel
- 2 à 8 entrées cross_learn (transfert objections REPUTEXA/support → négociation)
- Pas de markdown dans le JSON, échappe les guillemets dans les chaînes`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.35,
    max_tokens: opts.depth === 'deep' ? 4096 : 2500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Tu produis uniquement du JSON valide conforme au schéma demandé. Français. Aucun texte hors JSON.',
      },
      { role: 'user', content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = parseAnalyzeJson(raw);

  let insertedSnippets = 0;
  for (const s of parsed.snippets) {
    const { error } = await admin.from('ia_forge_snippet').insert({
      agent_key: s.agent_key,
      body: s.body,
      source: 'analysis',
    });
    if (!error) insertedSnippets += 1;
  }

  let crossInserted = 0;
  for (const c of parsed.crossLearn) {
    const { error } = await admin.from('ia_forge_cross_learn').insert({
      source_agent: 'reputexa_core',
      target_agent: 'negoguard',
      pattern: c.pattern,
      notes: c.notes,
    });
    if (!error) crossInserted += 1;
  }

  if (parsed.summary) {
    await admin.from('ia_forge_context_store').upsert({
      key: 'forge_last_analysis_summary',
      content: parsed.summary,
      updated_at: new Date().toISOString(),
    });
  }

  return { insertedSnippets, crossInserted };
}
