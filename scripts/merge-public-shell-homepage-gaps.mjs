/**
 * PublicShell nav/footer, Legal.dataRightsClient API strings, HomePage gaps for it/es/de.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const messagesDir = path.join(root, 'messages');
const partials = path.join(root, 'locale-partials');

function deepMerge(base, patch) {
  if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = out[k];
    if (pv != null && typeof pv === 'object' && !Array.isArray(pv) && bv != null && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

const PUBLIC_SHELL = {
  en: {
    navFeatures: 'Features',
    navPricing: 'Pricing',
    navBlog: 'Blog',
    navHelp: 'Help',
    navLogin: 'Sign in',
    navTrial: 'Free trial',
    navTrialShort: 'Trial',
    footerCopyright: '© 2026 REPUTEXA, Inc. All rights reserved.',
    ariaNav: 'Main navigation',
  },
  fr: {
    navFeatures: 'Fonctionnalités',
    navPricing: 'Tarifs',
    navBlog: 'Blog',
    navHelp: 'Aide',
    navLogin: 'Connexion',
    navTrial: 'Essai gratuit',
    navTrialShort: 'Essai',
    footerCopyright: '© 2026 REPUTEXA, Inc. Tous droits réservés.',
    ariaNav: 'Navigation principale',
  },
  es: {
    navFeatures: 'Funciones',
    navPricing: 'Precios',
    navBlog: 'Blog',
    navHelp: 'Ayuda',
    navLogin: 'Iniciar sesión',
    navTrial: 'Prueba gratuita',
    navTrialShort: 'Prueba',
    footerCopyright: '© 2026 REPUTEXA, Inc. Todos los derechos reservados.',
    ariaNav: 'Navegación principal',
  },
  de: {
    navFeatures: 'Funktionen',
    navPricing: 'Preise',
    navBlog: 'Blog',
    navHelp: 'Hilfe',
    navLogin: 'Anmelden',
    navTrial: 'Kostenlos testen',
    navTrialShort: 'Test',
    footerCopyright: '© 2026 REPUTEXA, Inc. Alle Rechte vorbehalten.',
    ariaNav: 'Hauptnavigation',
  },
  it: {
    navFeatures: 'Funzionalità',
    navPricing: 'Prezzi',
    navBlog: 'Blog',
    navHelp: 'Assistenza',
    navLogin: 'Accedi',
    navTrial: 'Prova gratuita',
    navTrialShort: 'Prova',
    footerCopyright: '© 2026 REPUTEXA, Inc. Tutti i diritti riservati.',
    ariaNav: 'Navigazione principale',
  },
};

const DR_EXTRA = {
  en: {
    apiRateLimit: 'Too many requests. Please wait one minute and try again.',
    apiPhoneRequired: 'Phone number required.',
    apiTurnstileRequired: 'Security verification required.',
    apiTurnstileFailed: 'Security verification failed.',
    apiInvalidPhone: 'Invalid number. Use international format (e.g. +393xxxxxxxxx).',
    apiServiceUnavailable: 'Service temporarily unavailable.',
    apiGeneric: 'Something went wrong.',
    apiSuccess:
      'Your request has been received. Data linked to this number in our review-outreach systems has been erased or will be processed according to our internal timelines.',
    phoneInvalid: 'Invalid number for this country.',
    phoneNationalPlaceholder: 'e.g. 7123 456789',
  },
  fr: {
    apiRateLimit: 'Trop de demandes. Patientez une minute avant de réessayer.',
    apiPhoneRequired: 'Numéro requis.',
    apiTurnstileRequired: 'Vérification de sécurité requise.',
    apiTurnstileFailed: 'Vérification de sécurité échouée.',
    apiInvalidPhone: 'Numéro invalide. Utilisez le format international (ex. +33612345678).',
    apiServiceUnavailable: 'Service temporairement indisponible.',
    apiGeneric: 'Une erreur est survenue.',
    apiSuccess:
      'Votre demande a été prise en compte. Les données associées à ce numéro dans nos systèmes de sollicitation d’avis ont été effacées ou seront traitées conformément à nos délais internes.',
    phoneInvalid: 'Numéro invalide pour ce pays.',
    phoneNationalPlaceholder: 'ex. 6 12 34 56 78',
  },
  es: {
    apiRateLimit: 'Demasiadas solicitudes. Espere un minuto e inténtelo de nuevo.',
    apiPhoneRequired: 'Número de teléfono obligatorio.',
    apiTurnstileRequired: 'Verificación de seguridad obligatoria.',
    apiTurnstileFailed: 'Verificación de seguridad fallida.',
    apiInvalidPhone: 'Número no válido. Use formato internacional (p. ej. +34612345678).',
    apiServiceUnavailable: 'Servicio temporalmente no disponible.',
    apiGeneric: 'Ha ocurrido un error.',
    apiSuccess:
      'Hemos recibido su solicitud. Los datos asociados a este número en nuestros sistemas de captación de reseñas se han borrado o se tramitarán según nuestros plazos internos.',
    phoneInvalid: 'Número no válido para este país.',
    phoneNationalPlaceholder: 'ej. 612 345 678',
  },
  de: {
    apiRateLimit: 'Zu viele Anfragen. Bitte eine Minute warten und erneut versuchen.',
    apiPhoneRequired: 'Telefonnummer erforderlich.',
    apiTurnstileRequired: 'Sicherheitsprüfung erforderlich.',
    apiTurnstileFailed: 'Sicherheitsprüfung fehlgeschlagen.',
    apiInvalidPhone: 'Ungültige Nummer. Internationales Format verwenden (z. B. +4915123456789).',
    apiServiceUnavailable: 'Dienst vorübergehend nicht verfügbar.',
    apiGeneric: 'Ein Fehler ist aufgetreten.',
    apiSuccess:
      'Ihre Anfrage ist eingegangen. Daten zu dieser Nummer in unseren Systemen zur Bewertungsanfrage wurden gelöscht oder werden gemäß unseren internen Fristen bearbeitet.',
    phoneInvalid: 'Ungültige Nummer für dieses Land.',
    phoneNationalPlaceholder: 'z. B. 151 23456789',
  },
  it: {
    apiRateLimit: 'Troppe richieste. Attendi un minuto e riprova.',
    apiPhoneRequired: 'Numero di telefono obbligatorio.',
    apiTurnstileRequired: 'Verifica di sicurezza obbligatoria.',
    apiTurnstileFailed: 'Verifica di sicurezza non riuscita.',
    apiInvalidPhone: 'Numero non valido. Usa il formato internazionale (es. +393xxxxxxxxx).',
    apiServiceUnavailable: 'Servizio temporaneamente non disponibile.',
    apiGeneric: 'Si è verificato un errore.',
    apiSuccess:
      'Richiesta ricevuta. I dati collegati a questo numero nei nostri sistemi di raccolta recensioni sono stati cancellati o saranno trattati secondo i nostri tempi interni.',
    phoneInvalid: 'Numero non valido per questo paese.',
    phoneNationalPlaceholder: 'es. 320 123 4567',
  },
};

const GAP_FILES = { it: 'homepage-gap-it.json', es: 'homepage-gap-es.json', de: 'homepage-gap-de.json' };

for (const loc of ['en', 'fr', 'es', 'de', 'it']) {
  const p = path.join(messagesDir, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.PublicShell = PUBLIC_SHELL[loc];
  j.Legal = j.Legal || {};
  j.Legal.dataRightsClient = deepMerge(j.Legal.dataRightsClient || {}, DR_EXTRA[loc]);
  if (GAP_FILES[loc]) {
    const gap = JSON.parse(fs.readFileSync(path.join(partials, GAP_FILES[loc]), 'utf8'));
    j.HomePage = j.HomePage || {};
    j.HomePage = deepMerge(j.HomePage, gap);
  }
  fs.writeFileSync(p, JSON.stringify(j));
}

console.log('merged PublicShell, dataRightsClient API/phone strings, homepage gaps (it,es,de)');
