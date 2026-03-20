import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateText } from '@/lib/ai-service';
import { sendEmail } from '@/lib/resend';
import { getLegalUpdateEmailHtml } from '@/lib/emails/templates';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  cgu: "Conditions Générales d'Utilisation",
  politique_confidentialite: 'Politique de Confidentialité',
  mentions_legales: 'Mentions Légales',
};

function authCheck(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  return !!(secret && secret === process.env.ADMIN_SECRET);
}

/**
 * GET /api/admin/legal/ai-tools?document_type=cgu
 * Retourne la dernière version d'un document pour comparaison Sentinel.
 */
export async function GET(req: NextRequest) {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const documentType = searchParams.get('document_type');

  if (!documentType) {
    return NextResponse.json({ error: 'document_type requis' }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 500 });

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
 *   translate         — Traduit contenu et/ou résumé FR↔EN
 *   generate_email    — Transforme le résumé en email client pédagogue
 *   test_send         — Envoie un email de test à l'admin uniquement
 */
export async function POST(req: NextRequest) {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body as { action: string };

  // ── ACTION : generate_content ──────────────────────────────────────────────
  if (action === 'generate_content') {
    const { document_type, notes, existing_content } = body as {
      document_type: string;
      notes?: string;
      existing_content?: string;
    };

    const systemPrompt = `Tu es un juriste expert en droit du numérique et conformité RGPD pour une SaaS française (REPUTEXA, plateforme de gestion de réputation en ligne).

Tu rédiges des documents juridiques HTML professionnels, conformes et accessibles.

RÈGLES STRICTES :
- HTML sémantique structuré : h2, h3, p, ul, li, strong, em uniquement
- Ton sobre, juridique précis, compréhensible par un non-juriste
- Conformité RGPD complète avec toutes les mentions obligatoires
- Articles numérotés avec titres H2
- Commence directement par le contenu HTML — sans balises html/head/body ni doctype
- Langue : Français juridique standard`;

    const docLabel = DOCUMENT_TYPE_LABELS[document_type] || document_type;
    const userContent = `Génère un document "${docLabel}" HTML complet pour REPUTEXA.

REPUTEXA est une SaaS française de gestion de réputation en ligne pour les professionnels (hôtels, restaurants, commerces). Elle utilise l'IA pour générer des réponses aux avis Google et analyser la réputation.${notes ? `\n\nINSTRUCTIONS DE L'ADMIN :\n${notes}` : ''}${existing_content ? `\n\nCONTENU EXISTANT À AMÉLIORER/ENRICHIR :\n${existing_content.slice(0, 3000)}` : ''}

Génère le document HTML complet, structuré et conforme.`;

    try {
      const content = await generateText({
        systemPrompt,
        userContent,
        temperature: 0.3,
        maxTokens: 4096,
      });
      return NextResponse.json({ content });
    } catch (err) {
      console.error('[ai-tools] generate_content error:', err);
      return NextResponse.json({ error: 'Génération IA échouée. Vérifiez ANTHROPIC_API_KEY.' }, { status: 500 });
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

    const systemPrompt = `Tu es un juriste expert qui rédige des résumés clairs des changements de documents légaux pour les utilisateurs d'une SaaS.
Le résumé doit être compréhensible par un non-juriste, en français, en 2 à 4 phrases.
Ton pédagogue et rassurant. Cite les éléments concrets qui changent.`;

    const userContent = `Type de document : ${DOCUMENT_TYPE_LABELS[document_type] || document_type}${prev_content ? `\n\nANCIENNE VERSION (extrait) :\n${prev_content.slice(0, 1200)}` : ''}${content ? `\n\nNOUVELLE VERSION (extrait) :\n${content.slice(0, 2000)}` : ''}${existing_summary ? `\n\nRÉSUMÉ EXISTANT À AMÉLIORER :\n${existing_summary}` : ''}

Rédige un résumé concis et clair des changements pour les utilisateurs.`;

    try {
      const summary = await generateText({
        systemPrompt,
        userContent,
        temperature: 0.4,
        maxTokens: 512,
      });
      return NextResponse.json({ summary });
    } catch (err) {
      console.error('[ai-tools] generate_summary error:', err);
      return NextResponse.json({ error: 'Génération résumé échouée.' }, { status: 500 });
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

    if (!prev_content && !prev_summary) {
      return NextResponse.json({
        is_new: true,
        diff_summary: 'Premier document de ce type — aucune version précédente à comparer.',
        severity: 'low',
        rgpd_alert: false,
        key_changes: [],
      });
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

    const userContent = `Type de document : ${DOCUMENT_TYPE_LABELS[document_type] || document_type}

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
        temperature: 0.1,
        maxTokens: 1024,
      });

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return NextResponse.json({ is_new: false, ...analysis });
      }
      return NextResponse.json({
        is_new: false,
        diff_summary: raw.slice(0, 400),
        severity: 'medium',
        rgpd_alert: false,
        key_changes: [],
      });
    } catch (err) {
      console.error('[ai-tools] sentinel_analyze error:', err);
      return NextResponse.json({ error: 'Analyse Sentinel échouée.' }, { status: 500 });
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
    const systemPrompt = `Tu es un juriste traducteur expert en droit du numérique. Tu traduis des documents légaux avec précision juridique.
Traduis en ${langLabel}. Conserve la structure HTML si présente (balises h2, h3, p, ul, li).
Renvoie uniquement la traduction, sans aucun commentaire ni préambule.`;

    const results: { content?: string; summary?: string } = {};

    if (content?.trim()) {
      try {
        results.content = await generateText({
          systemPrompt,
          userContent: `Traduis ce document ${DOCUMENT_TYPE_LABELS[document_type] || document_type} en ${langLabel} :\n\n${content.slice(0, 8000)}`,
          temperature: 0.2,
          maxTokens: 4096,
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
          temperature: 0.2,
          maxTokens: 512,
        });
      } catch (err) {
        console.error('[ai-tools] translate summary error:', err);
      }
    }

    return NextResponse.json(results);
  }

  // ── ACTION : generate_email ────────────────────────────────────────────────
  if (action === 'generate_email') {
    const { document_type, summary, effective_date } = body as {
      document_type: string;
      summary: string;
      effective_date: string;
    };

    const systemPrompt = `Tu es un expert en communication client pour REPUTEXA, une SaaS française de gestion de réputation.
Tu transformes des résumés juridiques techniques en corps d'emails clients qui sont :
- Pédagogues : explique simplement ce qui change et pourquoi
- Rassurants : montre que l'entreprise agit dans l'intérêt du client
- Professionnels : ton chaleureux et sérieux, vouvoiement strict
- Concis : 3 à 4 paragraphes courts maximum

NE génère PAS de HTML. Génère du texte pur en paragraphes séparés par des lignes vides.
Structure : phrase d'accroche → explication du changement → réassurance → invitation à consulter le document.
N'inclus pas de formules de politesse d'ouverture ou de clôture (elles seront ajoutées automatiquement).`;

    const effectiveDateFormatted = new Date(effective_date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    const userContent = `Document mis à jour : ${DOCUMENT_TYPE_LABELS[document_type] || document_type}
Date d'entrée en vigueur : ${effectiveDateFormatted}
Résumé technique des changements : ${summary}

Génère le corps de l'email client (texte pur, sans formules d'ouverture/clôture).`;

    try {
      const emailText = await generateText({
        systemPrompt,
        userContent,
        temperature: 0.5,
        maxTokens: 800,
      });
      return NextResponse.json({ email_text: emailText });
    } catch (err) {
      console.error('[ai-tools] generate_email error:', err);
      return NextResponse.json({ error: 'Génération email échouée.' }, { status: 500 });
    }
  }

  // ── ACTION : test_send ─────────────────────────────────────────────────────
  if (action === 'test_send') {
    const { document_type, summary, effective_date } = body as {
      document_type: string;
      summary: string;
      effective_date: string;
    };

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      return NextResponse.json(
        { error: 'ADMIN_EMAIL non configuré dans les variables d\'environnement.' },
        { status: 500 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';
    const legalPageUrl = `${siteUrl.replace(/\/$/, '')}/fr/legal`;

    const effectiveDateFormatted = new Date(effective_date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    const html = getLegalUpdateEmailHtml({
      recipientName: 'Admin (Aperçu Test)',
      documentTypes: [document_type],
      summaryOfChanges: `[APERÇU TEST — Non envoyé aux utilisateurs]\n\n${summary}`,
      effectiveDate: effectiveDateFormatted,
      legalPageUrl,
    });

    const result = await sendEmail({
      to: adminEmail,
      subject: `[TEST APERÇU] Mise à jour ${DOCUMENT_TYPE_LABELS[document_type] || document_type}`,
      html,
    });

    if (result.success) {
      return NextResponse.json({ sent: true, to: adminEmail });
    } else {
      return NextResponse.json({ error: 'Envoi test échoué', details: result }, { status: 500 });
    }
  }

  return NextResponse.json({ error: `Action inconnue : ${action}` }, { status: 400 });
}
