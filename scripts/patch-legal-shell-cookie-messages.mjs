/**
 * Ajoute Legal.shell, Legal.publishedHtml, clés Compliance.cookieBanner (sync / fermer)
 * dans messages en, fr, es, de, it.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const SHELL = {
  en: {
    footerRegistry: 'Data processing register (Art. 30)',
    brandAria: 'REPUTEXA',
    legalNavAria: 'Legal',
    tocFallback: 'Table of contents',
  },
  fr: {
    footerRegistry: 'Registre des traitements (Art. 30)',
    brandAria: 'REPUTEXA',
    legalNavAria: 'Juridique',
    tocFallback: 'Table des matières',
  },
  es: {
    footerRegistry: 'Registro de tratamientos (art. 30)',
    brandAria: 'REPUTEXA',
    legalNavAria: 'Legal',
    tocFallback: 'Índice',
  },
  de: {
    footerRegistry: 'Verzeichnis der Verarbeitungstätigkeiten (Art. 30)',
    brandAria: 'REPUTEXA',
    legalNavAria: 'Rechtliches',
    tocFallback: 'Inhaltsverzeichnis',
  },
  it: {
    footerRegistry: 'Registro dei trattamenti (art. 30)',
    brandAria: 'REPUTEXA',
    legalNavAria: 'Note legali',
    tocFallback: 'Indice',
  },
};

const PUBLISHED = {
  en: { beforeDate: 'Text in force since', afterDate: '(version {version}).' },
  fr: { beforeDate: 'Texte en vigueur depuis le', afterDate: '(version {version}).' },
  es: { beforeDate: 'Texto vigente desde el', afterDate: '(versión {version}).' },
  de: { beforeDate: 'Gültiger Text seit dem', afterDate: '(Version {version}).' },
  it: { beforeDate: 'Testo in vigore dal', afterDate: '(versione {version}).' },
};

const COOKIE_EXTRA = {
  en: {
    closeAria: 'Close',
    cookieSyncHint:
      'When our privacy notice or policies are republished (including after our periodic compliance review), we may ask you to confirm your cookie choices again.',
    legalUpdatedLine: 'Legal & privacy documents last updated: {date}',
  },
  fr: {
    closeAria: 'Fermer',
    cookieSyncHint:
      'Lorsque nos mentions légales ou notre politique de confidentialité sont republiées (y compris après notre veille conformité périodique), nous pouvons vous redemander de confirmer vos choix.',
    legalUpdatedLine: 'Dernière mise à jour des documents légaux / confidentialité : {date}',
  },
  es: {
    closeAria: 'Cerrar',
    cookieSyncHint:
      'Cuando se republican nuestros textos legales o la política de privacidad (incluida nuestra revisión periódica de cumplimiento), podemos volver a pedirle que confirme sus opciones.',
    legalUpdatedLine: 'Última actualización de documentos legales / privacidad: {date}',
  },
  de: {
    closeAria: 'Schließen',
    cookieSyncHint:
      'Wenn unsere Rechtstexte oder Datenschutzhinweise neu veröffentlicht werden (einschließlich nach unserer regelmäßigen Compliance-Prüfung), können wir Sie erneut um Bestätigung Ihrer Cookie-Auswahl bitten.',
    legalUpdatedLine: 'Letzte Aktualisierung der Rechts-/Datenschutzdokumente: {date}',
  },
  it: {
    closeAria: 'Chiudi',
    cookieSyncHint:
      'Quando i nostri testi legali o l’informativa privacy vengono ripubblicati (anche dopo la revisione periodica di conformità), potremmo chiederti di confermare di nuovo le tue scelte.',
    legalUpdatedLine: 'Ultimo aggiornamento documenti legali / privacy: {date}',
  },
};

const UK_EXTRA = {
  en: {
    closeAria: 'Close',
    cookieSyncHint:
      'When our privacy notice or policies are republished (including after our periodic compliance review), we may ask you to confirm your cookie choices again.',
    legalUpdatedLine: 'Legal & privacy documents last updated: {date}',
  },
  fr: {
    closeAria: 'Fermer',
    cookieSyncHint:
      'Lorsque nos textes juridiques ou notre politique de confidentialité sont republiés (y compris après notre veille conformité périodique), nous pouvons vous redemander de confirmer vos choix.',
    legalUpdatedLine: 'Dernière mise à jour des documents légaux / confidentialité : {date}',
  },
  es: {
    closeAria: 'Cerrar',
    cookieSyncHint:
      'Cuando se republican nuestros textos legales o la política de privacidad (incluida nuestra revisión periódica de cumplimiento), podemos volver a pedirle que confirme sus opciones.',
    legalUpdatedLine: 'Última actualización de documentos legales / privacidad: {date}',
  },
  de: {
    closeAria: 'Schließen',
    cookieSyncHint:
      'Wenn unsere Rechtstexte oder Datenschutzhinweise neu veröffentlicht werden (einschließlich nach unserer regelmäßigen Compliance-Prüfung), können wir Sie erneut um Bestätigung Ihrer Cookie-Auswahl bitten.',
    legalUpdatedLine: 'Letzte Aktualisierung der Rechts-/Datenschutzdokumente: {date}',
  },
  it: {
    closeAria: 'Chiudi',
    cookieSyncHint:
      'Quando i nostri testi legali o l’informativa privacy vengono ripubblicati (anche dopo la revisione periodica di conformità), potremmo chiederti di confermare di nuovo le tue scelte.',
    legalUpdatedLine: 'Ultimo aggiornamento documenti legali / privacy: {date}',
  },
};

for (const loc of ['en', 'fr', 'es', 'de', 'it']) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Legal = j.Legal || {};
  j.Legal.shell = SHELL[loc];
  j.Legal.publishedHtml = PUBLISHED[loc];
  j.Compliance = j.Compliance || {};
  j.Compliance.cookieBanner = { ...j.Compliance.cookieBanner, ...COOKIE_EXTRA[loc] };
  j.Compliance.cookieBannerUk = { ...j.Compliance.cookieBannerUk, ...UK_EXTRA[loc] };
  fs.writeFileSync(p, JSON.stringify(j));
  console.log('patched legal shell + cookie', loc);
}
