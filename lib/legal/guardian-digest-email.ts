import { sendEmail } from '@/lib/resend';
import { getAdminComplianceNotifyEmail } from '@/lib/legal/admin-notify-email';
import type { SupabaseClient } from '@supabase/supabase-js';

type DigestKind = 'ok' | 'review_needed' | 'error' | 'filtered';

/**
 * Un seul destinataire : compte admin / ADMIN_COMPLIANCE_EMAIL / ADMIN_EMAIL (pas les marchands).
 */
export async function sendLegalGuardianAdminDigest(
  admin: SupabaseClient,
  params: {
    kind: DigestKind;
    summary: string;
    draftId?: string;
    sourcesCount?: number;
    errorDetail?: string;
    /** Bloc HTML optionnel sous « Bonjour » (ex. alerte locale vs UE). */
    htmlLead?: string;
    /** Aperçu texte du fragment HTML proposé (déjà nettoyé côté appelant). */
    draftTextPreview?: string;
  }
): Promise<{ sent: boolean }> {
  if (process.env.LEGAL_GUARDIAN_SILENT_ALL === '1') {
    return { sent: false };
  }

  const to = await getAdminComplianceNotifyEmail(admin);
  if (!to) {
    console.warn(
      '[guardian-digest-email] Aucun destinataire : définissez ADMIN_COMPLIANCE_EMAIL, ADMIN_EMAIL ou SENTINEL_ALERT_EMAIL, ou un profil admin avec email Auth.'
    );
    return { sent: false };
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://reputexa.fr'
  ).replace(/\/$/, '');
  const adminLocale = (process.env.ADMIN_PANEL_LOCALE ?? 'fr').replace(/^\/+|\/+$/g, '') || 'fr';
  const complianceUrl = `${siteUrl}/${adminLocale}/dashboard/admin/compliance`;
  const adminLegalUrl = `${siteUrl}/${adminLocale}/dashboard/admin`;
  /** Lien direct vers le bloc « Importer le brouillon Guardian » (connexion admin requise). */
  const adminGuardianAnchor = `${adminLegalUrl}#legal-guardian-draft`;

  const subj =
    params.kind === 'review_needed'
      ? '[REPUTEXA] Projet de mise à jour conformité prêt — ouvrir l’admin'
      : params.kind === 'error'
        ? '[REPUTEXA Guardian] Erreur lors du cycle'
        : params.kind === 'filtered'
          ? '[REPUTEXA Guardian] Cycle OK — alerte IA non confirmée'
          : '[REPUTEXA Guardian] Veille hebdomadaire — RAS';

  const src =
    typeof params.sourcesCount === 'number'
      ? `<p style="color:#64748b;font-size:12px">Sources agrégées (Tavily) : ~${params.sourcesCount}</p>`
      : '';

  const previewBlock =
    params.kind === 'review_needed' && params.draftTextPreview?.trim()
      ? `<div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
<p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#334155">Aperçu texte (extrait du brouillon — tout est aussi dans l’admin)</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#1e293b;white-space:pre-wrap">${escapeHtml(params.draftTextPreview.trim().slice(0, 4000))}</p>
</div>`
      : '';

  const draftCta =
    params.draftId && params.kind === 'review_needed'
      ? `${previewBlock}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="border-radius:10px;background:#7c3aed">
<a href="${adminGuardianAnchor}" style="display:inline-block;padding:14px 22px;font-weight:700;font-size:14px;color:#faf5ff;text-decoration:none">Ouvrir l’admin — brouillon Guardian</a>
</td></tr></table>
<p style="font-size:13px"><strong>Brouillon</strong> <span style="font-family:monospace">${escapeHtml(params.draftId.slice(0, 8))}…</span> — après connexion : cliquez sur <em>Importer le brouillon dans ce formulaire</em>, relisez puis poursuivez la publication (CGU / politique).</p>
<p style="font-size:12px;color:#64748b"><strong>Double avis IA :</strong> Claude (proposition) + GPT-4o (revérification) — vous validez en dernier.</p>
<p style="font-size:12px;color:#64748b">L’approbation finale reste dans l’interface admin : ce lien ne publie rien sans votre action.</p>`
      : '';

  const draft =
    params.draftId && params.kind === 'review_needed'
      ? draftCta +
        `<p style="font-size:13px">Accès général : <a href="${adminLegalUrl}">Panel admin</a> · <a href="${complianceUrl}">Compliance</a></p>`
      : '';

  const err =
    params.kind === 'error' && params.errorDetail
      ? `<p style="color:#b91c1c"><strong>Détail :</strong> ${escapeHtml(params.errorDetail.slice(0, 800))}</p>`
      : '';

  const lead = params.htmlLead ?? '';
  const complianceFooter =
    params.kind === 'review_needed' && params.draftId
      ? ''
      : `<p><a href="${complianceUrl}">Tableau Compliance</a> — preuves, zones, vérification brouillon.</p>`;

  const body = `<p>Bonjour,</p>
${lead}
<p>${escapeHtml(params.summary.slice(0, 900))}</p>
${src}
${draft}
${err}
${complianceFooter}
<p style="color:#94a3b8;font-size:11px;margin-top:20px">Envoi réservé admin — cycle automatique (Claude + GPT-4o + recherche web).</p>`;

  const r = await sendEmail({ to, subject: subj, html: body });
  if (!r.success) {
    console.warn('[guardian-digest-email] Resend:', r.error ?? 'échec envoi');
  }
  return { sent: r.success };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
