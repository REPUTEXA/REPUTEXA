/**
 * Injection Forge : snippets + contexte froid, pour enrichir les prompts système.
 * Échoue silencieusement si tables absentes ou service role indisponible.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { IaForgeAgentKey } from '@/lib/admin/ia-forge-constants';

const DEFAULT_KEYS = ['forge_last_analysis_summary', 'babel_email_subject_active', 'babel_pitch_addon'] as const;

function normalizeHint(hint: string): string {
  return hint
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();
}

function scoreSnippetRelevance(body: string, hintTokens: Set<string>): number {
  if (hintTokens.size === 0) return 0;
  const t = normalizeHint(body);
  let n = 0;
  for (const tok of hintTokens) {
    if (tok.length > 2 && t.includes(tok)) n += 1;
  }
  return n;
}

export type ForgeKnowledgeOptions = {
  agentKeys: IaForgeAgentKey[];
  queryHint?: string;
  maxSnippets?: number;
  contextKeys?: string[];
};

/**
 * Retourne un bloc texte à ajouter au prompt (vide si indisponible).
 */
export async function loadForgeKnowledgeBlock(opts: ForgeKnowledgeOptions): Promise<string> {
  if (process.env.FORGE_INJECTION_ENABLED === '0') return '';

  const admin = createAdminClient();
  if (!admin) return '';

  const maxSnippets = Math.min(24, Math.max(4, opts.maxSnippets ?? 12));
  const agents = opts.agentKeys.length ? opts.agentKeys : (['reputexa_core'] as IaForgeAgentKey[]);
  const hintRaw = normalizeHint(opts.queryHint ?? '');
  const hintTokens = new Set(
    hintRaw
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 12)
  );

  try {
    const { data: snippets, error: sErr } = await admin
      .from('ia_forge_snippet')
      .select('agent_key, body, source, created_at')
      .in('agent_key', agents)
      .order('created_at', { ascending: false })
      .limit(80);

    if (sErr || !snippets?.length) {
      if (sErr && !String(sErr.message).includes('does not exist')) {
        console.warn('[forge-hook] snippets', sErr.message);
      }
    }

    let ranked = (snippets ?? []).map((s) => ({
      ...s,
      _score: scoreSnippetRelevance(String(s.body ?? ''), hintTokens),
    }));
    ranked.sort((a, b) => b._score - a._score || String(b.created_at).localeCompare(String(a.created_at)));
    ranked = ranked.slice(0, maxSnippets);

    const ctxKeys = opts.contextKeys ?? [...DEFAULT_KEYS];
    const { data: ctxRows } = await admin
      .from('ia_forge_context_store')
      .select('key, content')
      .in('key', ctxKeys);

    const parts: string[] = [];
    parts.push('── MÉMOIRE FORGE (extraits validés / RLHF / analyse) — appliquer sans copier mot pour mot ──');

    for (const row of ranked) {
      const line = String(row.body ?? '').trim().replace(/\s+/g, ' ');
      if (line.length < 8) continue;
      parts.push(`• [${row.agent_key}/${row.source}] ${line.slice(0, 900)}${line.length > 900 ? '…' : ''}`);
    }

    for (const r of ctxRows ?? []) {
      const k = String(r.key);
      const c = String(r.content ?? '').trim();
      if (!c) continue;
      parts.push(`• [contexte:${k}] ${c.slice(0, 1200)}${c.length > 1200 ? '…' : ''}`);
    }

    if (parts.length <= 1) return '';

    return `\n\n${parts.join('\n')}\n`;
  } catch (e) {
    console.warn('[forge-hook]', e instanceof Error ? e.message : e);
    return '';
  }
}
