/**
 * POST /api/admin/auto-heal
 * Agent de Réparation Serverless — Cerveau du Sentinel.
 *
 * Déclenchement :
 *   - Automatique depuis /api/cron/sentinel quand un nouveau critique est détecté
 *   - Manuel depuis le Panel Admin (auth admin)
 *
 * Pipeline standard (incidents critiques) :
 *   1. Lit les incidents critiques sans heal_status depuis les 15 dernières minutes
 *   2. Télécharge les fichiers source pertinents depuis GitHub
 *   3. Envoie à Claude 3.5 Sonnet pour diagnostic + génération de correctif
 *   4. Si code_fix  → commit GitHub (Vercel redéploie automatiquement)
 *   5. Si infra     → appelle le Deploy Hook Vercel
 *   6. Met à jour system_incidents avec claude_diagnosis + heal_status
 *
 * Pipeline Bug de Design (service = 'support_design_bug') :
 *   1. Extrait le nom de l'outil répétitif depuis le message d'incident
 *   2. Mappe l'outil vers son fichier source
 *   3. Claude analyse et génère un correctif
 *   4. Crée une Pull Request (JAMAIS de push direct sur main)
 *   5. Met à jour l'incident avec l'URL de la PR
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHealingPR, fetchGitHubFile, isGitHubConfigured } from '@/lib/github/auto-heal-pr';
import { ANTHROPIC_DEFAULT_SONNET } from '@/lib/ai/anthropic-model-defaults';
import { loadForgeKnowledgeBlock } from '@/lib/ai/forge-knowledge-hook';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY?.trim() ?? '';
const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_SUPPORT_LEARNING_MODEL?.trim() || ANTHROPIC_DEFAULT_SONNET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim() ?? '';
const GITHUB_REPO = process.env.GITHUB_REPO?.trim() ?? '';   // e.g. "username/aaaempire-reputation-ai"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH?.trim() ?? 'main';
const VERCEL_DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK_URL?.trim() ?? '';

// Maps each service to its most relevant source files for Claude's analysis
const SERVICE_FILES: Record<string, string[]> = {
  database:  ['lib/supabase/server.ts', 'lib/supabase/admin.ts'],
  openai:    ['lib/support/embeddings.ts', 'app/api/ai/generate/route.ts'],
  anthropic: ['lib/support/learning-extraction.ts', 'lib/support/rag-context.ts'],
  whatsapp:  ['lib/whatsapp-alerts/send-whatsapp-message.ts'],
  webhooks:  ['app/api/health/route.ts'],
};

// Maps tool names to their source files (for Bug de Design PRs)
const TOOL_TO_FILE: Record<string, string> = {
  validate_phone_format:        'lib/support/agent-tools.ts',
  restart_webhook:              'lib/support/agent-tools.ts',
  regenerate_pixel_perfect_pdf: 'lib/compliance-poster-pdf-server.tsx',
  regenerate_api_key:           'lib/support/agent-tools.ts',
  get_user_logs:                'lib/support/agent-tools.ts',
  create_github_pr:             'lib/github/auto-heal-pr.ts',
};

type GithubFile = { path: string; content: string; sha: string };
type ClaudeResponse = {
  diagnosis: string;
  action_type: 'code_fix' | 'deploy_hook' | 'env_issue' | 'external_outage';
  confidence: 'high' | 'medium' | 'low';
  code_fix: { file_path: string; new_content: string } | null;
  deploy_needed: boolean;
  summary_for_dashboard: string;
  prevention: string;
};
type HealResult = {
  service: string;
  status: 'applied' | 'skipped' | 'failed';
  diagnosis: string;
  action: string;
  deployTriggered: boolean;
  pr_url?: string;
};

// ── GitHub helpers ──────────────────────────────────────────────────────────

/**
 * Adaptateur : la fonction importée renvoie { content, sha },
 * mais le pipeline standard a besoin du champ `path` pour les logs et les lookups.
 */
