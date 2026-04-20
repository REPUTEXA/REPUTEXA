/**
 * ApiAdmin (back-office) + ApiMerchant (dashboard / Banano).
 * Puis : node scripts/sync-all-locale-messages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frPath = path.join(__dirname, '..', 'messages', 'fr.json');

const PRISMA_STALE =
  'Client Prisma obsolète : arrêtez le serveur de dev, exécutez « npx prisma generate », relancez le dev. (Sous Windows, EPERM sur query_engine = fichier verrouillé tant que Next tourne.)';

const ApiAdmin = {
  unauthorized: 'Non autorisé.',
  forbidden: 'Accès refusé.',
  jsonInvalid: 'JSON invalide.',
  payloadInvalid: 'Payload invalide.',
  openaiKeyMissing: 'OPENAI_API_KEY manquant.',
  notFound: 'Introuvable.',
  draftNotFound: 'Brouillon introuvable.',
  accessDenied: 'Accès refusé.',
  deleteFailed: 'Suppression impossible.',
  idParamRequired: 'Paramètre id requis.',
  prospectNotFound: 'Prospect introuvable.',
  countryCodeRequired: 'countryCode requis.',
  hostnameTaken: 'Hostname déjà enregistré.',
  codeRequired: 'code requis.',
  unknownCountry: 'Pays inconnu.',
  noFieldsToUpdate: 'Aucun champ à mettre à jour.',
  prismaClientStale: PRISMA_STALE,
  legalNotifyFieldsRequired: 'documentName, summary et targetLink sont requis',
  resendNotConfigured: 'Service email non configuré (RESEND_API_KEY manquant ?)',
  supabaseAdminMissing: 'Supabase admin non configuré',
  adminOnly: 'Accès réservé aux administrateurs.',
  adminClientMissing: 'Client admin non configuré.',
  titleOrNotesRequired: 'Titre ou notes requis',
  aiGenerationError: 'Erreur IA. Vérifiez la clé ANTHROPIC_API_KEY.',
  serverError: 'Erreur serveur.',
  serviceUnavailable: 'Service indisponible',
  prospectOrEstablishmentRequired: 'prospectId ou establishmentId requis',
  outreachWebhookSecretMissing: 'OUTREACH_WEBHOOK_SECRET non configuré',
  outreachPayloadUnknown: 'Payload non reconnu',
  broadcastResendMissing: 'Resend non configuré',
  broadcastSupabaseMissing: 'Supabase admin non configuré',
  babelWizardTableMissing:
    'Table absente — exécutez la migration 167 puis npx prisma generate.',
  prismaWizardUnavailable: 'Prisma wizard indisponible.',
  babelSaveFailed: 'Sauvegarde impossible.',
  babelGenerationFailed: 'Génération échouée.',
  babelExpansionTableMissing:
    'Table babel_expansion_drafts absente — migration 166 + npx prisma generate.',
};

const ApiMerchant = {
  unauthorized: 'Non autorisé.',
  notAuthenticated: 'Non authentifié.',
  quotaReached: 'Quota atteint. Veuillez augmenter votre abonnement.',
  quotaStripeHint:
    'Pour ajouter un emplacement, augmentez votre abonnement depuis le tableau de bord (paiement Stripe).',
  serverError: 'Erreur serveur',
  addSlotError: "Erreur lors de l'ajout",
  planZenithRequired: 'Plan ZENITH requis',
  invalidMessages: 'Messages invalides',
  readFailed: 'Lecture impossible.',
  yearMonthRequired: 'Paramètres year et month requis.',
  zenithOnly: 'Réservé au plan Zénith.',
  invalidClient: 'Client invalide.',
  clientNotFound: 'Client introuvable.',
  invalidRecord: 'Fiche invalide.',
  invalidJson: 'JSON invalide.',
  invalidCrmRole: 'Rôle CRM invalide.',
  noUpdateFields: 'Aucun champ à mettre à jour.',
  updateFailed: 'Mise à jour impossible.',
  recordNotFound: 'Fiche introuvable.',
  serviceUnavailable: 'Service indisponible.',
  tokenCreateFailed: 'Création jeton impossible.',
};

const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
if (!fr.ApiAdmin) fr.ApiAdmin = {};
if (!fr.ApiMerchant) fr.ApiMerchant = {};
Object.assign(fr.ApiAdmin, ApiAdmin);
Object.assign(fr.ApiMerchant, ApiMerchant);
fs.writeFileSync(frPath, JSON.stringify(fr));
console.log('Merged ApiAdmin + ApiMerchant');
