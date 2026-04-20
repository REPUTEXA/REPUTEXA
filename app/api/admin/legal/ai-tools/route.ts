import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateText, hasAiConfigured } from '@/lib/ai-service';
import { sendEmail } from '@/lib/resend';
import { getLegalUpdateEmailHtml } from '@/lib/emails/templates';
import {
  LEGAL_AI_DISCLAIMER_BLOCK,
  LEGAL_AI_EXCELLENCE_BLOCK,
  buildGenerateContentUserMessage,
} from '@/lib/legal/ai-document-prompts';
import { getLegalPublisherContextBlock, getLegalPublishEnvStatus } from '@/lib/legal/legal-publish-env';
import {
  buildEffectiveAtIso,
  formatLegalEffectiveUtcDisplay,
  LEGAL_DEFAULT_EFFECTIVE_TIME_UTC,
  parseTimeUtcHm,
} from '@/lib/legal/dates';
import { appendProductContextSection } from '@/lib/admin/product-ai-context';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

const STANDALONE_DOC_SLICE = 14_000;

type AdminT = ReturnType<typeof apiAdminT>;

function documentTypeLabel(ta: AdminT, document_type: string): string {
  if (document_type === 'cgu') return ta('legalAiDocLabelCgu');
  if (document_type === 'politique_confidentialite') return ta('legalAiDocLabelPrivacy');
  if (document_type === 'mentions_legales') return ta('legalAiDocLabelLegalNotice');
  return document_type;
}

type SentinelSelfReviewItem = { question: string; assessment: string; risk: 'low' | 'medium' | 'high' };

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeSentinelPayload(
  analysis: Record<string, unknown>,
  isNew: boolean,
  ta: AdminT
): {
  is_new: boolean;
  diff_summary: string;
  severity: string;
  rgpd_alert: boolean;
  rgpd_details: string | null;
  key_changes: string[];
  self_review_qa: SentinelSelfReviewItem[];
} {
  const sev = analysis.severity;
  const severity =
    sev === 'low' || sev === 'medium' || sev === 'high' || sev === 'critical' ? sev : 'medium';

  let self_review_qa: SentinelSelfReviewItem[] = [];
  const rawQa = analysis.self_review_qa;
  if (Array.isArray(rawQa)) {
    self_review_qa = rawQa
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const o = item as Record<string, unknown>;
        const question = typeof o.question === 'string' ? o.question.trim() : '';
        const assessment = typeof o.assessment === 'string' ? o.assessment.trim() : '';
        const r = o.risk;
        const risk: 'low' | 'medium' | 'high' =
          r === 'low' || r === 'medium' || r === 'high' ? r : 'medium';
        if (!question && !assessment) return null;
        return { question: question || '(question)', assessment, risk };
      })
      .filter((x): x is SentinelSelfReviewItem => x != null);
  }

  const rawKeys = analysis.key_changes;
  const key_changes = Array.isArray(rawKeys)
    ? rawKeys.map((k) => (typeof k === 'string' ? k : '')).filter(Boolean)
    : [];

  return {
    is_new: isNew,
    diff_summary:
      typeof analysis.diff_summary === 'string'
        ? analysis.diff_summary
        : ta('legalAiSentinelUnstructuredFallback'),
    severity,
    rgpd_alert: analysis.rgpd_alert === true,
    rgpd_details:
      typeof analysis.rgpd_details === 'string' && analysis.rgpd_details.trim()
        ? analysis.rgpd_details.trim()
        : null,
    key_changes,
    self_review_qa,
  };
}

/** Modèle Claude dédié publication légale (optionnel, sinon modèle par défaut du projet). */
const LEGAL_ANTHROPIC_MODEL = process.env.LEGAL_ANTHROPIC_MODEL?.trim();

const AI_ACTIONS = new Set([
  'generate_content',
  'generate_summary',
  'sentinel_analyze',
  'sentinel_apply_fixes',
  'translate',
  'generate_email',
]);

function authCheck(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  return !!(secret && secret === process.env.ADMIN_SECRET);
}

/**
 * GET /api/admin/legal/ai-tools?document_type=cgu
 * Retourne la dernière version d'un document pour comparaison Sentinel.
 */
