/**
 * Support Agent — Function Tools (Architecture Génesis v2 + Auto-Heal PR)
 *
 * Outils appelables par le modèle :
 *   1. get_user_logs              — diagnostic complet en temps réel
 *   2. restart_webhook            — régénère le token Zenith bloqué
 *   3. regenerate_pixel_perfect_pdf — affiche conformité #F5F2ED sans bordure
 *   4. regenerate_api_key         — recrée la clé webhook (rtx_live_...)
 *   5. validate_phone_format      — normalise vers E.164 et met à jour la DB
 *   6. create_github_pr           — correction via Pull Request (jamais push sur main)
 *   7. simulate_user_flow         — simulation lecture seule d'un parcours (sandbox logique)
 *   8. submit_dev_backlog         — rapport technique vers la file ingénieurs (#ticket_number)
 *   9. check_code_logic           — inspection d'un fichier sous app/api (index RAG ou disque)
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Anthropic from '@anthropic-ai/sdk';
import { createHealingPR, fetchGitHubFile, isGitHubConfigured } from '@/lib/github/auto-heal-pr';
import { logSupportAudit } from '@/lib/support/nexus-audit';

// ── Types publics ──────────────────────────────────────────────────────────────

export type ToolName =
  | 'get_user_logs'
  | 'restart_webhook'
  | 'regenerate_pixel_perfect_pdf'
  | 'regenerate_api_key'
  | 'validate_phone_format'
  | 'create_github_pr'
  | 'simulate_user_flow'
  | 'submit_dev_backlog'
  | 'check_code_logic';

export type NexusToolExecutionState = 'COMPLETED' | 'PENDING_APPROVAL';

export interface ToolCallResult {
  tool: ToolName;
  label: string;
  success: boolean;
  summary: string;
  /** Nexus : écriture soumise à validation humaine ou exécution directe (lecture seule). */
  nexus?: {
    execution_state: NexusToolExecutionState;
    idempotency_key?: string;
  };
}

/** READ = exécution immédiate ; WRITE = proposition + ligne support_pending_actions. */
export const SUPPORT_TOOL_ACCESS: Record<ToolName, 'READ' | 'WRITE'> = {
  get_user_logs: 'READ',
  simulate_user_flow: 'READ',
  check_code_logic: 'READ',
  regenerate_pixel_perfect_pdf: 'READ',
  restart_webhook: 'WRITE',
  regenerate_api_key: 'WRITE',
  validate_phone_format: 'WRITE',
  create_github_pr: 'WRITE',
  submit_dev_backlog: 'WRITE',
};

// ── UI Labels ─────────────────────────────────────────────────────────────────

export const TOOL_UI: Record<ToolName, { label: string; icon: string }> = {
  get_user_logs:                 { label: 'Analyse du compte',            icon: '🔍' },
  restart_webhook:               { label: 'Relance de la connexion',      icon: '⚡' },
  regenerate_pixel_perfect_pdf:  { label: "Régénération de l'affiche",    icon: '📄' },
  regenerate_api_key:            { label: "Nouvelle clé d'intégration",   icon: '🔑' },
  validate_phone_format:         { label: 'Correction du numéro',         icon: '📱' },
  create_github_pr:              { label: 'Mise à jour corrective (PR)',  icon: '🔧' },
  simulate_user_flow:            { label: 'Simulation de parcours',       icon: '🧪' },
  submit_dev_backlog:            { label: 'Rapport technique (dev)',     icon: '📋' },
  check_code_logic:              { label: 'Analyse code route API',      icon: '🔬' },
};

// ── Définitions Anthropic Tool (5 outils) ─────────────────────────────────────

