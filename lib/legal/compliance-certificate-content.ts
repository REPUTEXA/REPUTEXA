/**
 * Textes du certificat de conformité « collecte d'avis » (PDF marchand).
 * Document informatif — ne remplace pas un audit juridique externe.
 *
 * Marché GB : cadre **UK GDPR + Data Protection Act 2018**, autorité **ICO**
 * (lien de plainte), et non le seul libellé « EU GDPR ».
 */

import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import type { PrivacyJurisdiction } from '@/lib/legal/privacy-jurisdiction';
import { EDPB_MEMBERS_URL_EN, ICO_COMPLAINT_URL } from '@/lib/legal/privacy-jurisdiction';

export type ComplianceCertificateStrings = {
  docTitle: string;
  subtitle: string;
  issuedFor: string;
  sectionPurpose: string;
  sectionPurposeBody: string;
  sectionStack: string;
  bulletConsent: string;
  bulletVersioning: string;
  bulletGuardian: string;
  bulletPoster: string;
  sectionLegalRef: string;
  versionLabel: string;
  /** Préfixe affiché devant le numéro de version (ex. « v »). */
  versionPrefix: string;
  effectiveLabel: string;
  guardianLabel: string;
  consentAcceptedLabel: string;
  sectionAuthorities: string;
  authoritiesBody: string;
  /** Libellé avant l’URL de politique (ex. « Politique : »). */
  policyUrlLabel: string;
  /** Lien clair vers plaintes ICO (UK) ou annuaire EDPB (UE). */
  authorityComplaintLine: string;
  disclaimer: string;
  footerGenerated: string;
};

type CertificateBase = Omit<ComplianceCertificateStrings, 'authorityComplaintLine'>;