async function fetchGitHubFileWithPath(path: string): Promise<GithubFile | null> {
  const info = await fetchGitHubFile(path);
  return info ? { path, content: info.content, sha: info.sha } : null;
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
        content: Buffer.from(newContent).toString('base64'),
        sha,
        branch: GITHUB_BRANCH,
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub commit failed: ${res.status} — ${body}`);
  }
}

async function triggerDeployHook(): Promise<void> {
  if (!VERCEL_DEPLOY_HOOK) return;
  await fetch(VERCEL_DEPLOY_HOOK, { method: 'POST' });
}

// ── Claude diagnosis ────────────────────────────────────────────────────────

async function askClaude(
  service: string,
  errorMessage: string,
  latency: number | null,
  sourceFiles: GithubFile[],
  forgeBlock: string
): Promise<ClaudeResponse | null> {
  if (!ANTHROPIC_KEY) return null;

  const t = apiAdminT();

  const filesBlock = sourceFiles.length > 0
    ? '\n\n' +
      t('autoHealSourceFilesHeader') +
      '\n' +
      sourceFiles.map((f) => `### ${f.path}\n\`\`\`typescript\n${f.content.slice(0, 8000)}\n\`\`\``).join('\n\n')
    : '\n\n' + t('autoHealSourceFilesEmpty');

  const forgeSection =
    forgeBlock.trim().length > 0
      ? `\n\n${t('autoHealForgeMemoryHeader')}\n${forgeBlock.slice(0, 12000)}`
      : '';

  const prompt = t('autoHealClaudeAskPrompt', {
    service,
    errorMessage,
    latency: latency !== null ? `${latency}ms` : 'N/A',
    filesBlock,
    forgeSection,
  });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);

    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content?.[0]?.text?.trim() ?? '';
    return JSON.parse(raw) as ClaudeResponse;
  } catch (e) {
    console.error('[auto-heal] Claude error:', e);
    return null;
  }
}

// ── Bug de Design healing (PR flow) ─────────────────────────────────────────

/** Extrait le nom de l'outil depuis le message d'incident Bug de Design */
function extractToolName(message: string): string | null {
  const match = /l'outil\s+"([^"]+)"/.exec(message) ?? /outil\s+"([^"]+)"/.exec(message);
  return match?.[1] ?? null;
}

/** Génère un correctif PR pour un incident Bug de Design */
async function healDesignBug(
  incidentId: string,
  message: string
): Promise<HealResult> {
  const t = apiAdminT();
  const toolName = extractToolName(message);
  if (!toolName) {
    return {
      service: 'support_design_bug',
      status: 'skipped',
      diagnosis: t('autoHealDesignBugToolNameUnknown'),
      action: 'none',
      deployTriggered: false,
    };
  }

  const filePath = TOOL_TO_FILE[toolName];
  if (!filePath) {
    return {
      service: 'support_design_bug',
      status: 'skipped',
      diagnosis: t('autoHealDesignBugToolUnmapped', { toolName }),
      action: 'none',
      deployTriggered: false,
    };
  }

  if (!isGitHubConfigured()) {
    return {
      service: 'support_design_bug',
      status: 'skipped',
      diagnosis: t('autoHealDesignBugGitHubNotConfigured'),
      action: 'env_issue',
      deployTriggered: false,
    };
  }

  if (!ANTHROPIC_KEY) {
    return {
      service: 'support_design_bug',
      status: 'skipped',
      diagnosis: t('autoHealAnthropicNotConfiguredShort'),
      action: 'none',
      deployTriggered: false,
    };
  }

  // Récupérer le fichier source depuis GitHub
  const fileInfo = await fetchGitHubFile(filePath);
  if (!fileInfo) {
    return {
      service: 'support_design_bug',
      status: 'failed',
      diagnosis: t('autoHealDesignBugSourceNotFound', { filePath }),
      action: 'none',
      deployTriggered: false,
    };
  }

  let forgeDesign = '';
  if (process.env.FORGE_SENTINEL_INJECT !== '0') {
    forgeDesign = await loadForgeKnowledgeBlock({
      agentKeys: ['sentinel', 'reputexa_core'],
      queryHint: `${toolName} ${message}`,
      maxSnippets: 10,
    });
  }

  const forgeDesignSection = forgeDesign.trim()
    ? `\n${t('autoHealForgeMemoryHeader')}\n${forgeDesign.slice(0, 8000)}\n`
    : '';

  // Demander à Claude de générer le correctif
  const prompt = t('autoHealDesignBugClaudePrompt', {
    message,
    forgeDesignSection,
    toolName,
    filePath,
    fileContent: fileInfo.content.slice(0, 10000),
  });

  let diagnosis = '';
  let newContent = '';
  let correctionSummary = '';
  let prevention = '';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 8000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content?.[0]?.text?.trim() ?? '';
    const parsed = JSON.parse(raw) as {
      diagnosis: string;
      correction_summary: string;
      prevention: string;
      new_content: string;
    };

    diagnosis         = parsed.diagnosis;
    correctionSummary = parsed.correction_summary;
    prevention        = parsed.prevention;
    newContent        = parsed.new_content;
  } catch (e) {
    console.error('[auto-heal] Claude Bug de Design error:', e);
    return {
      service: 'support_design_bug',
      status: 'failed',
      diagnosis: t('autoHealClaudeInvalidOrUnreachable'),
      action: 'none',
      deployTriggered: false,
    };
  }

  if (!newContent?.trim()) {
    return {
      service: 'support_design_bug',
      status: 'failed',
      diagnosis: t('autoHealDesignBugNoNewContent', { diagnosis }),
      action: 'none',
      deployTriggered: false,
    };
  }

  // Créer la Pull Request
  const timestamp  = Math.floor(Date.now() / 1000);
  const branchName = `fix/auto-heal-${toolName.replace(/_/g, '-')}-${timestamp}`;
  const prTitle    = t('autoHealDesignBugPrTitle', { toolName });
  const prBody     = t('autoHealDesignBugPrBody', {
    incidentId,
    toolName,
    filePath,
    diagnosis,
    correctionSummary,
    prevention,
  });

  try {
    const prResult = await createHealingPR({
      branchName,
      filePath,
      newContent,
      prTitle,
      prBody,
    });

    return {
      service: 'support_design_bug',
      status: 'applied',
      diagnosis: t('autoHealDesignBugAppliedDiagnosis', {
        diagnosis,
        correctionSummary,
        prUrl: prResult.pr_url,
        prevention,
      }),
      action:          `pr:${prResult.pr_url}`,
      deployTriggered: false,
      pr_url:          prResult.pr_url,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[auto-heal] GitHub PR creation failed:', errMsg);
    return {
      service: 'support_design_bug',
      status: 'failed',
      diagnosis: t('autoHealDesignBugPrFailed', { errMsg, diagnosis }),
      action: 'none',
      deployTriggered: false,
    };
  }
}