export const SUPPORT_AGENT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'get_user_logs',
    description:
      "PRIORITE ABSOLUE -- appeler systematiquement au premier message. " +
      "Analyse l'etat complet du compte : abonnement, numero de telephone, " +
      "etablissements, webhook Zenith, file d'avis (pending / failed).",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: "UUID Supabase de l'utilisateur (fourni dans le contexte systeme)." },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'restart_webhook',
    description:
      "Reinitialise le token Zenith d'un utilisateur dont la connexion POS/Zapier est bloquee. " +
      "Genere un nouveau token et l'enregistre immediatement en base.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: "UUID Supabase de l'utilisateur." },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'regenerate_pixel_perfect_pdf',
    description:
      "Recree l'affiche de conformite RGPD. Design : fond #F5F2ED sans bordure blanche, " +
      "police Serif haut de gamme, icones SVG fines, zero coupure de mots. " +
      "Confirme la disponibilite au telechargement dans le tableau de bord.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: "UUID Supabase de l'utilisateur." },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'regenerate_api_key',
    description:
      "Regenere la cle API publique du webhook (format rtx_live_...). " +
      "L'ancienne URL est revoquee instantanement. " +
      "A utiliser si le webhook ne recoit plus de donnees ou si une cle compromise doit etre annulee.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: "UUID Supabase de l'utilisateur." },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'validate_phone_format',
    description:
      "Verifie et corrige le numero de telephone enregistre sur le profil. " +
      "Normalise vers le format international E.164 et met a jour la base si necessaire.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: "UUID Supabase de l'utilisateur." },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'create_github_pr',
    description:
      "OUTIL AUTO-HEAL — A utiliser UNIQUEMENT quand un Bug de Design recurrent est detecte " +
      "(meme outil appele 5+ fois pour le meme probleme). " +
      "Lit le fichier source concerne, genere une correction definitive, " +
      "et soumet une Pull Request sur le depot GitHub principal. " +
      "SECURITE ABSOLUE : jamais de push direct sur main. La PR attend la validation humaine. " +
      "Retourne l'URL de la PR a inclure dans le message de cloture.",
    input_schema: {
      type: 'object',
      properties: {
        branch_name: {
          type: 'string',
          description:
            "Nom de la branche de correctif. Format: fix/auto-heal-<tool_name>-<timestamp>. " +
            "Ex: fix/auto-heal-validate-phone-1748000000",
        },
        file_path: {
          type: 'string',
          description:
            "Chemin du fichier a corriger depuis la racine du depot. " +
            "Ex: lib/support/agent-tools.ts",
        },
        new_code: {
          type: 'string',
          description:
            "Contenu COMPLET et fonctionnel du fichier corrige. " +
            "Doit resoudre definitivement le probleme detecte.",
        },
        pr_title: {
          type: 'string',
          description:
            "Titre de la PR. Ex: fix(auto-heal): corriger la normalisation du numero de telephone",
        },
        pr_body: {
          type: 'string',
          description:
            "Corps de la PR en markdown : diagnostic, correction appliquee, prevention. " +
            "Genere automatiquement par l'agent.",
        },
      },
      required: ['branch_name', 'file_path', 'new_code', 'pr_title', 'pr_body'],
    },
  },
  {
    name: 'simulate_user_flow',
    description:
      "Sandbox logique en LECTURE SEULE : reproduit mentalement un parcours pour le compte (sans modifier les donnees). " +
      "Utiliser quand le client decrit un bouton ou un flux (cle d'integration, automatisation, file d'avis, abonnement). " +
      "Actions : api_key_integration | webhook_automation | review_collection_flow | subscription_access.",
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'UUID Supabase (injecte si omis).' },
        action: {
          type: 'string',
          description:
            'api_key_integration — cle rtx / webhook public ; webhook_automation — Zenith / delai ; ' +
            "review_collection_flow — file d'avis ; subscription_access — plan et paiement.",
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'submit_dev_backlog',
    description:
      "Enregistre un rapport technique pour les ingenieurs (bug plateforme, regression route serveur) dans dev_backlog. " +
      'Retourne un numero de dossier (#ticket_number) communicable au client en langage simple. ' +
      'Utiliser ticket_id du contexte systeme (ticket_id_courant) quand disponible.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titre court du rapport.' },
        technical_summary: { type: 'string', description: 'Constat technique factuel (symptomes, frequence).' },
        suggested_fix: { type: 'string', description: 'Piste de correction ou garde-fou propose.' },
        file_path: { type: 'string', description: 'Optionnel : fichier concerne (ex. app/api/.../route.ts).' },
        severity: {
          type: 'string',
          description: 'low | medium | high | critical — defaut medium.',
        },
        ticket_id: {
          type: 'string',
          description: 'Optionnel : UUID du ticket support (utiliser ticket_id_courant).',
        },
      },
      required: ['title', 'technical_summary', 'suggested_fix'],
    },
  },
  {
    name: 'check_code_logic',
    description:
      "Lit le contenu d'une route ou handler sous app/api/ pour correlation avec un symptome (ex. erreur serveur). " +
      "Chemins relatifs uniquement, sans '..' — ex. app/api/health/route.ts. " +
      "Privilegie l'index RAG code_kb_chunks ; sinon lecture disque. Option search_phrase pour extraire un passage.",
    input_schema: {
      type: 'object',
      properties: {
        relative_path: {
          type: 'string',
          description: 'Chemin depuis la racine du depot, ex. app/api/supabase/reviews/route.ts',
        },
        search_phrase: {
          type: 'string',
          description: 'Optionnel : sous-chaine a localiser dans le fichier (analyse ciblee).',
        },
      },
      required: ['relative_path'],
    },
  },
];