const STRINGS: Record<string, CertificateBase> = {
  fr: {
    docTitle: 'Certificat de conformité — Collecte d’avis REPUTEXA',
    subtitle: 'Document de synthèse pour vos dossiers (RGPD / sensibilités locales)',
    issuedFor: 'Établissement / compte',
    sectionPurpose: '1. Objet',
    sectionPurposeBody:
      'Ce document atteste que le titulaire du compte utilise la plateforme REPUTEXA avec les mécanismes de conformité activés côté produit : traçabilité des consentements, versioning des documents légaux, et veille automatisée (Guardian). Il ne constitue pas une certification officielle d’un organisme tiers, mais une aide à la preuve de diligence.',
    sectionStack: '2. Mesures techniques et organisationnelles (aperçu)',
    bulletConsent: 'Journal des consentements (preuves horodatées) et bannière cookies maison.',
    bulletVersioning: 'Publication versionnée des politiques légales ; réacceptation utilisateurs à chaque version majeure.',
    bulletGuardian:
      'Veille périodique sur les autorités (EDPB, CNIL, Garante, AEPD, BfDI, ICO, Benelux, Nordics, PL, PT, etc.) avec journal d’audit en base.',
    bulletPoster: 'Affiches et ressources de transparence téléchargeables pour le point de vente.',
    sectionLegalRef: '3. Référence légale interne (instantané)',
    versionLabel: 'Version légale publiée (globale)',
    versionPrefix: 'v',
    effectiveLabel: 'Date d’effet',
    guardianLabel: 'Dernier passage Guardian (veille)',
    consentAcceptedLabel: 'Version acceptée dans votre espace marchand',
    sectionAuthorities: '4. Autorités de référence (non exhaustif)',
    authoritiesBody:
      'UE : EDPB. FR : CNIL. IT : Garante Privacy. ES : AEPD. DE : BfDI / LfD. UK : ICO. Benelux : AP/GBA. Nordics : IMY, Datatilsynet, etc. PL : UODO. PT : CNPD.',
    disclaimer:
      'REPUTEXA ne fournit pas de conseil juridique. Validez vos obligations avec un professionnel du droit compétent pour votre secteur et vos pays d’activité.',
    footerGenerated: 'Généré le',
    policyUrlLabel: 'Politique :',
  },
  en: {
    docTitle: 'Compliance certificate — REPUTEXA review collection',
    subtitle: 'Summary document for your records (GDPR / local expectations)',
    issuedFor: 'Establishment / account',
    sectionPurpose: '1. Purpose',
    sectionPurposeBody:
      'This document states that the account holder uses REPUTEXA with product-side compliance features: consent traceability, legal document versioning, and automated regulatory watch (Guardian). It is not an official third-party certification, but supports evidence of diligence.',
    sectionStack: '2. Technical and organisational measures (overview)',
    bulletConsent: 'Consent logs (timestamped evidence) and first-party cookie banner.',
    bulletVersioning: 'Versioned legal texts; users re-accept on major policy updates.',
    bulletGuardian:
      'Periodic monitoring of authorities (EDPB, CNIL, Garante, AEPD, BfDI, ICO, Benelux, Nordics, PL, PT, etc.) with database audit trail.',
    bulletPoster: 'Downloadable point-of-sale transparency materials.',
    sectionLegalRef: '3. Internal legal reference (snapshot)',
    versionLabel: 'Published legal version (global)',
    versionPrefix: 'v',
    effectiveLabel: 'Effective date',
    guardianLabel: 'Last Guardian regulatory check',
    consentAcceptedLabel: 'Version accepted in your merchant space',
    sectionAuthorities: '4. Reference authorities (non-exhaustive)',
    authoritiesBody:
      'EU: EDPB. FR: CNIL. IT: Garante. ES: AEPD. DE: BfDI / LfD. UK: ICO. Benelux: DPA/APD. Nordics: IMY, Datatilsynet, etc. PL: UODO. PT: CNPD.',
    disclaimer:
      'REPUTEXA does not provide legal advice. Validate your duties with qualified counsel for your sector and markets.',
    footerGenerated: 'Generated on',
    policyUrlLabel: 'Policy:',
  },
  es: {
    docTitle: 'Certificado de conformidad — Recogida de reseñas REPUTEXA',
    subtitle: 'Documento de síntesis (RGPD / autoridades locales)',
    issuedFor: 'Establecimiento / cuenta',
    sectionPurpose: '1. Objeto',
    sectionPurposeBody:
      'Este documento indica que la cuenta utiliza REPUTEXA con trazabilidad de consentimientos, versionado legal y vigilancia automática (Guardian). No sustituye certificación oficial ni asesoramiento jurídico.',
    sectionStack: '2. Medidas (resumen)',
    bulletConsent: 'Registros de consentimiento y banner de cookies propio.',
    bulletVersioning: 'Textos legales versionados; reaceptación ante cambios.',
    bulletGuardian:
      'Vigilancia sobre EDPB, CNIL, Garante, AEPD, BfDI, ICO, Benelux, nórdicos, PL, PT, con auditoría en base de datos.',
    bulletPoster: 'Recursos descargables para el punto de venta.',
    sectionLegalRef: '3. Referencia interna (instantánea)',
    versionLabel: 'Versión legal publicada',
    versionPrefix: 'v',
    effectiveLabel: 'Fecha de vigencia',
    guardianLabel: 'Última verificación Guardian',
    consentAcceptedLabel: 'Versión aceptada en su espacio',
    sectionAuthorities: '4. Autoridades (no exhaustivo)',
    authoritiesBody:
      'UE: EDPB. FR: CNIL. IT: Garante. ES: AEPD. DE: BfIDI/LfD. UK: ICO. Benelux: AP. Nórdicos: IMY, etc. PL: UODO. PT: CNPD.',
    disclaimer:
      'REPUTEXA no presta asesoramiento jurídico. Consulte a un profesional para su actividad.',
    footerGenerated: 'Generado el',
    policyUrlLabel: 'Política:',
  },
  it: {
    docTitle: 'Certificato di conformità — Raccolta recensioni REPUTEXA',
    subtitle: 'Documento di sintesi (RGPD / autorità locali)',
    issuedFor: 'Esercizio / account',
    sectionPurpose: '1. Oggetto',
    sectionPurposeBody:
      'Il documento attesta l’uso di REPUTEXA con tracciamento dei consensi, versioning dei testi legali e vigilanza Guardian. Non è certificazione ufficiale né parere legale.',
    sectionStack: '2. Misure (sintesi)',
    bulletConsent: 'Log dei consensi e banner cookie first-party.',
    bulletVersioning: 'Testi legali versionati; riaccettazione su aggiornamenti.',
    bulletGuardian:
      'Monitoraggio EDPB, CNIL, Garante, AEPD, BfDI, ICO, Benelux, nordici, PL, PT, con audit su database.',
    bulletPoster: 'Materiali scaricabili per il punto vendita.',
    sectionLegalRef: '3. Riferimento interno (istantanea)',
    versionLabel: 'Versione legale pubblicata',
    versionPrefix: 'v',
    effectiveLabel: 'Data di efficacia',
    guardianLabel: 'Ultimo controllo Guardian',
    consentAcceptedLabel: 'Versione accettata nel suo spazio',
    sectionAuthorities: '4. Autorità (non esaustivo)',
    authoritiesBody:
      'UE: EDPB. FR: CNIL. IT: Garante. ES: AEPD. DE: BfDI. UK: ICO. Benelux: AP. Nordici: IMY, ecc. PL: UODO. PT: CNPD.',
    disclaimer:
      'REPUTEXA non fornisce pareri legali. Rivolgersi a un professionista per il proprio caso.',
    footerGenerated: 'Generato il',
    policyUrlLabel: 'Informativa:',
  },
  de: {
    docTitle: 'Konformitätszertifikat — REPUTEXA Bewertungseinholung',
    subtitle: 'Nachweisdokument für Ihre Unterlagen (DSGVO / Aufsichtsbehörden)',
    issuedFor: 'Betrieb / Konto',
    sectionPurpose: '1. Zweck',
    sectionPurposeBody:
      'Dieses Dokument belegt die Nutzung von REPUTEXA mit Nachvollziehbarkeit der Einwilligungen, versionsgeführtem Rechtstext und Guardian-Regelüberwachung. Es ist keine behördliche Zertifizierung und ersetzt keine Rechtsberatung (keine Abmahn-„Immunität“).',
    sectionStack: '2. Maßnahmen (Überblick)',
    bulletConsent: 'Einwilligungsprotokolle und First-Party-Cookie-Banner.',
    bulletVersioning: 'Versionierte Rechtstexte; erneute Zustimmung bei Änderungen.',
    bulletGuardian:
      'Überwachung u. a. EDPB, CNIL, Garante, AEPD, BfDI, ICO, Benelux, Nordics, PL, PT mit Audit-Log in der Datenbank.',
    bulletPoster: 'Herunterladbare Materialien für den Point of Sale.',
    sectionLegalRef: '3. Interne Rechtsreferenz (Snapshot)',
    versionLabel: 'Veröffentlichte Rechtsversion',
    versionPrefix: 'v',
    effectiveLabel: 'Wirksamkeitsdatum',
    guardianLabel: 'Letzter Guardian-Lauf',
    consentAcceptedLabel: 'Akzeptierte Version im Händlerbereich',
    sectionAuthorities: '4. Aufsichtsbehörden (Auszug)',
    authoritiesBody:
      'EU: EDPB. FR: CNIL. IT: Garante. ES: AEPD. DE: BfDI / LfD. UK: ICO. Benelux: AP. Norden: IMY u. a. PL: UODO. PT: CNPD.',
    disclaimer:
      'REPUTEXA erteilt keine Rechtsberatung. Holen Sie fachkundigen Rat ein — insbesondere für Abmahnrisiken und Impressumspflichten.',
    footerGenerated: 'Erstellt am',
    policyUrlLabel: 'Richtlinie:',
  },
};