// ── Main healing logic ──────────────────────────────────────────────────────

async function healService(
  service: string,
  incidentId: string,
  errorMessage: string,
  latency: number | null
): Promise<HealResult> {
  const t = apiAdminT();
  if (!ANTHROPIC_KEY) {
    return {
      service,
      status: 'skipped',
      diagnosis: t('autoHealAnthropicNotConfigured'),
      action: 'none',
      deployTriggered: false,
    };
  }

  const filePaths = SERVICE_FILES[service] ?? [];
  const sourceFiles = (await Promise.all(filePaths.map(fetchGitHubFileWithPath))).filter(Boolean) as GithubFile[];

  let forgeBlock = '';
  if (process.env.FORGE_SENTINEL_INJECT !== '0') {
    forgeBlock = await loadForgeKnowledgeBlock({
      agentKeys: ['sentinel', 'reputexa_core', 'nexus'],
      queryHint: `${service} ${errorMessage}`,
      maxSnippets: 12,
    });
  }

  const diagnosis = await askClaude(service, errorMessage, latency, sourceFiles, forgeBlock);
  if (!diagnosis) {
    return { service, status: 'failed', diagnosis: t('autoHealClaudeInvalidResponse'), action: 'none', deployTriggered: false };
  }

  // ── Attempt code fix via GitHub ──
  if (diagnosis.action_type === 'code_fix' && diagnosis.code_fix && GITHUB_TOKEN && GITHUB_REPO) {
    const { file_path, new_content } = diagnosis.code_fix;
    const originalFile = sourceFiles.find((f) => f.path === file_path);
    if (originalFile) {
      try {
        await commitFix(file_path, new_content, service, originalFile.sha);
        return {
          service,
          status: 'applied',
          diagnosis: t('autoHealCodeFixAppliedDiagnosis', {
            diagnosis: diagnosis.diagnosis,
            file_path,
            prevention: diagnosis.prevention,
          }),
          action: `code_fix:${file_path}`,
          deployTriggered: true,
        };
      } catch (e) {
        console.error(`[auto-heal] GitHub commit failed for ${service}:`, e);
        // Fall through to deploy hook
      }
    }
  }

  // ── Attempt deploy hook ──
  if (diagnosis.deploy_needed || diagnosis.action_type === 'deploy_hook') {
    try {
      await triggerDeployHook();
      const dashboardMsg =
        diagnosis.summary_for_dashboard ||
        t('autoHealDeployHookDashboardFallback', { service });
      return {
        service,
        status: 'applied',
        diagnosis: t('autoHealDeployHookAppliedDiagnosis', {
          diagnosis: diagnosis.diagnosis,
          dashboardMsg,
          prevention: diagnosis.prevention,
        }),
        action: 'deploy_hook',
        deployTriggered: true,
      };
    } catch (e) {
      console.error('[auto-heal] Deploy hook failed:', e);
    }
  }

  // ── No actionable fix (env_issue or external_outage) ──
  return {
    service,
    status: 'skipped',
    diagnosis: t('autoHealManualActionDiagnosis', {
      diagnosis: diagnosis.diagnosis,
      actionType: diagnosis.action_type,
      prevention: diagnosis.prevention,
    }),
    action: diagnosis.action_type,
    deployTriggered: false,
  };
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ta = apiAdminT();
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isCronSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  let isAdmin = false;

  if (!isVercelCron && !isCronSecret) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
    isAdmin = true;
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });

  // Find unprocessed incidents — critiques ET support_design_bug (degraded) depuis 15 min
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: pending, error: fetchErr } = await admin
    .from('system_incidents')
    .select('id, service, status, message, latency_ms')
    .in('status', ['critical', 'degraded'])
    .is('heal_status', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  if (!pending?.length) {
    return NextResponse.json({ healed: 0, message: ta('autoHealNoPendingIncidents') });
  }

  // Mark all as in_progress immediately to prevent duplicate processing
  const allIds = pending.map((i) => i.id as string);
  await admin.from('system_incidents').update({ heal_status: 'in_progress' }).in('id', allIds);

  // Deduplicate: one heal attempt per service (take the most recent)
  const serviceMap = new Map<string, typeof pending[0]>();
  for (const inc of pending) {
    if (!serviceMap.has(inc.service as string)) serviceMap.set(inc.service as string, inc);
  }

  const healResults: HealResult[] = [];
  for (const [service, incident] of Array.from(serviceMap.entries())) {
    console.info(`[auto-heal] Processing service: ${service} — ${incident.message}`);

    let result: HealResult;

    if (service === 'support_design_bug') {
      // Pipeline Bug de Design : PR uniquement, jamais de push direct
      result = await healDesignBug(incident.id as string, incident.message as string);
    } else {
      // Pipeline standard : diagnostic + code_fix ou deploy_hook
      result = await healService(
        service,
        incident.id as string,
        incident.message as string,
        incident.latency_ms as number | null
      );
    }

    healResults.push(result);

    // Update the primary incident row for this service
    await admin
      .from('system_incidents')
      .update({
        heal_status:      result.status,
        claude_diagnosis: result.diagnosis,
        heal_action:      result.action,
        deploy_triggered: result.deployTriggered,
      })
      .eq('id', incident.id);

    // Mark duplicate rows for the same service as skipped
    const duplicateIds = pending
      .filter((i) => i.service === service && i.id !== incident.id)
      .map((i) => i.id as string);
    if (duplicateIds.length > 0) {
      await admin
        .from('system_incidents')
        .update({ heal_status: 'skipped', heal_action: 'duplicate' })
        .in('id', duplicateIds);
    }
  }

  const appliedCount = healResults.filter((r) => r.status === 'applied').length;
  console.info(`[auto-heal] Done — ${appliedCount}/${healResults.length} services réparés`);

  return NextResponse.json({
    healed: appliedCount,
    total:  healResults.length,
    results: healResults.map((r) => ({
      service:         r.service,
      status:          r.status,
      action:          r.action,
      deployTriggered: r.deployTriggered,
      pr_url:          r.pr_url ?? null,
      summary:         r.diagnosis.split('\n')[0],
    })),
    triggered_by: isAdmin ? 'admin_manual' : 'cron_sentinel',
  });
}
// Build trigger: 2026-03-20