// ── Helper : normalisation téléphone ─────────────────────────────────────────

function isAnonymizedRow(phone: string | null, metadata: unknown): boolean {
  const p = (phone ?? '').trim();
  if (/^[a-f0-9]{64}$/i.test(p)) return true;
  const m = metadata as Record<string, unknown> | null;
  return typeof m?.anonymized_at === 'string' && m.anonymized_at.length > 0;
}

/** Agrège par mois calendaire (created_at) les entrées « terminées » vs anonymisées */
function buildRgpdQueueSnapshot(
  rows: Array<{ status: string; phone: string | null; metadata: unknown; created_at: string }>
): string {
  if (!rows.length) {
    return 'Aucune entrée de file dans la fenêtre analysée — ne pas affirmer de statistiques d’anonymisation.';
  }
  const terminal = new Set(['sent', 'failed', 'cancelled']);
  const byMonth = new Map<
    string,
    { total: number; anonymized: number }
  >();

  for (const r of rows) {
    if (!terminal.has(r.status)) continue;
    const d = new Date(r.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const cur = byMonth.get(key) ?? { total: 0, anonymized: 0 };
    cur.total += 1;
    if (isAnonymizedRow(r.phone, r.metadata)) cur.anonymized += 1;
    byMonth.set(key, cur);
  }

  const lines: string[] = [];
  const sorted = Array.from(byMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [month, { total, anonymized }] of sorted) {
    const pct = total > 0 ? Math.round((anonymized / total) * 100) : 0;
    lines.push(
      `- ${month} : ${anonymized}/${total} entrées terminées (sent/failed/cancelled) sont anonymisées dans l’état actuel (${pct} %). ` +
        (total > 0 && anonymized === total
          ? '→ vous pouvez dire que pour ce mois, dans les données consultées, tout est anonymisé.'
          : total > anonymized
            ? '→ ne pas affirmer 100 % sans reformuler : une partie des entrées conserve encore un identifiant en clair dans cette fenêtre.'
            : '')
    );
  }

  if (lines.length === 0) {
    return 'Pas encore d’entrées « terminées » dans la fenêtre — seules des lignes pending ou hors périmètre : ne pas inventer de pourcentage janvier / fenêtre 120 jours.';
  }
  return lines.join('\n');
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed; // déjà E.164
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('33') && digits.length === 11) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+33${digits.slice(1)}`;
  if (digits.length === 9 && !digits.startsWith('0')) return `+33${digits}`;
  return raw; // format indéterminable
}

// ── Dispatcher principal ───────────────────────────────────────────────────────

export async function executeTool(
  admin: SupabaseClient,
  name: ToolName,
  input: Record<string, string>
): Promise<ToolCallResult> {
  const { label } = TOOL_UI[name] ?? { label: name };

  switch (name) {
    case 'get_user_logs':               return executeGetUserLogs(admin, input.user_id, label);
    case 'restart_webhook':             return executeRestartWebhook(admin, input.user_id, label);
    case 'regenerate_pixel_perfect_pdf':return executeRegeneratePdf(admin, input.user_id, label);
    case 'regenerate_api_key':          return executeRegenerateApiKey(admin, input.user_id, label);
    case 'validate_phone_format':       return executeValidatePhone(admin, input.user_id, label);
    case 'create_github_pr':            return executeCreateGithubPR(input, label);
    case 'simulate_user_flow':          return executeSimulateUserFlow(admin, input.user_id, input.action ?? '', label);
    case 'submit_dev_backlog':          return executeSubmitDevBacklog(admin, input, label);
    case 'check_code_logic':            return executeCheckCodeLogic(admin, input, label);
    default:
      return { tool: name, label, success: false, summary: `Outil inconnu : ${name}` };
  }
}

function coerceToolInputJson(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

/**
 * Exécution agent avec garde-fou Nexus : les outils WRITE ne s’appliquent pas,
 * ils créent une ligne PENDING + idempotency_key pour POST admin.
 */
export async function executeSupportToolWithApprovalGate(
  admin: SupabaseClient,
  name: ToolName,
  input: Record<string, string>,
  ctx: { ticketId: string; targetUserId: string }
): Promise<ToolCallResult> {
  const { label } = TOOL_UI[name] ?? { label: name };
  const access = SUPPORT_TOOL_ACCESS[name];
  if (!access) {
    return { tool: name, label, success: false, summary: `Outil inconnu : ${name}` };
  }

  if (access === 'READ') {
    const res = await executeTool(admin, name, input);
    return { ...res, nexus: { execution_state: 'COMPLETED' } };
  }

  const idempotency_key = crypto.randomUUID();
  const { error } = await admin.from('support_pending_actions').insert({
    idempotency_key,
    ticket_id: ctx.ticketId,
    target_user_id: ctx.targetUserId,
    tool_name: name,
    tool_input: input as unknown as Record<string, unknown>,
    status: 'pending',
  });

  if (error) {
    const code = 'code' in error ? String((error as { code: unknown }).code) : '';
    if (code === '42P01') {
      return {
        tool: name,
        label,
        success: false,
        summary:
          'Nexus indisponible (migration support_pending_actions non appliquée). Exécutez la migration 139.',
      };
    }
    return {
      tool: name,
      label,
      success: false,
      summary: `Enregistrement PENDING_APPROVAL impossible : ${error.message}`,
    };
  }

  void logSupportAudit(admin, {
    ticket_id: ctx.ticketId,
    action_type: 'tool_write_pending_approval',
    metadata: {
      tool_name: name,
      idempotency_key,
      target_user_id: ctx.targetUserId,
    },
  });

  return {
    tool: name,
    label,
    success: false,
    summary:
      `État PENDING_APPROVAL — action « ${label} » en file d’approbation humaine. ` +
      `idempotency_key interne : ${idempotency_key}. ` +
      `Ne pas communiquer la clé au client : indiquer qu’une opération sensible sera validée par l’équipe.`,
    nexus: { execution_state: 'PENDING_APPROVAL', idempotency_key },
  };
}

/** Pour routes admin : réhydrate JSON stocké en pending. */
export function coercePendingToolInput(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  return coerceToolInputJson(raw as Record<string, unknown>);
}

// ── Tool 1 : get_user_logs ────────────────────────────────────────────────────

async function executeGetUserLogs(
  admin: SupabaseClient,
  userId: string,
  label: string
): Promise<ToolCallResult> {
  const sections: string[] = [
    `**Lecture directe base de données** (instantané, pas un cache) : ${new Date().toISOString()} — ` +
      'si la situation a pu changer depuis un appel précédent, rappelez cet outil.',
  ];

  // Profil
  type ProfileRow = {
    establishment_name: string | null;
    full_name: string | null;
    phone: string | null;
    subscription_plan: string | null;
    subscription_status: string | null;
    payment_status: string | null;
    webhook_token: string | null;
    api_key: string | null;
    webhook_send_delay_minutes: number | null;
  };
  const { data: profile } = (await admin
    .from('profiles')
    .select(
      'establishment_name, full_name, phone, subscription_plan, subscription_status, ' +
      'payment_status, webhook_token, api_key, webhook_send_delay_minutes'
    )
    .eq('id', userId)
    .maybeSingle()) as { data: ProfileRow | null; error: unknown };

  if (profile) {
    const phone = String(profile.phone ?? '').trim();
    const phoneStatus = !phone
      ? '⚠️ NON RENSEIGNÉ'
      : /^\+\d{8,15}$/.test(phone)
      ? `✓ ${phone}`
      : `⚠️ FORMAT INVALIDE : ${phone}`;

    sections.push(
      '## PROFIL\n' +
        `- Interlocuteur (profil) : ${profile.full_name ?? '—'}\n` +
        `- Établissement : ${profile.establishment_name ?? '—'}\n` +
        `- Téléphone : ${phoneStatus}\n` +
        `- Plan : ${profile.subscription_plan ?? '—'} | Statut : ${profile.subscription_status ?? '—'}\n` +
        `- Paiement : ${profile.payment_status ?? 'ok'}\n` +
        `- Clé API : ${profile.api_key ? `✓ (${String(profile.api_key).slice(0, 22)}…)` : '⚠️ ABSENTE'}\n` +
        `- Token Zenith : ${profile.webhook_token ? '✓ présent' : '⚠️ NON CONFIGURÉ'}\n` +
        `- Délai WhatsApp : ${profile.webhook_send_delay_minutes ?? 30} min`
    );
  } else {
    sections.push(`## PROFIL : introuvable (user_id=${userId})`);
  }

  // File d'avis (compteurs + aperçu RGPD sur fenêtre récente)
  const { data: queueRows } = await admin
    .from('review_queue')
    .select('status')
    .eq('user_id', userId)
    .limit(100);

  if (queueRows) {
    const pending = queueRows.filter((r) => r.status === 'pending').length;
    const sent    = queueRows.filter((r) => r.status === 'sent').length;
    const failed  = queueRows.filter((r) => r.status === 'failed').length;
    sections.push(
      "## FILE D'AVIS\n" +
        `- En attente : ${pending} | Envoyés : ${sent} | Échecs : ${failed}${failed > 0 ? '  ⚠️ ÉCHECS DÉTECTÉS' : ''}`
    );
  }

  const windowStart = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rqDetail } = await admin
    .from('review_queue')
    .select('status, phone, metadata, created_at')
    .eq('user_id', userId)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(800);

  const rgpdLines = buildRgpdQueueSnapshot(
    (rqDetail ?? []) as Array<{
      status: string;
      phone: string | null;
      metadata: unknown;
      created_at: string;
    }>
  );
  sections.push(
    '## APERÇU RGPD — file d’avis (instantané)\n' +
      `_Fenêtre : ~120 jours, jusqu’à 800 lignes. À utiliser pour personnaliser vos réponses (ne jamais inventer un pourcentage absent ci-dessous)._\n\n` +
      rgpdLines
  );

  // Établissements
  const { data: establishments } = await admin
    .from('establishments')
    .select('id, name, place_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (establishments?.length) {
    const lines = establishments.map(
      (e) =>
        `  - "${e.name || '(sans nom)'}" [${String(e.id).slice(0, 8)}…]` +
        ` — Google place_id : ${e.place_id ? '✓' : '⚠️ MANQUANT'}`
    );
    sections.push(`## ÉTABLISSEMENTS (${establishments.length})\n${lines.join('\n')}`);
  } else {
    sections.push('## ÉTABLISSEMENTS : aucun enregistré sur ce compte.');
  }

  return { tool: 'get_user_logs', label, success: true, summary: sections.join('\n\n') };
}

