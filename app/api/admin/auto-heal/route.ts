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

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY?.trim() ?? '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_SUPPORT_LEARNING_MODEL ?? 'claude-3-5-sonnet-20241022';
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
  sourceFiles: GithubFile[]
): Promise<ClaudeResponse | null> {
  if (!ANTHROPIC_KEY) return null;

  const filesBlock = sourceFiles.length > 0
    ? '\n\nFICHIERS SOURCE PERTINENTS :\n' +
      sourceFiles.map((f) => `### ${f.path}\n\`\`\`typescript\n${f.content.slice(0, 8000)}\n\`\`\``).join('\n\n')
    : '\n\n(Aucun fichier source disponible — GITHUB_TOKEN non configuré)';

  const prompt = `Tu es un ingénieur DevOps senior pour REPUTEXA (SaaS Next.js/Supabase). Analyse cet incident Sentinel et génère la correction nécessaire pour l'Auto-Guérison.

SERVICE EN ÉCHEC : ${service}
MESSAGE D'ERREUR : ${errorMessage}
LATENCE : ${latency !== null ? `${latency}ms` : 'N/A'}${filesBlock}

INSTRUCTIONS STRICTES :
1. Identifie la cause racine précise (code défectueux, config manquante, panne tiers, timeout)
2. Choisis le type d'action :
   - "code_fix"         → erreur dans le code source identifiable et corrigeable
   - "deploy_hook"      → redémarrage suffisant (timeout, connexion perdue)
   - "env_issue"        → variable d'environnement manquante ou invalide
   - "external_outage"  → panne du fournisseur tiers (OpenAI/Twilio/Anthropic down)
3. Si "code_fix" : génère le contenu COMPLET et fonctionnel du fichier corrigé
4. Si "env_issue" ou "external_outage" : deploy_needed = false

Réponds UNIQUEMENT en JSON valide (zéro markdown, zéro blocs de code) :
{
  "diagnosis": "Explication technique précise en français (2-4 phrases)",
  "action_type": "code_fix",
  "confidence": "high",
  "code_fix": { "file_path": "chemin/depuis/racine.ts", "new_content": "contenu TypeScript complet" },
  "deploy_needed": true,
  "summary_for_dashboard": "Résumé 120 caractères max pour le voyant ORANGE",
  "prevention": "Recommandation pour éviter ce problème"
}`;

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
  const toolName = extractToolName(message);
  if (!toolName) {
    return {
      service: 'support_design_bug',
      status: 'skipped',
      diagnosis: 'Impossible de déterminer le nom de l\'outil depuis le message d\'incident.',
      action: 'none',
      deployTriggered: false,
    };
  }

  const filePath = TOOL_TO_FILE[toolName];
  if (!filePath) {
    return {
      service: 'support_design_bug',
      status: 'skipped',
      diagnosis: `Outil "${toolName}" non mappé à un fichier source. Correction manuelle requise.`,
      action: 'none',
      deployTriggered: false,
    };
  }

  if (!isGitHubConfigured()) {
    return {
      service: 'support_design_bug',
      status: 'skipped',
      diagnosis: 'GITHUB_TOKEN ou GITHUB_REPO non configurés. Impossible de créer la PR.',
      action: 'env_issue',
      deployTriggered: false,
    };
  }

  if (!ANTHROPIC_KEY) {
    return {
      service: 'support_design_bug',
      status: 'skipped',
      diagnosis: 'ANTHROPIC_API_KEY non configurée. Diagnostic IA impossible.',
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
      diagnosis: `Fichier source introuvable sur GitHub : ${filePath}`,
      action: 'none',
      deployTriggered: false,
    };
  }

  // Demander à Claude de générer le correctif
  const prompt = `Tu es un ingénieur senior REPUTEXA. Un Bug de Design a été détecté dans le support agent.

INCIDENT : ${message}

OUTIL CONCERNÉ : ${toolName}
FICHIER SOURCE : ${filePath}

CONTENU ACTUEL DU FICHIER :
\`\`\`typescript
${fileInfo.content.slice(0, 10000)}
\`\`\`

MISSION : Génère une correction définitive du code pour que ce type de réclamation n'arrive plus.
La correction doit résoudre la cause racine, pas juste ajouter un patch superficiel.

Réponds UNIQUEMENT en JSON valide :
{
  "diagnosis": "Explication technique de la cause racine (2-3 phrases)",
  "correction_summary": "Ce qui a été corrigé et pourquoi (1-2 phrases)",
  "prevention": "Comment éviter ce problème à l'avenir",
  "new_content": "CONTENU COMPLET DU FICHIER CORRIGÉ (pas de troncature, pas de markdown)"
}`;

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
      diagnosis: 'Claude injoignable ou réponse JSON invalide.',
      action: 'none',
      deployTriggered: false,
    };
  }

  if (!newContent?.trim()) {
    return {
      service: 'support_design_bug',
      status: 'failed',
      diagnosis: `Diagnostic : ${diagnosis}\n\nClaude n'a pas généré de nouveau contenu.`,
      action: 'none',
      deployTriggered: false,
    };
  }

  // Créer la Pull Request
  const timestamp  = Math.floor(Date.now() / 1000);
  const branchName = `fix/auto-heal-${toolName.replace(/_/g, '-')}-${timestamp}`;
  const prTitle    = `fix(auto-heal): corriger l'outil ${toolName} — Bug de Design`;
  const prBody     = `## 🔧 Correction Automatique — Bug de Design\n\n` +
    `**Incident :** ${incidentId}\n` +
    `**Outil concerné :** \`${toolName}\`\n` +
    `**Fichier corrigé :** \`${filePath}\`\n\n` +
    `## Diagnostic\n${diagnosis}\n\n` +
    `## Correction Appliquée\n${correctionSummary}\n\n` +
    `## Prévention\n${prevention}\n\n` +
    `---\n` +
    `> ⚠️ Cette PR a été générée automatiquement par l'agent Auto-Heal de REPUTEXA.\n` +
    `> Validez après revue du diff. Aucun déploiement ne sera déclenché sans votre approbation.`;

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
      diagnosis:
        `**Diagnostic :** ${diagnosis}\n\n` +
        `**Correction :** ${correctionSummary}\n\n` +
        `**PR ouverte :** [${prResult.pr_url}](${prResult.pr_url})\n\n` +
        `**Prévention :** ${prevention}`,
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
      diagnosis: `Diagnostic généré mais PR échouée : ${errMsg}\n\nDiagnostic : ${diagnosis}`,
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
  if (!ANTHROPIC_KEY) {
    return {
      service,
      status: 'skipped',
      diagnosis: 'ANTHROPIC_API_KEY non configurée — diagnostic IA impossible.',
      action: 'none',
      deployTriggered: false,
    };
  }

  const filePaths = SERVICE_FILES[service] ?? [];
  const sourceFiles = (await Promise.all(filePaths.map(fetchGitHubFileWithPath))).filter(Boolean) as GithubFile[];

  const diagnosis = await askClaude(service, errorMessage, latency, sourceFiles);
  if (!diagnosis) {
    return { service, status: 'failed', diagnosis: 'Claude 3.5 injoignable ou réponse invalide.', action: 'none', deployTriggered: false };
  }

  // ── Attempt code fix via GitHub ──
  if (diagnosis.action_type === 'code_fix' && diagnosis.code_fix && GITHUB_TOKEN && GITHUB_REPO) {
    const { file_path, new_content } = diagnosis.code_fix;
    const originalFile = sourceFiles.find((f) => f.path === file_path);
    if (originalFile) {
      try {
        await commitFix(file_path, new_content, service, originalFile.sha);
        const dashboardMsg =
          diagnosis.summary_for_dashboard ||
          `Correction automatique appliquée par Claude 3.5 Sonnet dans ${file_path}. Nouveau déploiement en cours.`;
        return {
          service,
          status: 'applied',
          diagnosis: `${diagnosis.diagnosis}\n\n📄 Correction appliquée dans \`${file_path}\`.\n\n🔄 Nouveau déploiement Vercel déclenché via push GitHub.\n\n💡 Prévention : ${diagnosis.prevention}`,
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
        `Redéploiement automatique déclenché pour ${service}. En cours de restauration.`;
      return {
        service,
        status: 'applied',
        diagnosis: `${diagnosis.diagnosis}\n\n🔄 ${dashboardMsg}\n\n💡 Prévention : ${diagnosis.prevention}`,
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
    diagnosis: `${diagnosis.diagnosis}\n\n⚠️ Action requise manuellement (${diagnosis.action_type}).\n\n💡 Prévention : ${diagnosis.prevention}`,
    action: diagnosis.action_type,
    deployTriggered: false,
  };
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const isCronSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  let isAdmin = false;

  if (!isVercelCron && !isCronSecret) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    isAdmin = true;
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Admin client non configuré' }, { status: 500 });

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
    return NextResponse.json({ healed: 0, message: 'Aucun incident en attente de traitement' });
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
