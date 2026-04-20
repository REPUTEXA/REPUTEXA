import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const STR = {
  fr: {
    sectionTitle: 'Registre des traitements (article 30 RGPD)',
    badgeArticle30: 'Article 30',
    badgeNative: 'RGPD native',
    intro:
      'Aperçu simplifié des trois colonnes structurantes du registre des traitements REPUTEXA. Le fichier CSV complet est aligné sur notre politique de confidentialité et nos engagements sous-traitants.',
    colTreatment: 'Traitement',
    colPurpose: 'Finalité',
    colLegalBasis: 'Base légale',
    row1Treatment: 'Gestion des comptes marchands REPUTEXA',
    row1Purpose: 'Compte, authentification, facturation et accès au tableau de bord.',
    row1Basis: 'Art. 6(1)(b) — exécution du contrat',
    row2Treatment: 'Suggestions de réponses IA aux avis publics',
    row2Purpose: 'Analyser un avis déjà public et proposer une réponse au professionnel.',
    row2Basis: 'Art. 6(1)(f) — intérêt légitime ; validation humaine avant publication',
    row3Treatment: 'File WhatsApp — sollicitation d’avis (Zenith)',
    row3Purpose: 'Message post-achat pour retour d’expérience ; lien d’avis optionnel.',
    row3Basis: 'Intérêt légitime du suivi commercial ; opposition (STOP) ; consentement le cas échéant',
    downloadCta: 'Télécharger le registre Art. 30 complet (CSV)',
    downloadHint: 'CSV prêt à l’emploi pour votre dossier conformité ou vos échanges avec l’autorité.',
    htmlRegisterCta: 'Version HTML (aperçu / PDF)',
    htmlRegisterHint: 'S’ouvre dans un nouvel onglet — Imprimer → PDF pour archiver.',
  },
  en: {
    sectionTitle: 'Processing register (Article 30 GDPR)',
    badgeArticle30: 'Article 30',
    badgeNative: 'GDPR-native',
    intro:
      'Simplified preview of the three core columns in the REPUTEXA processing register. The full CSV aligns with our privacy notice and processor commitments.',
    colTreatment: 'Processing',
    colPurpose: 'Purpose',
    colLegalBasis: 'Legal basis',
    row1Treatment: 'REPUTEXA merchant account management',
    row1Purpose: 'Account lifecycle, authentication, billing and dashboard access.',
    row1Basis: 'Art. 6(1)(b) — performance of contract',
    row2Treatment: 'AI-assisted suggested replies to public reviews',
    row2Purpose: 'Analyse already-public review text and suggest a reply for the business.',
    row2Basis: 'Art. 6(1)(f) — legitimate interests; human approval before posting',
    row3Treatment: 'WhatsApp queue — review outreach (Zenith)',
    row3Purpose: 'Post-purchase message for feedback; optional review link.',
    row3Basis: 'Legitimate interest in service improvement; STOP/opt-out; consent where required',
    downloadCta: 'Download Art. 30 register (CSV)',
    downloadHint: 'Ready-to-use CSV for your compliance file or supervisory dialogue.',
    htmlRegisterCta: 'HTML version (print / PDF)',
    htmlRegisterHint: 'Opens in a new tab — use Print → Save as PDF to archive.',
  },
  es: {
    sectionTitle: 'Registro de tratamientos (artículo 30 RGPD)',
    badgeArticle30: 'Art. 30',
    badgeNative: 'RGPD integrado',
    intro:
      'Vista simplificada de las tres columnas principales del registro de tratamientos REPUTEXA. El CSV completo está alineado con nuestra política de privacidad.',
    colTreatment: 'Tratamiento',
    colPurpose: 'Finalidad',
    colLegalBasis: 'Base legal',
    row1Treatment: 'Gestión de cuentas comerciales REPUTEXA',
    row1Purpose: 'Cuenta, autenticación, facturación y acceso al panel.',
    row1Basis: 'Art. 6(1)(b) RGPD — ejecución del contrato',
    row2Treatment: 'Sugerencias de respuestas IA a reseñas públicas',
    row2Purpose: 'Analizar texto ya público y proponer respuesta al profesional.',
    row2Basis: 'Art. 6(1)(f) — interés legítimo; validación humana antes de publicar',
    row3Treatment: 'Cola WhatsApp — solicitud de reseñas (Zenith)',
    row3Purpose: 'Mensaje poscompra para feedback; enlace opcional.',
    row3Basis: 'Interés legítimo; STOP; consentimiento cuando proceda',
    downloadCta: 'Descargar registro Art. 30 (CSV)',
    downloadHint: 'CSV listo para su expediente de cumplimiento.',
    htmlRegisterCta: 'Versión HTML (imprimir / PDF)',
    htmlRegisterHint: 'Se abre en una pestaña nueva — Imprimir → PDF para archivo.',
  },
  de: {
    sectionTitle: 'Verzeichnis der Verarbeitungstätigkeiten (Art. 30 DSGVO)',
    badgeArticle30: 'Art. 30',
    badgeNative: 'DSGVO-integriert',
    intro:
      'Vereinfachte Vorschau der drei Kerncolumns im REPUTEXA-Verarbeitungsverzeichnis. Die vollständige CSV entspricht unserer Datenschutzerklärung.',
    colTreatment: 'Vorgang',
    colPurpose: 'Zweck',
    colLegalBasis: 'Rechtsgrundlage',
    row1Treatment: 'Verwaltung der Händlerkonten REPUTEXA',
    row1Purpose: 'Konto, Authentifizierung, Abrechnung und Dashboard-Zugang.',
    row1Basis: 'Art. 6(1)(b) DSGVO — Vertragserfüllung',
    row2Treatment: 'KI-gestützte Antwortvorschläge zu öffentlichen Bewertungen',
    row2Purpose: 'Bereits öffentlichen Bewertungstext analysieren und Vorschlag unterbreiten.',
    row2Basis: 'Art. 6(1)(f) — berechtigtes Interesse; menschliche Freigabe vor Veröffentlichung',
    row3Treatment: 'WhatsApp-Warteschlange — Review-Ansprache (Zenith)',
    row3Purpose: 'Nachkauf-Nachricht für Feedback; optionaler Review-Link.',
    row3Basis: 'Berechtigtes Interesse; STOP/Widerspruch; Einwilligung wenn erforderlich',
    downloadCta: 'Art.-30-Verzeichnis herunterladen (CSV)',
    downloadHint: 'CSV für Ihre Compliance-Akte oder Behördenkontakt.',
    htmlRegisterCta: 'HTML-Version (Druck / PDF)',
    htmlRegisterHint: 'Neuer Tab — Drucken → Als PDF speichern.',
  },
  it: {
    sectionTitle: 'Registro dei trattamenti (articolo 30 GDPR)',
    badgeArticle30: 'Art. 30',
    badgeNative: 'GDPR-ready',
    intro:
      'Anteprima semplificata delle tre colonne principali del registro dei trattamenti REPUTEXA. Il CSV completo è allineato all’informativa privacy.',
    colTreatment: 'Trattamento',
    colPurpose: 'Finalità',
    colLegalBasis: 'Base giuridica',
    row1Treatment: 'Gestione account merchant REPUTEXA',
    row1Purpose: 'Account, autenticazione, fatturazione e accesso alla dashboard.',
    row1Basis: 'Art. 6(1)(b) — esecuzione del contratto',
    row2Treatment: 'Suggerimenti IA per risposte alle recensioni pubbliche',
    row2Purpose: 'Analizzare testo già pubblico e proporre una bozza al professionista.',
    row2Basis: 'Art. 6(1)(f) — interesse legittimo; validazione umana prima della pubblicazione',
    row3Treatment: 'Coda WhatsApp — richiesta recensioni (Zenith)',
    row3Purpose: 'Messaggio post-acquisto per feedback; link opzionale.',
    row3Basis: 'Interesse legittimo; STOP; consenso ove necessario',
    downloadCta: 'Scarica registro Art. 30 (CSV)',
    downloadHint: 'CSV pronto per il fascicolo di conformità.',
    htmlRegisterCta: 'Versione HTML (stampa / PDF)',
    htmlRegisterHint: 'Si apre in una nuova scheda — Stampa → Salva come PDF.',
  },
};

for (const loc of ['fr', 'en', 'es', 'de', 'it']) {
  const f = path.join(root, 'messages', `${loc}.json`);
  const m = JSON.parse(fs.readFileSync(f, 'utf8'));
  m.SecurityPage = m.SecurityPage ?? {};
  m.SecurityPage.registre = STR[loc];
  fs.writeFileSync(f, JSON.stringify(m));
}
console.log('SecurityPage.registre patched for 5 locales');
