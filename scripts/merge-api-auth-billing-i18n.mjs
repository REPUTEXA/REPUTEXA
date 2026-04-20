/**
 * Fusionne ApiAuth, ApiBanano, BillingEmails dans messages/fr.json puis :
 * node scripts/sync-all-locale-messages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frPath = path.join(__dirname, '..', 'messages', 'fr.json');

const ApiAuth = {
  rateLimit: 'Trop de tentatives. Veuillez patienter une minute.',
  emailRequired: 'email requis',
  serviceUnavailable: 'Service unavailable',
  accountExists:
    'Ce compte existe déjà. Veuillez vous connecter ou utiliser un autre email.',
  userNotCreated: 'Utilisateur non créé',
  otpCreateFailed: 'Échec de la création du code',
  signupFailed: "Échec de l'inscription",
  emailRequiredDot: 'Email requis.',
  serviceUnavailableFr: 'Service indisponible',
  noPendingOtp:
    "Aucun code en attente pour cet email. Vérifiez l'adresse, ou attendez quelques secondes et réessayez si vous venez de créer votre compte.",
  otpCreateError: 'Erreur lors de la création du code.',
  resendFailed: 'Erreur lors du renvoi du code.',
  devAccountCreated: 'Compte créé. Code OTP (dev): ',
  devCodeResent: 'Code renvoyé (dev): ',
  newEmailRequired: 'newEmail required',
  sessionExpired: 'Session expirée. Reconnectez-vous.',
  sameEmail: "La nouvelle adresse est identique à l'adresse actuelle.",
  sendConfirmFailed:
    "Impossible d'envoyer l'email de confirmation. Réessayez dans quelques instants.",
  requestFailed: 'Request failed',
};

const ApiBanano = {
  notAuthenticated: 'Non authentifié.',
  serverError: 'Erreur serveur.',
  noPinSet:
    'Aucun code PIN Banano défini. Créez-le à la première ouverture du terminal Banano.',
  serviceUnavailable: 'Service indisponible.',
  tooManyRequests: 'Trop de demandes. Réessayez dans une heure ou contactez le support.',
  saveFailed: 'Enregistrement impossible.',
  sendEmailFailed: "Impossible d'envoyer l'e-mail. Réessayez plus tard.",
};

const BillingEmails = {
  welcomePaid: 'Merci pour votre confiance ! Votre surveillance 24/7 est activée.',
  welcomeTrialZenith:
    "🚀 C'est parti ! Tes 14 jours d'accès Total Zénith commencent.",
  onboardingTrial: "🚀 C'est parti ! Tes 14 jours d'accès {planName} commencent.",
  onboardingPaid: '✅ Paiement confirmé : Bienvenue chez Reputexa ({planName})',
  establishmentAdded: 'Nouvel établissement configuré — REPUTEXA',
  upgradeConfirmation: 'Confirmation de mise à niveau — REPUTEXA',
  downgradeConfirmation: 'Changement de forfait — vos données sont conservées',
  monthlyInvoice: 'Votre facture Reputexa - {monthYear}',
  paymentFailed: 'Paiement échoué — Mettez à jour votre moyen de paiement',
  paymentActionRequired: 'Action requise : Validez votre paiement',
  planSelectionConfirmed: 'Confirmation de votre choix de plan — REPUTEXA',
};

const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
if (!fr.ApiAuth) fr.ApiAuth = {};
if (!fr.ApiBanano) fr.ApiBanano = {};
if (!fr.BillingEmails) fr.BillingEmails = {};
Object.assign(fr.ApiAuth, ApiAuth);
Object.assign(fr.ApiBanano, ApiBanano);
Object.assign(fr.BillingEmails, BillingEmails);
fs.writeFileSync(frPath, JSON.stringify(fr));
console.log('Merged ApiAuth, ApiBanano, BillingEmails');