// ── Tool 2 : restart_webhook ──────────────────────────────────────────────────

async function executeRestartWebhook(
  admin: SupabaseClient,
  userId: string,
  label: string
): Promise<ToolCallResult> {
  const newToken = crypto.randomUUID();

  const { error } = await admin
    .from('profiles')
    .update({ webhook_token: newToken })
    .eq('id', userId);

  if (error) {
    return { tool: 'restart_webhook', label, success: false, summary: `Erreur : ${error.message}` };
  }

  return {
    tool: 'restart_webhook',
    label,
    success: true,
    summary:
      `Token Zenith réinitialisé avec succès.\n` +
      `Nouveau token (début) : ${newToken.slice(0, 18)}…\n` +
      `Le client doit mettre à jour ce token dans son POS ou Zapier ` +
      `(accessible dans Paramètres → Intégrations → Zenith).`,
  };
}

// ── Tool 3 : regenerate_pixel_perfect_pdf ─────────────────────────────────────

async function executeRegeneratePdf(
  admin: SupabaseClient,
  userId: string,
  label: string
): Promise<ToolCallResult> {
  const { data: profile } = await admin
    .from('profiles')
    .select('establishment_name')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return { tool: 'regenerate_pixel_perfect_pdf', label, success: false, summary: 'Profil introuvable.' };
  }

  return {
    tool: 'regenerate_pixel_perfect_pdf',
    label,
    success: true,
    summary:
      `L'affiche de conformité RGPD pour "${profile.establishment_name ?? 'votre établissement'}" ` +
      `est disponible au téléchargement. Formats A4 / A5 / A3 selon le menu « Format papier », ` +
      `fond #F5F2ED, Helvetica, icônes SVG. ` +
      `Accès : tableau de bord → Collecte d'avis → affiche de conformité.`,
  };
}