/** Textes spécifiques certificat quand le profil / l’IP indique le Royaume-Uni. */
const UK_FRAME_PATCH: Partial<Record<string, Partial<CertificateBase>>> = {
  en: {
    subtitle: 'Summary document for your records (UK GDPR & Data Protection Act 2018)',
    sectionPurposeBody:
      'This document states that the account holder uses REPUTEXA with product-side compliance: consent traceability, legal document versioning, and automated regulatory watch (Guardian), with **ICO** guidance and UK enforcement themes in scope (e.g. misleading online reviews, protection of minors, international transfers). It is not an ICO certification or registration, but supports evidence of diligence.',
    bulletGuardian:
      'Regulatory watch includes the UK Information Commissioner’s Office (ICO) and, where processing falls under EU law, EDPB / national DPAs — audit trail in the database.',
    authoritiesBody:
      'United Kingdom: Information Commissioner’s Office (ICO) — statutory supervisor under **UK GDPR** and the **Data Protection Act 2018** — https://ico.org.uk/. EU establishments may still require EDPB / national DPA alignment for Union-facing processing.',
  },
  fr: {
    subtitle: 'Synthèse pour vos dossiers (UK GDPR & Data Protection Act 2018)',
    sectionPurposeBody:
      'Ce document atteste l’usage de REPUTEXA avec traçabilité des consentements, versioning juridique et veille Guardian, incluant les publications de l’**ICO** et les thématiques d’application au Royaume-Uni (ex. faux avis en ligne, mineurs, transferts internationaux). Ce n’est pas un agrément ICO, mais un élément de preuve de diligence.',
    bulletGuardian:
      'Veille couvrant notamment l’ICO (Royaume-Uni) et, lorsque le traitement relève du droit de l’UE, l’EDPB et les autorités nationales — journal d’audit en base.',
    authoritiesBody:
      'Royaume-Uni : Information Commissioner’s Office (ICO) — autorité de contrôle au titre du **UK GDPR** et du **Data Protection Act 2018** — https://ico.org.uk/. Les établissements UE peuvent demeurer soumis au RGPD et aux autorités nationales pour leurs traitements sur le territoire de l’Union.',
  },
};

