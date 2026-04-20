import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const sidebar = {
  en: 'Compliance Hub',
  fr: 'Centre de Conformité',
  es: 'Centro de cumplimiento',
  de: 'Compliance-Center',
  it: 'Centro conformità',
};

const page = {
  en: {
    title: 'Compliance Hub',
    intro:
      'Centralise Art. 30 evidence, certificates and posters. One-click exports keep your GDPR file audit-ready.',
    tagline: 'Generate your GDPR documentation in one second.',
    art30Title: 'Art. 30 processing register (pre-filled)',
    art30Body:
      'Public REPUTEXA template aligned with our published legal pack. Download CSV for your records or supervisory dialogue.',
    csvCta: 'Download CSV register',
    htmlCtalabel: 'Open HTML register',
    certificateTitle: 'Compliance certificate',
    certificateBody: 'Personalised PDF after you accept merchant compliance in the product flow.',
    certificateCta: 'Download certificate (PDF)',
    posterTitle: 'On-premise poster',
    posterBody: 'Printable notice for review collection (A4 / A5 / A3).',
    posterCta: 'Open poster PDF',
    collecteHint: 'Full Zenith flow (consent trace, versioning) lives under Review collection.',
    linkCollecte: 'Go to review collection',
    certificateToastOk: 'Certificate downloaded',
    certificateToastErr: 'Download failed',
    certificateBlockedHint: 'Accept merchant compliance in Review collection first.',
  },
  fr: {
    title: 'Centre de Conformité',
    intro:
      'Centralisez les preuves Registre Art. 30, certificats et affiches. Des exports en un clic pour un dossier « audit-ready ».',
    tagline: 'Générez votre documentation RGPD en 1 seconde.',
    art30Title: 'Registre des traitements — article 30 RGPD (pré-rempli)',
    art30Body:
      'Modèle public REPUTEXA aligné sur notre paquet légal publié. Téléchargez le CSV pour votre dossier ou vos échanges avec l’autorité.',
    csvCta: 'Télécharger le registre (CSV)',
    htmlCtalabel: 'Ouvrir le registre (HTML)',
    certificateTitle: 'Certificat de conformité',
    certificateBody:
      'PDF personnalisé après acceptation du pack conformité marchand dans le produit.',
    certificateCta: 'Télécharger le certificat (PDF)',
    posterTitle: 'Affichette établissement',
    posterBody: 'Notice imprimable pour la collecte d’avis (A4 / A5 / A3).',
    posterCta: 'Ouvrir l’affiche PDF',
    collecteHint: 'Le flux Zenith complet (trace des consentements, versions) est dans Collecte d’avis.',
    linkCollecte: 'Aller à la collecte d’avis',
    certificateToastOk: 'Certificat téléchargé',
    certificateToastErr: 'Téléchargement impossible',
    certificateBlockedHint: 'Validez d’abord la conformité marchand dans Collecte d’avis.',
  },
  es: {
    title: 'Centro de cumplimiento',
    intro:
      'Centralice el registro Art. 30, certificados y carteles. Exportaciones en un clic para un expediente listo para auditoría.',
    tagline: 'Genere su documentación RGPD en un segundo.',
    art30Title: 'Registro de tratamientos — art. 30 RGPD (prefill)',
    art30Body:
      'Plantilla pública REPUTEXA alineada con nuestro paquete legal. Descargue el CSV para su expediente.',
    csvCta: 'Descargar registro (CSV)',
    htmlCtalabel: 'Abrir registro (HTML)',
    certificateTitle: 'Certificado de cumplimiento',
    certificateBody: 'PDF personalizado tras aceptar el cumplimiento en el producto.',
    certificateCta: 'Descargar certificado (PDF)',
    posterTitle: 'Cartel del local',
    posterBody: 'Aviso imprimible para la recogida de reseñas (A4 / A5 / A3).',
    posterCta: 'Abrir cartel PDF',
    collecteHint: 'El flujo Zenith completo está en Recogida de reseñas.',
    linkCollecte: 'Ir a recogida de reseñas',
    certificateToastOk: 'Certificado descargado',
    certificateToastErr: 'Descarga no disponible',
    certificateBlockedHint: 'Acepte primero el cumplimiento en Recogida de reseñas.',
  },
  de: {
    title: 'Compliance-Center',
    intro:
      'Bündeln Sie Art.-30-Nachweise, Zertifikate und Aushänge. Ein-Klick-Exporte für eine audit-ready Akte.',
    tagline: 'Erzeugen Sie Ihre GDPR-Dokumentation in einer Sekunde.',
    art30Title: 'Verarbeitungsverzeichnis — Art. 30 DSGVO (vorausgefüllt)',
    art30Body:
      'Öffentliche REPUTEXA-Vorlage, abgestimmt auf unsere veröffentlichten Rechtstexte. CSV für Behörden oder interne Akte.',
    csvCta: 'Verzeichnis herunterladen (CSV)',
    htmlCtalabel: 'Verzeichnis öffnen (HTML)',
    certificateTitle: 'Compliance-Zertifikat',
    certificateBody: 'Personalisiertes PDF nach Akzeptanz im Produkt.',
    certificateCta: 'Zertifikat herunterladen (PDF)',
    posterTitle: 'Vor-Ort-Aushang',
    posterBody: 'Druckbarer Hinweis zur Bewertungsansprache (A4 / A5 / A3).',
    posterCta: 'Aushang-PDF öffnen',
    collecteHint: 'Der vollständige Zenith-Flow liegt unter Bewertungseinholung.',
    linkCollecte: 'Zur Bewertungseinholung',
    certificateToastOk: 'Zertifikat heruntergeladen',
    certificateToastErr: 'Download fehlgeschlagen',
    certificateBlockedHint: 'Bitte zuerst die Merchant-Compliance unter Bewertungseinholung bestätigen.',
  },
  it: {
    title: 'Centro conformità',
    intro:
      'Raccogli prove registro Art. 30, certificati e manifesti. Export in un clic per un fascicolo audit-ready.',
    tagline: 'Generate la documentazione GDPR in un secondo.',
    art30Title: 'Registro dei trattamenti — art. 30 GDPR (precompilato)',
    art30Body:
      'Modello pubblico REPUTEXA allineato al pacchetto legale pubblicato. Scarica il CSV per il tuo fascicolo.',
    csvCta: 'Scarica registro (CSV)',
    htmlCtalabel: 'Apri registro (HTML)',
    certificateTitle: 'Certificato di conformità',
    certificateBody: 'PDF personalizzato dopo accettazione nel prodotto.',
    certificateCta: 'Scarica certificato (PDF)',
    posterTitle: 'Manifesto punto vendita',
    posterBody: 'Avviso stampabile per raccolta recensioni (A4 / A5 / A3).',
    posterCta: 'Apri PDF manifesto',
    collecteHint: 'Il flusso Zenith completo è in Raccolta recensioni.',
    linkCollecte: 'Vai alla raccolta recensioni',
    certificateToastOk: 'Certificato scaricato',
    certificateToastErr: 'Download non riuscito',
    certificateBlockedHint: 'Accetta prima la conformità in Raccolta recensioni.',
  },
};

for (const loc of ['en', 'fr', 'es', 'de', 'it']) {
  const f = path.join(root, 'messages', `${loc}.json`);
  const m = JSON.parse(fs.readFileSync(f, 'utf8'));
  m.Dashboard = m.Dashboard ?? {};
  m.Dashboard.sidebar = m.Dashboard.sidebar ?? {};
  m.Dashboard.sidebar.complianceCenter = sidebar[loc];
  m.Dashboard.compliancePage = page[loc];
  fs.writeFileSync(f, JSON.stringify(m));
}

console.log('Patched compliance i18n for en, fr, es, de, it');
