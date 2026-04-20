/**
 * Adds Legal.dataRightsClient to messages/{en,fr,es,de,it}.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'messages');

const PACK = {
  en: {
    metaTitle: 'Client data rights — REPUTEXA',
    metaDescription:
      'Submit a request relating to personal data collected by a business that uses REPUTEXA (GDPR and applicable law).',
    title: 'Exercise your data rights',
    subtitle:
      'If a business contacted you using REPUTEXA (for example via WhatsApp review requests), you can submit a request using the same phone number you shared with that business.',
    formIntro:
      'We will process your request in line with our privacy policy and applicable law. You must use the phone number associated with the interaction. A quick security check may be required.',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'e.g. +33 6 12 34 56 78',
    phoneHint: 'Include your country code. We use this to locate interactions linked to that number.',
    turnstileRequired: 'Please complete the security verification.',
    errorGeneric: 'Something went wrong. Please try again in a moment.',
    success: 'Your request has been received. We will handle it according to our procedures.',
    submitting: 'Sending…',
    submit: 'Submit request',
    footnote:
      'REPUTEXA acts as a processor for merchants using the platform. This form helps route your request correctly.',
    privacyLinkLocaleHint:
      'The privacy policy link below may open in a language inferred from your number (you can still switch site language).',
    privacyLink: 'Privacy policy',
    dataRightsSameFormLink: 'Open this page in that language',
  },
  fr: {
    metaTitle: 'Droits des personnes — REPUTEXA',
    metaDescription:
      'Formulaire pour exercer vos droits sur les données traitées par REPUTEXA pour un établissement partenaire (RGPD et droit applicable).',
    title: 'Exercer vos droits sur vos données',
    subtitle:
      'Si un établissement vous a contacté via REPUTEXA (par exemple pour solliciter un avis sur WhatsApp), vous pouvez adresser une demande en utilisant le même numéro de téléphone que vous avez communiqué à cet établissement.',
    formIntro:
      'Votre demande sera traitée conformément à notre politique de confidentialité et au droit applicable. Utilisez le numéro lié à l’interaction. Une vérification de sécurité peut être demandée.',
    phoneLabel: 'Numéro de téléphone',
    phonePlaceholder: 'ex. +33 6 12 34 56 78',
    phoneHint: 'Indiquez l’indicatif pays. Il sert à identifier les messages liés à ce numéro.',
    turnstileRequired: 'Veuillez valider la vérification de sécurité.',
    errorGeneric: 'Une erreur est survenue. Réessayez dans quelques instants.',
    success: 'Votre demande a bien été enregistrée. Elle sera traitée selon nos procédures.',
    submitting: 'Envoi en cours…',
    submit: 'Envoyer la demande',
    footnote:
      'REPUTEXA agit en tant que sous-traitant pour les établissements utilisateurs. Ce formulaire permet d’orienter correctement votre demande.',
    privacyLinkLocaleHint:
      'Le lien vers la politique de confidentialité peut s’ouvrir dans une langue déduite de votre numéro (vous pouvez aussi changer la langue du site).',
    privacyLink: 'Politique de confidentialité',
    dataRightsSameFormLink: 'Ouvrir cette page dans cette langue',
  },
  es: {
    metaTitle: 'Derechos de las personas — REPUTEXA',
    metaDescription:
      'Formulario para ejercer sus derechos sobre datos tratados por REPUTEXA para un comercio asociado (RGPD y legislación aplicable).',
    title: 'Ejercer sus derechos sobre sus datos',
    subtitle:
      'Si un negocio le contactó a través de REPUTEXA (por ejemplo para solicitar una reseña por WhatsApp), puede enviar una solicitud con el mismo número de teléfono que facilitó a ese negocio.',
    formIntro:
      'Trataremos su solicitud conforme a nuestra política de privacidad y la ley aplicable. Use el número asociado a la interacción. Puede pedirse una verificación de seguridad.',
    phoneLabel: 'Número de teléfono',
    phonePlaceholder: 'ej. +34 612 345 678',
    phoneHint: 'Incluya el prefijo internacional. Lo usamos para localizar mensajes vinculados a ese número.',
    turnstileRequired: 'Complete la verificación de seguridad.',
    errorGeneric: 'Algo salió mal. Inténtelo de nuevo en unos momentos.',
    success: 'Hemos recibido su solicitud. La tramitaremos según nuestros procedimientos.',
    submitting: 'Enviando…',
    submit: 'Enviar solicitud',
    footnote:
      'REPUTEXA actúa como encargado del tratamiento para los comercios que usan la plataforma. Este formulario orienta correctamente su solicitud.',
    privacyLinkLocaleHint:
      'El enlace a la política de privacidad puede abrirse en un idioma inferido de su número (también puede cambiar el idioma del sitio).',
    privacyLink: 'Política de privacidad',
    dataRightsSameFormLink: 'Abrir esta página en ese idioma',
  },
  de: {
    metaTitle: 'Betroffenenrechte — REPUTEXA',
    metaDescription:
      'Formular zur Ausübung Ihrer Rechte an Daten, die REPUTEXA für ein Partnerunternehmen verarbeitet (DSGVO und anwendbares Recht).',
    title: 'Ihre Datenschutzrechte wahrnehmen',
    subtitle:
      'Wenn ein Unternehmen Sie über REPUTEXA kontaktiert hat (z. B. zur Bitte um eine Bewertung per WhatsApp), können Sie eine Anfrage mit derselben Telefonnummer stellen, die Sie diesem Unternehmen mitgeteilt haben.',
    formIntro:
      'Wir bearbeiten Ihre Anfrage gemäß unserer Datenschutzerklärung und geltendem Recht. Bitte verwenden Sie die mit der Interaktion verknüpfte Nummer. Eine Sicherheitsprüfung kann erforderlich sein.',
    phoneLabel: 'Telefonnummer',
    phonePlaceholder: 'z. B. +49 151 23456789',
    phoneHint: 'Bitte Ländervorwahl angeben. Wir nutzen sie, um Nachrichten zu dieser Nummer zuzuordnen.',
    turnstileRequired: 'Bitte die Sicherheitsprüfung abschließen.',
    errorGeneric: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es in Kürze erneut.',
    success: 'Ihre Anfrage ist eingegangen und wird nach unseren Abläufen bearbeitet.',
    submitting: 'Wird gesendet…',
    submit: 'Anfrage senden',
    footnote:
      'REPUTEXA tritt als Auftragsverarbeiter für Nutzerunternehmen der Plattform auf. Dieses Formular leitet Ihre Anfrage richtig weiter.',
    privacyLinkLocaleHint:
      'Der Link zur Datenschutzerklärung kann in einer aus Ihrer Nummer abgeleiteten Sprache geöffnet werden (Sie können auch die Website-Sprache wechseln).',
    privacyLink: 'Datenschutzerklärung',
    dataRightsSameFormLink: 'Diese Seite in dieser Sprache öffnen',
  },
  it: {
    metaTitle: 'Diritti degli interessati — REPUTEXA',
    metaDescription:
      'Modulo per esercitare i tuoi diritti sui dati trattati da REPUTEXA per un esercente partner (GDPR e normativa applicabile).',
    title: 'Esercita i tuoi diritti sui dati',
    subtitle:
      'Se un’attività ti ha contattato tramite REPUTEXA (ad esempio per chiedere una recensione su WhatsApp), puoi inviare una richiesta usando lo stesso numero di telefono che hai fornito a quell’attività.',
    formIntro:
      'La tua richiesta sarà gestita secondo l’informativa sulla privacy e la legge applicabile. Usa il numero associato all’interazione. Potrebbe essere richiesta una verifica di sicurezza.',
    phoneLabel: 'Numero di telefono',
    phonePlaceholder: 'es. +39 320 123 4567',
    phoneHint: 'Includi il prefisso internazionale. Lo usiamo per individuare i messaggi collegati a quel numero.',
    turnstileRequired: 'Completa la verifica di sicurezza.',
    errorGeneric: 'Si è verificato un errore. Riprova tra poco.',
    success: 'Abbiamo ricevuto la tua richiesta. Sarà gestita secondo le nostre procedure.',
    submitting: 'Invio in corso…',
    submit: 'Invia richiesta',
    footnote:
      'REPUTEXA agisce come responsabile del trattamento per gli esercenti che usano la piattaforma. Questo modulo indirizza correttamente la tua richiesta.',
    privacyLinkLocaleHint:
      'Il link all’informativa sulla privacy può aprirsi in una lingua dedotta dal tuo numero (puoi anche cambiare la lingua del sito).',
    privacyLink: 'Informativa sulla privacy',
    dataRightsSameFormLink: 'Apri questa pagina in quella lingua',
  },
};

for (const loc of ['en', 'fr', 'es', 'de', 'it']) {
  const p = path.join(root, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Legal = j.Legal || {};
  j.Legal.dataRightsClient = PACK[loc];
  fs.writeFileSync(p, JSON.stringify(j));
}

console.log('Legal.dataRightsClient added to all locales');
