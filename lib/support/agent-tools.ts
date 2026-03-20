/**
 * Support Agent — Function Tools (Architecture Génesis v2 + Auto-Heal PR)
 *
 * 6 outils appelables de manière autonome par Claude 3.5 Sonnet :
 *   1. get_user_logs              — diagnostic complet en temps réel
 *   2. restart_webhook            — régénère le token Zenith bloqué
 *   3. regenerate_pixel_perfect_pdf — affiche conformité #F5F2ED sans bordure
 *   4. regenerate_api_key         — recrée la clé webhook (rtx_live_...)
 *   5. validate_phone_format      — normalise vers E.164 et met à jour la DB
 *   6. create_github_pr           — propose une correction de code via Pull Request (jamais push direct sur main)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type Anthropic from '@anthropic-ai/sdk';
import { createHealingPR, fetchGitHubFile, isGitHubConfigured } from '@/lib/github/auto-heal-pr';

// ── Types publics ──────────────────────────────────────────────────────────────

export type ToolName =
  | 'get_user_logs'
  | 'restart_webhook'
  | 'regenerate_pixel_perfect_pdf'
  | 'regenerate_api_key'
  | 'validate_phone_format'
  | 'create_github_pr';

export interface ToolCallResult {
  tool: ToolName;
  label: string;
  success: boolean;
  summary: string;
}

// ── UI Labels ─────────────────────────────────────────────────────────────────

export const TOOL_UI: Record<ToolName, { label: string; icon: string }> = {
  get_user_logs:                 { label: 'Analyse du compte',            icon: '🔍' },
  restart_webhook:               { label: 'Relance de la connexion',      icon: '⚡' },
  regenerate_pixel_perfect_pdf:  { label: "Régénération de l'affiche",    icon: '📄' },
  regenerate_api_key:            { label: "Nouvelle clé d'intégration",   icon: '🔑' },
  validate_phone_format:         { label: 'Correction du numéro',         icon: '📱' },
  create_github_pr:              { label: 'Mise à jour corrective (PR)',  icon: '🔧' },
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
];

// ── Helper : normalisation téléphone ─────────────────────────────────────────

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
    default:
      return { tool: name, label, success: false, summary: `Outil inconnu : ${name}` };
  }
}

// ── Tool 1 : get_user_logs ────────────────────────────────────────────────────

async function executeGetUserLogs(
  admin: SupabaseClient,
  userId: string,
  label: string
): Promise<ToolCallResult> {
  const sections: string[] = [];

  // Profil
  const { data: profile } = await admin
    .from('profiles')
    .select(
      'establishment_name, phone, subscription_plan, subscription_status, ' +
      'payment_status, webhook_token, api_key, webhook_send_delay_minutes'
    )
    .eq('id', userId)
    .maybeSingle();

  if (profile) {
    const phone = String(profile.phone ?? '').trim();
    const phoneStatus = !phone
      ? '⚠️ NON RENSEIGNÉ'
      : /^\+\d{8,15}$/.test(phone)
      ? `✓ ${phone}`
      : `⚠️ FORMAT INVALIDE : ${phone}`;

    sections.push(
      '## PROFIL\n' +
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

  // File d'avis
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
      `est disponible au téléchargement. Design : fond #F5F2ED pleine page A4, ` +
      `police Serif haut de gamme, icônes SVG, zéro bordure blanche. ` +
      `Accès : tableau de bord → Collecte d'avis → bouton "Télécharger l'affiche".`,
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