function authorityComplaintLine(jurisdiction: PrivacyJurisdiction, loc: string): string {
  if (jurisdiction === 'uk_gdpr') {
    if (loc === 'fr') {
      return `Plaintes (Royaume-Uni) — Information Commissioner’s Office (ICO) : ${ICO_COMPLAINT_URL}`;
    }
    if (loc === 'de') {
      return `Vereinigtes Königreich — Beschwerden bei der ICO (Information Commissioner’s Office): ${ICO_COMPLAINT_URL}`;
    }
    return `United Kingdom — raise a concern with the ICO: ${ICO_COMPLAINT_URL}`;
  }
  if (loc === 'fr') {
    return `Plaintes (UE/EEE) — autorité nationale compétente — annuaire EDPB : ${EDPB_MEMBERS_URL_EN}`;
  }
  return `EU/EEA — contact your national supervisory authority: ${EDPB_MEMBERS_URL_EN}`;
}

export function getComplianceCertificateStrings(
  locale: string,
  jurisdiction: PrivacyJurisdiction = 'eu_gdpr'
): ComplianceCertificateStrings {
  const loc = normalizeAppLocale(locale);
  const base = STRINGS[loc] ?? STRINGS.en;
  const ukPatch = UK_FRAME_PATCH[loc] ?? UK_FRAME_PATCH.en ?? {};
  const merged: CertificateBase =
    jurisdiction === 'uk_gdpr' ? { ...base, ...ukPatch } : { ...base };

  return {
    ...merged,
    authorityComplaintLine: authorityComplaintLine(jurisdiction, loc),
  };
}