export async function GET(req: NextRequest) {
  const ta = apiAdminT();
  if (!authCheck(req)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  /** État des clés API (runtime serveur — Vercel / .env), sans appeler Cursor. */
  if (searchParams.get('health') === '1') {
    const env = getLegalPublishEnvStatus();
    return NextResponse.json({
      aiConfigured: hasAiConfigured(),
      anthropicConfigured: !!process.env.ANTHROPIC_API_KEY?.trim(),
      openaiConfigured: !!process.env.OPENAI_API_KEY?.trim(),
      legalAnthropicModel: LEGAL_ANTHROPIC_MODEL || null,
      legalPublisherEnvFilled: env.filledCount,
      siteUrl: env.siteUrl,
    });
  }

  const documentType = searchParams.get('document_type');

  if (!documentType) {
    return NextResponse.json({ error: ta('legalAiDocumentTypeRequired') }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: ta('legalAiDbNotConfigured') }, { status: 500 });

  const { data } = await supabase
    .from('legal_versioning')
    .select('id, version, content, summary_of_changes, effective_date, status')
    .eq('document_type', documentType)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ latest: data ?? null });
}

/**
 * POST /api/admin/legal/ai-tools
 *
 * Actions disponibles :
 *   generate_content  — Génère le HTML complet du document via Claude
 *   generate_summary  — Améliore le résumé des changements
 *   sentinel_analyze  — Analyse diff + sévérité + alerte RGPD
 *   sentinel_apply_fixes — Applique brief utilisateur + rapport Sentinel au document HTML
 *   translate         — Traduit contenu et/ou résumé FR↔EN
 *   generate_email    — Transforme le résumé en email client pédagogue
 *   test_send         — Envoie un email de test à l'admin uniquement
 */