// ── Tool 4 : regenerate_api_key ───────────────────────────────────────────────

async function executeRegenerateApiKey(
  admin: SupabaseClient,
  userId: string,
  label: string
): Promise<ToolCallResult> {
  const newKey = `rtx_live_${crypto.randomUUID()}`;

  const { error } = await admin
    .from('profiles')
    .update({ api_key: newKey })
    .eq('id', userId);

  if (error) {
    return { tool: 'regenerate_api_key', label, success: false, summary: `Erreur : ${error.message}` };
  }

  return {
    tool: 'regenerate_api_key',
    label,
    success: true,
    summary:
      `Clé d'intégration régénérée avec succès. L'ancienne URL est immédiatement désactivée.\n` +
      `Nouvelle clé (début) : ${newKey.slice(0, 28)}…\n` +
      `Le client doit mettre à jour son POS ou Zapier avec la nouvelle URL webhook, ` +
      `disponible dans Paramètres → Intégrations.`,
  };
}

// ── Tool 5 : validate_phone_format ────────────────────────────────────────────

async function executeValidatePhone(
  admin: SupabaseClient,
  userId: string,
  label: string
): Promise<ToolCallResult> {
  const { data: profile } = await admin
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return { tool: 'validate_phone_format', label, success: false, summary: 'Profil introuvable.' };
  }

  const raw = String(profile.phone ?? '').trim();

  if (!raw) {
    return {
      tool: 'validate_phone_format',
      label,
      success: false,
      summary:
        'Aucun numéro enregistré. Le client doit en saisir un dans Paramètres → Profil ' +
        'pour activer les envois WhatsApp.',
    };
  }

  const normalized = normalizePhone(raw);
  const isE164 = /^\+\d{8,15}$/.test(normalized);

  if (!isE164) {
    return {
      tool: 'validate_phone_format',
      label,
      success: false,
      summary:
        `Numéro invalide : "${raw}". ` +
        `Format attendu : +33XXXXXXXXX ou indicatif pays + numéro. ` +
        `Le client doit le corriger dans Paramètres → Profil.`,
    };
  }

  if (normalized === raw) {
    return {
      tool: 'validate_phone_format',
      label,
      success: true,
      summary: `Numéro déjà correct (E.164) : ${raw}. Aucune modification nécessaire.`,
    };
  }

  const { error } = await admin
    .from('profiles')
    .update({ phone: normalized })
    .eq('id', userId);

  if (error) {
    return { tool: 'validate_phone_format', label, success: false, summary: `Correction échouée : ${error.message}` };
  }

  return {
    tool: 'validate_phone_format',
    label,
    success: true,
    summary: `Numéro corrigé et mis à jour : "${raw}" → "${normalized}". Opérationnel.`,
  };
}

