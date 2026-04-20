/**
 * Supabase Edge Function — auto-heal-agent
 * Deno runtime — déployez avec : supabase functions deploy auto-heal-agent
 *
 * Secrets requis (supabase secrets set) :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *   GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH
 *   VERCEL_DEPLOY_HOOK_URL
 *
 * Déclenchement : POST depuis /api/cron/sentinel avec Bearer CRON_SECRET
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const ANTHROPIC_MODEL =
  Deno.env.get('ANTHROPIC_SUPPORT_LEARNING_MODEL')?.trim() || 'claude-sonnet-4-6';
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') ?? '';
const GITHUB_REPO = Deno.env.get('GITHUB_REPO') ?? '';
const GITHUB_BRANCH = Deno.env.get('GITHUB_BRANCH') ?? 'main';
const VERCEL_DEPLOY_HOOK = Deno.env.get('VERCEL_DEPLOY_HOOK_URL') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SERVICE_FILES: Record<string, string[]> = {
  database:  ['lib/supabase/server.ts', 'lib/supabase/admin.ts'],
  openai:    ['lib/support/embeddings.ts', 'app/api/ai/generate/route.ts'],
  anthropic: ['lib/support/learning-extraction.ts'],
  whatsapp:  ['lib/whatsapp-alerts/send-whatsapp-message.ts'],
  webhooks:  ['app/api/health/route.ts'],
};

type GithubFile = { path: string; content: string; sha: string };
type ClaudeResponse = {
  diagnosis: string;
  action_type: 'code_fix' | 'deploy_hook' | 'env_issue' | 'external_outage';
  confidence: string;
  code_fix: { file_path: string; new_content: string } | null;
  deploy_needed: boolean;
  summary_for_dashboard: string;
  prevention: string;
};

// ── Deno-compatible base64 helpers ─────────────────────────────────────────
function b64decode(b64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
}
function b64encode(str: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

async function fetchGitHubFile(path: string): Promise<GithubFile | null> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`,
      { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) return null;
    const data = await res.json() as { content: string; sha: string };
    return { path, content: b64decode(data.content), sha: data.sha };
  } catch {
    return null;
  }
}

async function commitFix(filePath: string, newContent: string, service: string, sha: string): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `fix(sentinel): Auto-heal ${service} — correction par Claude 3.5 Sonnet`,
        content: b64encode(newContent),
        sha,
        branch: GITHUB_BRANCH,
      }),
    }
  );
  if (!res.ok) throw new Error(`GitHub commit failed: ${res.status}`);
}

async function askClaude(
  service: string,
  errorMessage: string,
  latency: number | null,
  sourceFiles: GithubFile[]
): Promise<ClaudeResponse | null> {
  if (!ANTHROPIC_KEY) return null;
  const filesBlock = sourceFiles.length > 0
    ? '\n\nFICHIERS SOURCE :\n' + sourceFiles.map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 6000)}\n\`\`\``).join('\n\n')
    : '';

  const prompt = `Tu es un ingénieur DevOps senior REPUTEXA (Next.js/Supabase). Analyse cet incident et génère la correction.

SERVICE : ${service} | ERREUR : ${errorMessage} | LATENCE : ${latency ?? 'N/A'}ms${filesBlock}

Réponds UNIQUEMENT en JSON valide :
{"diagnosis":"...","action_type":"code_fix|deploy_hook|env_issue|external_outage","confidence":"high|medium|low","code_fix":{"file_path":"...","new_content":"..."},"deploy_needed":true,"summary_for_dashboard":"...","prevention":"..."}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 4000, temperature: 0.1, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  try {
    return JSON.parse(data.content[0].text.trim()) as ClaudeResponse;
  } catch {
    return null;
  }
}

async function healService(service: string, errorMessage: string, latency: number | null) {
  const sourceFiles = (
    await Promise.all((SERVICE_FILES[service] ?? []).map(fetchGitHubFile))
  ).filter(Boolean) as GithubFile[];

  const diagnosis = await askClaude(service, errorMessage, latency, sourceFiles);
  if (!diagnosis) {
    return { status: 'failed', diagnosis: 'Claude injoignable', action: 'none', deployTriggered: false };
  }

  if (diagnosis.action_type === 'code_fix' && diagnosis.code_fix && GITHUB_TOKEN && GITHUB_REPO) {
    const { file_path, new_content } = diagnosis.code_fix;
    const original = sourceFiles.find((f) => f.path === file_path);
    if (original) {
      try {
        await commitFix(file_path, new_content, service, original.sha);
        return {
          status: 'applied',
          diagnosis: `${diagnosis.diagnosis}\n\n📄 Correction appliquée dans \`${file_path}\` par Claude 3.5 Sonnet.\n🔄 Déploiement Vercel automatique via push GitHub.\n\n💡 ${diagnosis.prevention}`,
          action: `code_fix:${file_path}`,
          deployTriggered: true,
        };
      } catch (e) {
        console.error('commit failed:', e);
      }
    }
  }

  if (diagnosis.deploy_needed || diagnosis.action_type === 'deploy_hook') {
    if (VERCEL_DEPLOY_HOOK) {
      await fetch(VERCEL_DEPLOY_HOOK, { method: 'POST' }).catch(() => null);
    }
    return {
      status: 'applied',
      diagnosis: `${diagnosis.diagnosis}\n\n🔄 ${diagnosis.summary_for_dashboard}\n\n💡 ${diagnosis.prevention}`,
      action: 'deploy_hook',
      deployTriggered: Boolean(VERCEL_DEPLOY_HOOK),
    };
  }

  return {
    status: 'skipped',
    diagnosis: `${diagnosis.diagnosis}\n\n⚠️ Action manuelle requise (${diagnosis.action_type}).\n\n💡 ${diagnosis.prevention}`,
    action: diagnosis.action_type,
    deployTriggered: false,
  };
}

// ── Deno.serve entry point ─────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: pending } = await admin
    .from('system_incidents')
    .select('id, service, status, message, latency_ms')
    .eq('status', 'critical')
    .is('heal_status', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (!pending?.length) {
    return new Response(JSON.stringify({ healed: 0, message: 'Aucun incident en attente' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const allIds = pending.map((i: { id: unknown }) => i.id as string);
  await admin.from('system_incidents').update({ heal_status: 'in_progress' }).in('id', allIds);

  const serviceMap = new Map<string, typeof pending[0]>();
  for (const inc of pending) {
    if (!serviceMap.has(inc.service as string)) serviceMap.set(inc.service as string, inc);
  }

  let healed = 0;
  for (const [service, incident] of serviceMap) {
    const result = await healService(service, incident.message as string, incident.latency_ms as number | null);
    if (result.status === 'applied') healed++;
    await admin.from('system_incidents').update({
      heal_status: result.status,
      claude_diagnosis: result.diagnosis,
      heal_action: result.action,
      deploy_triggered: result.deployTriggered,
    }).eq('id', incident.id);
  }

  return new Response(JSON.stringify({ healed, total: serviceMap.size }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