export async function POST(req: NextRequest) {
  const ta = apiAdminT();
  if (!authCheck(req)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const { action } = body as { action: string };

  // ── ACTION : generate_content ──────────────────────────────────────────────
  if (action === 'generate_content') {
    const { document_type, notes, existing_content } = body as {
      document_type: string;
      notes?: string;
      existing_content?: string;
    };

    const systemPrompt = `Tu es un juriste spécialisé en droit du numérique français et en rédaction de documents contractuels pour l'éditeur d'une plateforme SaaS B2B (REPUTEXA).

${LEGAL_AI_DISCLAIMER_BLOCK}

${LEGAL_AI_EXCELLENCE_BLOCK}

RÈGLES DE FORMATION DU DOCUMENT :
- HTML sémantique uniquement : h2, h3, p, ul, ol, li, strong, em (pas de script, pas de iframe, pas de style inline sauf si indispensable pour emphase ponctuelle).
- Chaque section importante commence par un titre en h2 ; sous-parties en h3 si nécessaire.
- Numérotation ou intitulés clairs pour les clauses ; listes à puces pour les obligations et interdits.
- Langue : français juridique courant, précis, sans familiarité.
- Adapte le niveau de détail RGPD au type de document : exigence maximale pour une politique de confidentialité ; pas de copier-coller intégral de la politique dans les CGU ou les mentions légales.
- Commence directement par le contenu HTML du corps — sans <!DOCTYPE>, sans <html>, <head> ou <body>.`;

    const docLabel = documentTypeLabel(ta, document_type);
    const userContent = appendProductContextSection(
      buildGenerateContentUserMessage({
        docLabel,
        documentType: document_type,
        notes: typeof notes === 'string' ? notes : undefined,
        existingContent: typeof existing_content === 'string' ? existing_content : undefined,
        publisherContextBlock: getLegalPublisherContextBlock(),
      }),
      8_000
    );

    try {
      const content = await generateText({
        systemPrompt,
        userContent,
        temperature: 0.22,
        maxTokens: 8192,
        anthropicModel: LEGAL_ANTHROPIC_MODEL,
      });
      return NextResponse.json({ content });
    } catch (err) {
      console.error('[ai-tools] generate_content error:', err);
      return NextResponse.json(
        {
          error: ta('legalAiGenerationFailed'),
        },
        { status: 500 }
      );
    }
  }

  // ── ACTION : generate_summary ──────────────────────────────────────────────
  if (action === 'generate_summary') {
    const { document_type, content, existing_summary, prev_content } = body as {
      document_type: string;
      content?: string;
      existing_summary?: string;
      prev_content?: string;
    };

    const systemPrompt = `Tu rédiges des résumés d'évolution de documents légaux pour des utilisateurs professionnels d'une application SaaS (REPUTEXA).

Exigences :
- Français, vouvoiement implicite ou neutre (« nous mettons à jour », « vos données »).
- 2 à 5 phrases courtes, sans jargon inutile ; si un terme juridique est nécessaire, il doit être compréhensible.
- Mentionner ce qui change concrètement (droits, durées, finalités, obligations, contact).
- Ne pas inventer de faits non présents dans les extraits fournis ni dans le CONTEXTE DÉPÔT si tu t’y réfères.
- Ton professionnel et rassurant, sans marketing excessif.`;

    const userContent = appendProductContextSection(
      `Type de document : ${documentTypeLabel(ta, document_type)}${prev_content ? `\n\nANCIENNE VERSION (extrait) :\n${prev_content.slice(0, 1200)}` : ''}${content ? `\n\nNOUVELLE VERSION (extrait) :\n${content.slice(0, 2000)}` : ''}${existing_summary ? `\n\nRÉSUMÉ EXISTANT À AMÉLIORER :\n${existing_summary}` : ''}

Rédige le résumé des changements pour l'email et la modale de consentement. Texte brut, sans HTML.
Le CONTEXTE DÉPÔT peut aider à nommer des fonctionnalités produit si la nouvelle version y fait référence ; sinon ignore-le.`,
      7_000
    );

    try {
      const summary = await generateText({
        systemPrompt,
        userContent,
        temperature: 0.35,
        maxTokens: 640,
        anthropicModel: LEGAL_ANTHROPIC_MODEL,
      });
      return NextResponse.json({ summary });
    } catch (err) {
      console.error('[ai-tools] generate_summary error:', err);
      return NextResponse.json({ error: ta('legalAiSummaryGenerateFailed') }, { status: 500 });
    }
  }

  // ── ACTION : sentinel_analyze ──────────────────────────────────────────────
  if (action === 'sentinel_analyze') {
    const { document_type, new_content, new_summary, prev_content, prev_summary } = body as {
      document_type: string;
      new_content?: string;
      new_summary?: string;
      prev_content?: string;
      prev_summary?: string;
    };

    const hasPrev = !!(prev_content?.trim() || prev_summary?.trim());
    const docLabel = documentTypeLabel(ta, document_type);
    const publisherBlock = getLegalPublisherContextBlock();

    if (!hasPrev) {
      if (!hasAiConfigured()) {
        return NextResponse.json(
          {
            error: ta('legalAiNoApiKeyForReview'),
          },
          { status: 503 }
        );
      }

      const systemPrompt = `Tu es un comité de relecture juridique et conformité (RGPD / droit français / bonnes pratiques SaaS B2B) pour l’éditeur REPUTEXA.
Il n’existe AUCUNE version publiée antérieure de ce document : tu fais une REVUE DE FOND complète, pas une comparaison de diff.

⚠️ Tu es un outil d’aide : tu ne remplaces pas un avocat ni un DPO. Tu signaleras explicitement le besoin de validation humaine si nécessaire.

MÉTHODE OBLIGATOIRE — auto-interrogation professionnelle :
1) Enchaîne mentalement ces angles (tu peux les citer dans ton raisonnement interne puis les condenser dans la sortie) :
   - RGPD & données personnelles (si pertinent pour ce type de document) : bases légales, finalités, droits, sous-traitants, transferts hors UE, durées, mineurs, profilage / IA ;
   - Cohérence interne du texte (contradictions, définitions, renvois) ;
   - Adéquation du contenu au TYPE de document (CGU vs politique de confidentialité vs mentions légales — ne pas exiger dans un type ce qui relève d’un autre) ;
   - Placeholders & artéfacts : [À compléter], « … », exemples localhost, dates factices, Lorem, champs vides ;
   - Risques réputationnels ou abus manifestes (clauses disproportionnées visibles dans le texte).

2) Formule 6 à 10 QUESTIONS critiques qu’un juriste ou un DPO se poserait sur CE texte (une phrase par question, précise).

3) Pour chaque question, réponds en 1 à 3 phrases : verdict clair (point OK, vigilance, ou risque) en t’appuyant UNIQUEMENT sur le texte et le contexte fourni — n’invente pas de faits sur l’entreprise au-delà du bloc « contexte éditeur ».

SÉVÉRITÉ globale (appréciation du manuscrit, pas d’un « diff ») :
- "low" : manuscrit globalement solide ; résiduels mineurs (style, typos, détails) ;
- "medium" : lacunes ou ambiguïtés à corriger avant publication professionnelle ;
- "high" : trous importants, contradictions, ou sujets sensibles non traités correctement sans relecture humaine ;
- "critical" : problème majeur (ex. politique de confidentialité vide / quasi vide de fondements RGPD, placeholders critiques partout, clauses manifestement incohérentes avec le reste).

rgpd_alert = true si le texte traite de données personnelles ET qu’au moins un point sérieux est identifié (droits absents, bases floues, durées absentes pour une politique confidentialité, etc.).

Réponds UNIQUEMENT en JSON valide :
{
  "diff_summary": "Synthèse en 3 à 6 phrases : forces, faiblesses, et recommandation explicite de validation humaine si pertinent",
  "severity": "low" | "medium" | "high" | "critical",
  "rgpd_alert": true | false,
  "rgpd_details": "string ou null",
  "key_changes": ["5 à 14 puces courtes : forces, lacunes, actions recommandées avant publication"],
  "self_review_qa": [
    { "question": "...", "assessment": "...", "risk": "low" | "medium" | "high" }
  ]
}`;

      const bodySlice = (new_content || '').slice(0, STANDALONE_DOC_SLICE);
      const truncated = (new_content || '').length > STANDALONE_DOC_SLICE;

      const userContent = `Type de document : ${docLabel}

CONTEXTE ÉDITEUR (variables serveur LEGAL_* — t’en servir pour contextualiser les questions, sans extrapoler au-delà) :
${publisherBlock || '(aucune variable LEGAL_* renseignée)'}

RÉSUMÉ PROPOSÉ POUR CETTE VERSION (peut être vide) :
${new_summary?.trim() || '(non fourni)'}

CONTENU DU DOCUMENT (extrait analysé${truncated ? ` — tronqué aux ${STANDALONE_DOC_SLICE} premiers caractères ; le reste n’a pas été lu par le modèle` : ''}) :
${bodySlice || '(contenu vide — signale critical et liste les problèmes)'}

Exécute la revue de fond et retourne le JSON Sentinel.`;

      try {
        const raw = await generateText({
          systemPrompt,
          userContent,
          temperature: 0.09,
          maxTokens: 4096,
          anthropicModel: LEGAL_ANTHROPIC_MODEL,
        });
        const parsed = extractJsonObject(raw);
        if (parsed) {
          return NextResponse.json(normalizeSentinelPayload(parsed, true, ta));
        }
        return NextResponse.json(
          normalizeSentinelPayload(
            {
              diff_summary: raw.slice(0, 600),
              severity: 'medium',
              rgpd_alert: false,
              key_changes: [ta('legalAiSentinelInvalidJsonBullet')],
              self_review_qa: [],
            },
            true,
            ta
          )
        );
      } catch (err) {
        console.error('[ai-tools] sentinel_analyze (standalone) error:', err);
        return NextResponse.json({ error: ta('legalAiSentinelFirstFailed') }, { status: 500 });
      }
    }

    const systemPrompt = `Tu es un analyste juridique expert en conformité RGPD et droit du numérique français.
Tu analyses les différences entre deux versions d'un document légal et évalues leur impact.

CRITÈRES DE SÉVÉRITÉ :
- "low" : changements rédactionnels mineurs, clarifications de style, corrections orthographiques
- "medium" : modifications de processus internes, ajouts de clauses non critiques, précisions
- "high" : changements importants sur les droits utilisateurs, modifications des délais de traitement, ajout de sous-traitants
- "critical" : modifications fondamentales des droits RGPD, suppression de protections, transferts hors UE non justifiés

ALERTE RGPD si l'une de ces situations est détectée :
- Changement dans la collecte ou le traitement de données personnelles
- Modification des durées de conservation
- Nouveaux cookies ou traceurs
- Modification des droits des utilisateurs (accès, suppression, portabilité)
- Ajout ou changement de sous-traitants de données
- Transferts de données hors UE

Réponds UNIQUEMENT en JSON valide avec cette structure :
{
  "diff_summary": "Résumé concis des changements en 2-3 phrases",
  "severity": "low" | "medium" | "high" | "critical",
  "rgpd_alert": true | false,
  "rgpd_details": "Explication détaillée si rgpd_alert est true, null sinon",
  "key_changes": ["changement 1", "changement 2"]
}`;

    const userContent = `Type de document : ${documentTypeLabel(ta, document_type)}

ANCIENNE VERSION — Résumé : ${prev_summary || '(non disponible)'}
ANCIENNE VERSION — Contenu (extrait) :
${(prev_content || '').slice(0, 2000)}

NOUVELLE VERSION — Résumé : ${new_summary || '(non disponible)'}
NOUVELLE VERSION — Contenu (extrait) :
${(new_content || '').slice(0, 2000)}

Analyse les changements et retourne le JSON d'analyse Sentinel.`;

    try {
      const raw = await generateText({
        systemPrompt,
        userContent,
        temperature: 0.08,
        maxTokens: 2048,
        anthropicModel: LEGAL_ANTHROPIC_MODEL,
      });

      const parsed = extractJsonObject(raw);
      if (parsed) {
        return NextResponse.json(normalizeSentinelPayload(parsed, false, ta));
      }
      return NextResponse.json(
        normalizeSentinelPayload(
          {
            diff_summary: raw.slice(0, 400),
            severity: 'medium',
            rgpd_alert: false,
            key_changes: [],
            self_review_qa: [],
          },
          false,
          ta
        )
      );
    } catch (err) {
      console.error('[ai-tools] sentinel_analyze error:', err);
      return NextResponse.json({ error: ta('legalAiSentinelAnalyzeFailed') }, { status: 500 });
    }
  }

  // ── ACTION : sentinel_apply_fixes ───────────────────────────────────────────
  if (action === 'sentinel_apply_fixes') {
    const { document_type, content, correction_brief, sentinel_report } = body as {
      document_type: string;
      content?: string;
      correction_brief?: string;
      sentinel_report?: string;
    };

    if (!content?.trim()) {
      return NextResponse.json({ error: ta('legalAiDocumentContentRequired') }, { status: 400 });
    }
    if (!correction_brief?.trim()) {
      return NextResponse.json(
        { error: ta('legalAiUserBriefRequired') },
        { status: 400 }
      );
    }

    if (!hasAiConfigured()) {
      return NextResponse.json(
        {
          error: ta('legalAiNoApiKeyForApply'),
        },
        { status: 503 }
      );
    }

    const docLabel = documentTypeLabel(ta, document_type);
    const publisherBlock = getLegalPublisherContextBlock();
    const MAX_IN = 100_000;
    const bodyHtml = content.trim().slice(0, MAX_IN);
    const truncatedIn = content.trim().length > MAX_IN;

    let reportBlock = '';
    if (sentinel_report?.trim()) {
      try {
        const j = JSON.parse(sentinel_report) as {
          diff_summary?: string;
          key_changes?: unknown;
          rgpd_details?: string | null;
          self_review_qa?: unknown;
        };
        const kc = Array.isArray(j.key_changes)
          ? j.key_changes.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
          : [];
        const qa = Array.isArray(j.self_review_qa)
          ? j.self_review_qa
              .map((item) => {
                if (!item || typeof item !== 'object') return '';
                const o = item as Record<string, unknown>;
                const q = typeof o.question === 'string' ? o.question : '';
                const a = typeof o.assessment === 'string' ? o.assessment : '';
                return q || a ? `- Q: ${q}\n  → ${a}` : '';
              })
              .filter(Boolean)
              .join('\n')
          : '';

        reportBlock = `RAPPORT SENTINEL (checklist — corrige tout ce que le brief permet ; ne contredit pas le brief) :
Synthèse : ${j.diff_summary ?? ''}
RGPD (détails) : ${j.rgpd_details ?? ''}
Points saillants :
${kc.map((x) => `- ${x}`).join('\n')}
${qa ? `\nAuto-interrogation (extraits) :\n${qa}` : ''}`;
      } catch {
        reportBlock = `RAPPORT SENTINEL (texte) :\n${sentinel_report.trim().slice(0, 12_000)}`;
      }
    }

    const systemPrompt = `Tu es un juriste documentaliste spécialisé dans la mise à jour de documents légaux HTML pour REPUTEXA (SaaS B2B).

${LEGAL_AI_DISCLAIMER_BLOCK}

MISSION :
- Reçoit le document HTML actuel et un BRIEF UTILISATEUR avec les informations factuelles à intégrer.
- Applique les corrections : placeholders, URL de dev (localhost), coordonnées, sous-traitants nommés dans le brief, etc.
- Sers-toi du rapport Sentinel (s’il est fourni) comme liste de contrôle pour ne rien oublier que le brief permet de traiter.

RÈGLES STRICTES :
1) N’invente AUCUNE donnée légale, financière ou d’identité qui n’apparaît pas dans le brief utilisateur, le CONTEXTE ÉDITEUR, ou le texte déjà présent et non-placeholder.
2) Si une donnée manque encore après brief + contexte, garde « [À compléter : …] » avec une indication courte.
3) Remplace http://localhost:3000, http://127.0.0.1, etc. par l’URL publique si elle figure dans le brief ou le contexte éditeur ; sinon « [À compléter : URL de production] ».
4) Préserve la structure HTML (h2, h3, p, ul, ol, li, strong, em, a). Pas de script ni style inline systématique. Pas de <!DOCTYPE>, <html>, <head>, <body>.
5) Réponds avec le document HTML COMPLET uniquement — aucun préambule, aucune explication, pas de bloc markdown.`;

    const userContent = `Type de document : ${docLabel}
${truncatedIn ? `\n⚠️ Entrée tronquée aux ${MAX_IN} premiers caractères côté serveur.\n` : ''}

CONTEXTE ÉDITEUR :
${publisherBlock}

${reportBlock ? `${reportBlock}\n\n` : ''}
BRIEF UTILISATEUR (informations à injecter — prioritaires sur les placeholders) :
${correction_brief.trim()}

DOCUMENT HTML ACTUEL :
${bodyHtml}`;

    try {
      const out = await generateText({
        systemPrompt,
        userContent,
        temperature: 0.12,
        maxTokens: 16384,
        anthropicModel: LEGAL_ANTHROPIC_MODEL,
      });
      let fixed = out.trim();
      if (fixed.startsWith('```')) {
        fixed = fixed.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '');
      }
      return NextResponse.json({ content: fixed });
    } catch (err) {
      console.error('[ai-tools] sentinel_apply_fixes error:', err);
      return NextResponse.json({ error: ta('legalAiSentinelApplyFailed') }, { status: 500 });
    }
  }

  // ── ACTION : translate ─────────────────────────────────────────────────────
  if (action === 'translate') {
    const { content, summary, target_language, document_type } = body as {
      content?: string;
      summary?: string;
      target_language: 'en' | 'fr';
      document_type: string;
    };

    const langLabel = target_language === 'en' ? 'anglais' : 'français';
    const systemPrompt = `Tu es un traducteur juridique (droits français / UE vers ${langLabel === 'anglais' ? 'anglais juridique (UK ou US cohérent)' : 'français juridique'}).
Conserve la structure HTML (h2, h3, p, ul, ol, li, strong, em). Ne traduis pas les noms propres REPUTEXA, ni les références « RGPD », « GDPR », « CNIL » lorsque c'est l'usage (tu peux ajouter l'équivalent entre parenthèses une seule fois si utile).
Précision terminologique (données personnelles, responsable de traitement, sous-traitant, etc.).
Renvoie uniquement la traduction, sans préambule ni balises markdown.`;

    const results: { content?: string; summary?: string } = {};

    if (content?.trim()) {
      try {
        results.content = await generateText({
          systemPrompt,
          userContent: `Traduis ce document ${documentTypeLabel(ta, document_type)} en ${langLabel} :\n\n${content.slice(0, 8000)}`,
          temperature: 0.18,
          maxTokens: 8192,
          anthropicModel: LEGAL_ANTHROPIC_MODEL,
        });
      } catch (err) {
        console.error('[ai-tools] translate content error:', err);
      }
    }

    if (summary?.trim()) {
      try {
        results.summary = await generateText({
          systemPrompt,
          userContent: `Traduis ce résumé en ${langLabel} :\n\n${summary}`,
          temperature: 0.18,
          maxTokens: 640,
          anthropicModel: LEGAL_ANTHROPIC_MODEL,
        });
      } catch (err) {
        console.error('[ai-tools] translate summary error:', err);
      }
    }

    return NextResponse.json(results);
  }

  // ── ACTION : generate_email ────────────────────────────────────────────────
  if (action === 'generate_email') {
    const { document_type, summary, effective_date, effective_time_utc } = body as {
      document_type: string;
      summary: string;
      effective_date: string;
      effective_time_utc?: string;
    };

    const effTime =
      typeof effective_time_utc === 'string' && parseTimeUtcHm(effective_time_utc)
        ? effective_time_utc
        : LEGAL_DEFAULT_EFFECTIVE_TIME_UTC;
    let effectiveInstantLabel: string;
    try {
      effectiveInstantLabel = formatLegalEffectiveUtcDisplay(buildEffectiveAtIso(effective_date, effTime));
    } catch {
      effectiveInstantLabel = new Date(effective_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }

    const systemPrompt = `Tu es chargé de la communication clients pour REPUTEXA (SaaS B2B de gestion de réputation).

Transforme le résumé juridique en corps d'email clair pour des professionnels (restaurateurs, commerçants, gestionnaires) :
- Phrases courtes, peu de jargon ; vouvoiement « vous » systématique.
- Ton posé, transparent, sans langage publicitaire creux.
- Pédagogique : ce qui change, pourquoi la mise à jour, où lire le document complet.

3 à 5 paragraphes courts, séparés par une ligne vide. Pas de HTML. Pas de formules d'ouverture/clôture type « Bonjour » ou « Cordialement » (ajoutées par le template).
Structure conseillée : objet de la mise à jour → points concrets (droits, données, obligations si pertinent) → invitation à consulter le document.`;

    const userContent = appendProductContextSection(
      `Document mis à jour : ${documentTypeLabel(ta, document_type)}
Date et heure d'entrée en vigueur (UTC) : ${effectiveInstantLabel}
Résumé technique des changements : ${summary}

Génère le corps de l'email client (texte pur, sans formules d'ouverture/clôture).
Si le CONTEXTE DÉPÔT mentionne des livraisons produit cohérentes avec le résumé, tu peux les refléter en langage simple ; n’invente rien d’absent du résumé ou du contexte.`,
      6_000
    );

    try {
      const emailText = await generateText({
        systemPrompt,
        userContent,
        temperature: 0.45,
        maxTokens: 900,
        anthropicModel: LEGAL_ANTHROPIC_MODEL,
      });
      return NextResponse.json({ email_text: emailText });
    } catch (err) {
      console.error('[ai-tools] generate_email error:', err);
      return NextResponse.json({ error: ta('legalAiEmailGenerateFailed') }, { status: 500 });
    }
  }

  // ── ACTION : test_send ─────────────────────────────────────────────────────
  if (action === 'test_send') {
    const { document_type, summary, effective_date, effective_time_utc } = body as {
      document_type: string;
      summary: string;
      effective_date: string;
      effective_time_utc?: string;
    };

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      return NextResponse.json({ error: ta('legalAiAdminEmailEnvMissing') }, { status: 500 });
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';
    const legalPageUrl = `${siteUrl.replace(/\/$/, '')}/fr/legal`;

    const effTime =
      typeof effective_time_utc === 'string' && parseTimeUtcHm(effective_time_utc)
        ? effective_time_utc
        : LEGAL_DEFAULT_EFFECTIVE_TIME_UTC;
    let effectiveDateFormatted: string;
    try {
      effectiveDateFormatted = formatLegalEffectiveUtcDisplay(buildEffectiveAtIso(effective_date, effTime));
    } catch {
      effectiveDateFormatted = new Date(effective_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }

    const html = getLegalUpdateEmailHtml({
      recipientName: 'Admin (Aperçu Test)',
      documentTypes: [document_type],
      summaryOfChanges: `[APERÇU TEST — Non envoyé aux utilisateurs]\n\n${summary}`,
      effectiveDate: effectiveDateFormatted,
      legalPageUrl,
    });

    const result = await sendEmail({
      to: adminEmail,
      subject: `[TEST APERÇU] Mise à jour ${documentTypeLabel(ta, document_type)}`,
      html,
    });

    if (result.success) {
      return NextResponse.json({ sent: true, to: adminEmail });
    } else {
      return NextResponse.json({ error: ta('legalAiTestSendFailed'), details: result }, { status: 500 });
    }
  }

  return NextResponse.json({ error: ta('legalAiUnknownAction', { action: String(action) }) }, { status: 400 });
}