// ── Tool 6 : create_github_pr ──────────────────────────────────────────────────
// Sécurité : jamais de push direct sur main — PR uniquement.

async function executeCreateGithubPR(
  input: Record<string, string>,
  label: string
): Promise<ToolCallResult> {
  const { branch_name, file_path, new_code, pr_title, pr_body } = input;

  if (!branch_name || !file_path || !new_code || !pr_title) {
    return {
      tool: 'create_github_pr',
      label,
      success: false,
      summary: 'Paramètres manquants : branch_name, file_path, new_code et pr_title sont obligatoires.',
    };
  }

  if (!isGitHubConfigured()) {
    return {
      tool: 'create_github_pr',
      label,
      success: false,
      summary:
        'GitHub non configuré (GITHUB_TOKEN ou GITHUB_REPO manquant). ' +
        'La correction a été identifiée mais ne peut pas être soumise automatiquement.',
    };
  }

  // Vérifier que le fichier existe avant de tenter la PR
  const existingFile = await fetchGitHubFile(file_path);
  if (!existingFile) {
    return {
      tool: 'create_github_pr',
      label,
      success: false,
      summary: `Fichier introuvable sur GitHub : "${file_path}". Vérifiez le chemin.`,
    };
  }

  try {
    const result = await createHealingPR({
      branchName: branch_name,
      filePath:   file_path,
      newContent: new_code,
      prTitle:    pr_title,
      prBody:     pr_body ?? '',
    });

    return {
      tool: 'create_github_pr',
      label,
      success: true,
      summary:
        `Pull Request ouverte avec succès.\n` +
        `• PR #${result.pr_number} : ${result.pr_url}\n` +
        `• Branche : ${result.branch}\n` +
        `• Fichier corrigé : ${file_path}\n` +
        `• En attente de votre validation — aucun déploiement tant que vous n'avez pas approuvé.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[agent] create_github_pr:', msg);
    return {
      tool: 'create_github_pr',
      label,
      success: false,
      summary: `Échec de la création de PR : ${msg}`,
    };
  }
}

const SIMULATE_ACTIONS = new Set([
  'api_key_integration',
  'webhook_automation',
  'review_collection_flow',
  'subscription_access',
]);

async function executeSimulateUserFlow(
  admin: SupabaseClient,
  userId: string,
  action: string,
  label: string
): Promise<ToolCallResult> {
  const a = action.trim();
  if (!SIMULATE_ACTIONS.has(a)) {
    return {
      tool: 'simulate_user_flow',
      label,
      success: false,
      summary:
        `Action non reconnue : "${a}". Valeurs : api_key_integration | webhook_automation | ` +
        `review_collection_flow | subscription_access.`,
    };
  }

  const lines: string[] = [
    '## Simulation de parcours (lecture seule, sans modification)',
    `Action : ${a}`,
    `Horodatage : ${new Date().toISOString()}`,
    '',
  ];

  type SimProfile = {
    establishment_name: string | null;
    subscription_plan: string | null;
    subscription_status: string | null;
    payment_status: string | null;
    webhook_token: string | null;
    api_key: string | null;
    webhook_send_delay_minutes: number | null;
  };

  const { data: profile } = (await admin
    .from('profiles')
    .select(
      'establishment_name, subscription_plan, subscription_status, payment_status, ' +
        'webhook_token, api_key, webhook_send_delay_minutes'
    )
    .eq('id', userId)
    .maybeSingle()) as { data: SimProfile | null };

  if (!profile) {
    return { tool: 'simulate_user_flow', label, success: false, summary: 'Profil introuvable pour ce compte.' };
  }

  if (a === 'api_key_integration') {
    const hasKey = Boolean(profile.api_key && String(profile.api_key).trim());
    lines.push(
      "### Chemin « clé d'intégration » (webhook public)",
      `- Clé présente sur le profil : ${hasKey ? 'oui' : 'non'}`,
      `- Comportement attendu : une clé active à la fois ; toute régénération invalue la précédente immédiatement.`,
      `- Si échec côté client après régénération : vérifier la mise à jour POS / connecteur avec la nouvelle URL.`,
    );
  }

  if (a === 'webhook_automation') {
    const tok = Boolean(profile.webhook_token && String(profile.webhook_token).trim());
    lines.push(
      '### Chemin « automatisation (Zenith) »',
      `- Jeton présent : ${tok ? 'oui' : 'non'}`,
      `- Délai d'envoi configuré (minutes) : ${profile.webhook_send_delay_minutes ?? 30}`,
      `- Si réception incohérente malgré une clé valide : envisager une relance de connexion (outil dédié) puis re-test côté caisse.`,
    );
  }

  if (a === 'review_collection_flow') {
    const { data: queueRows } = await admin.from('review_queue').select('status').eq('user_id', userId).limit(200);
    const pending = queueRows?.filter((r) => r.status === 'pending').length ?? 0;
    const failed = queueRows?.filter((r) => r.status === 'failed').length ?? 0;
    lines.push(
      "### Chemin « file d'avis »",
      `- Échantillon (max 200 lignes) : en attente=${pending}, échecs=${failed}`,
      `- Échecs > 0 : prioriser numéro valide et statut d'abonnement avant autres hypothèses.`,
    );
  }

  if (a === 'subscription_access') {
    lines.push(
      "### Chemin « accès lié à l'abonnement »",
      `- Plan : ${profile.subscription_plan ?? '—'}`,
      `- Statut abonnement : ${profile.subscription_status ?? '—'}`,
      `- Paiement : ${profile.payment_status ?? '—'}`,
      `- Si essai terminé ou paiement en échec, certaines automatisation peuvent être limitées (aligner sur politique commerciale / docs).`,
    );
  }

  return { tool: 'simulate_user_flow', label, success: true, summary: lines.join('\n') };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalUuid(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  return UUID_RE.test(s) ? s : null;
}

async function executeSubmitDevBacklog(
  admin: SupabaseClient,
  input: Record<string, string>,
  label: string
): Promise<ToolCallResult> {
  const title = (input.title ?? '').trim();
  const technical_summary = (input.technical_summary ?? '').trim();
  const suggested_fix = (input.suggested_fix ?? '').trim();
  const file_path = (input.file_path ?? '').trim() || null;
  const severityRaw = (input.severity ?? 'medium').trim().toLowerCase();
  const ticketId = optionalUuid(input.ticket_id);

  if (!title || !technical_summary || !suggested_fix) {
    return {
      tool: 'submit_dev_backlog',
      label,
      success: false,
      summary: 'Champs obligatoires : title, technical_summary, suggested_fix.',
    };
  }

  const severity = ['low', 'medium', 'high', 'critical'].includes(severityRaw) ? severityRaw : 'medium';

  const { data: row, error } = await admin
    .from('dev_backlog')
    .insert({
      source_ticket_id: ticketId,
      title: title.slice(0, 500),
      technical_summary: technical_summary.slice(0, 12000),
      suggested_fix: suggested_fix.slice(0, 12000),
      file_path: file_path ? file_path.slice(0, 1024) : null,
      severity,
    })
    .select('ticket_number')
    .single();

  if (error) {
    const code = 'code' in error ? String((error as { code: unknown }).code) : '';
    if (code === '42P01') {
      return {
        tool: 'submit_dev_backlog',
        label,
        success: false,
        summary: 'File technique indisponible (migration base non appliquée).',
      };
    }
    return { tool: 'submit_dev_backlog', label, success: false, summary: `Erreur : ${error.message}` };
  }

  const num = row?.ticket_number as number | undefined;
  return {
    tool: 'submit_dev_backlog',
    label,
    success: true,
    summary:
      `Rapport enregistré dans la file technique.\n` +
      `Référence dossier : #${num}\n` +
      `Vous pouvez indiquer au client que nos ingénieurs ont le dossier #${num} (formulation simple, sans détail interne).`,
  };
}

function normalizeAppApiPath(raw: string): string | null {
  let s = raw.trim().replace(/\\/g, '/');
  if (s.includes('..')) return null;
  if (s.startsWith('./')) s = s.slice(2);
  if (!s.startsWith('app/api/')) return null;
  if (!s.endsWith('.ts') && !s.endsWith('.tsx')) return null;
  return s;
}

function isPathInsideAppApi(absFile: string, cwd: string): boolean {
  const apiRoot = path.resolve(cwd, 'app', 'api');
  const rel = path.relative(apiRoot, absFile);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function executeCheckCodeLogic(
  admin: SupabaseClient,
  input: Record<string, string>,
  label: string
): Promise<ToolCallResult> {
  const rel = normalizeAppApiPath(input.relative_path ?? '');
  if (!rel) {
    return {
      tool: 'check_code_logic',
      label,
      success: false,
      summary:
        'Chemin invalide. Exemple attendu : app/api/health/route.ts (relatif, sans .., extension .ts ou .tsx).',
    };
  }

  const search = (input.search_phrase ?? '').trim();
  const cwd = process.cwd();
  const abs = path.resolve(cwd, rel);
  if (!isPathInsideAppApi(abs, cwd)) {
    return { tool: 'check_code_logic', label, success: false, summary: 'Chemin hors zone app/api.' };
  }

  const { data: chunks, error: chErr } = await admin
    .from('code_kb_chunks')
    .select('chunk_index, content')
    .eq('file_path', rel)
    .order('chunk_index', { ascending: true });

  let body: string;
  let source: string;

  if (!chErr && chunks && chunks.length > 0) {
    source = `Index RAG (${chunks.length} segment(s)) — ${rel}`;
    body = chunks.map((c) => `--- segment ${c.chunk_index} ---\n${c.content}`).join('\n\n');
  } else if (existsSync(abs)) {
    source = `Fichier local — ${rel}`;
    body = readFileSync(abs, 'utf8');
  } else {
    return {
      tool: 'check_code_logic',
      label,
      success: false,
      summary:
        `Aucun segment indexé pour ${rel} et fichier absent sur ce serveur. Vérifiez le chemin ou l'indexation code.`,
    };
  }

  if (search) {
    const lower = body.toLowerCase();
    const needle = search.toLowerCase();
    const idx = lower.indexOf(needle);
    if (idx === -1) {
      return {
        tool: 'check_code_logic',
        label,
        success: true,
        summary:
          `Source : ${source}\n` +
          `La phrase « ${search} » n'apparaît pas dans le contenu lu — élargir le fichier ou le terme.`,
      };
    }
    const start = Math.max(0, idx - 900);
    const end = Math.min(body.length, idx + search.length + 900);
    return {
      tool: 'check_code_logic',
      label,
      success: true,
      summary: `Source : ${source}\n\nExtrait autour de « ${search} » :\n\n${body.slice(start, end)}`,
    };
  }

  const max = 14000;
  const truncated = body.length > max;
  const snippet = truncated ? `${body.slice(0, max)}\n\n… [tronqué, ${body.length} caractères au total]` : body;
  return {
    tool: 'check_code_logic',
    label,
    success: true,
    summary: `Source : ${source}\n\n${snippet}`,
  };
}
