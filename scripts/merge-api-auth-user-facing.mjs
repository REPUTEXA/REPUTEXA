/**
 * Merge user-facing Api.* keys for auth routes (FR + EN source; es–zh copy EN).
 * Run: node scripts/merge-api-auth-user-facing.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const EXTRA_FR = {
  auth_rateLimit: 'Trop de tentatives. Veuillez patienter une minute.',
  auth_magicLink_invalidEmail: 'Adresse e-mail invalide.',
  auth_magicLink_captchaRequired: 'Vérification de sécurité requise.',
  auth_magicLink_captchaFailed: 'Vérification de sécurité échouée. Réessayez.',
  auth_magicLink_generateFailed: 'Impossible de générer le lien de connexion.',
  auth_magicLink_sendFailed: 'Envoi e-mail impossible.',
  auth_magicLink_requestFailed: 'Échec de la demande.',
  auth_signup_emailRequired: 'E-mail requis.',
  auth_signup_accountExists:
    'Ce compte existe déjà. Veuillez vous connecter ou utiliser un autre e-mail.',
  auth_signup_userNotCreated: 'Utilisateur non créé.',
  auth_signup_otpCreateFailed: 'Échec de la création du code.',
  auth_signup_failed: "Échec de l'inscription.",
  auth_signup_createUserFailed: 'Impossible de créer le compte. Vérifiez les informations ou réessayez.',
  auth_signup_emailSendFailed: "Impossible d'envoyer l'e-mail de confirmation. Réessayez plus tard.",
  auth_signup_devOtp: 'Compte créé. Code OTP (dev) : ',
  auth_resend_devOtp: 'Code renvoyé (dev) : ',
  auth_resend_emailRequired: 'E-mail requis.',
  auth_resend_noPendingOtp:
    "Aucun code en attente pour cet e-mail. Vérifiez l'adresse, ou attendez quelques secondes et réessayez si vous venez de créer votre compte.",
  auth_resend_otpCreateError: 'Erreur lors de la création du code.',
  auth_resend_sendFailed: "Impossible d'envoyer l'e-mail.",
  auth_resend_failed: 'Erreur lors du renvoi du code.',
  auth_emailChange_newRequired: 'Nouvelle adresse e-mail requise.',
  auth_emailChange_sessionExpired: 'Session expirée. Reconnectez-vous.',
  auth_emailChange_sameEmail: "La nouvelle adresse est identique à l'adresse actuelle.",
  auth_emailChange_generateFailed: 'Impossible de générer le lien de confirmation.',
  auth_emailChange_sendFailed:
    "Impossible d'envoyer l'e-mail de confirmation. Réessayez dans quelques instants.",
  auth_emailChange_requestFailed: 'Échec de la demande.',
};

const EXTRA_EN = {
  auth_rateLimit: 'Too many attempts. Please wait a minute.',
  auth_magicLink_invalidEmail: 'Invalid email address.',
  auth_magicLink_captchaRequired: 'Security verification required.',
  auth_magicLink_captchaFailed: 'Security verification failed. Try again.',
  auth_magicLink_generateFailed: 'Could not generate the sign-in link.',
  auth_magicLink_sendFailed: 'Could not send the email.',
  auth_magicLink_requestFailed: 'Request failed.',
  auth_signup_emailRequired: 'Email is required.',
  auth_signup_accountExists: 'This account already exists. Sign in or use another email.',
  auth_signup_userNotCreated: 'User was not created.',
  auth_signup_otpCreateFailed: 'Could not create the verification code.',
  auth_signup_failed: 'Signup failed.',
  auth_signup_createUserFailed: 'Could not create the account. Check your details or try again.',
  auth_signup_emailSendFailed: 'Could not send the confirmation email. Try again later.',
  auth_signup_devOtp: 'Account created. OTP code (dev): ',
  auth_resend_devOtp: 'Code resent (dev): ',
  auth_resend_emailRequired: 'Email is required.',
  auth_resend_noPendingOtp:
    'No pending code for this email. Check the address, or wait a few seconds and try again if you just signed up.',
  auth_resend_otpCreateError: 'Error while creating the code.',
  auth_resend_sendFailed: 'Could not send the email.',
  auth_resend_failed: 'Could not resend the code.',
  auth_emailChange_newRequired: 'New email address is required.',
  auth_emailChange_sessionExpired: 'Session expired. Sign in again.',
  auth_emailChange_sameEmail: 'The new address is the same as your current address.',
  auth_emailChange_generateFailed: 'Could not generate the confirmation link.',
  auth_emailChange_sendFailed: 'Could not send the confirmation email. Try again shortly.',
  auth_emailChange_requestFailed: 'Request failed.',
};

const LOCALES = { fr: EXTRA_FR, en: EXTRA_EN, es: EXTRA_EN, de: EXTRA_EN, it: EXTRA_EN, pt: EXTRA_EN, ja: EXTRA_EN, zh: EXTRA_EN };

for (const [loc, extra] of Object.entries(LOCALES)) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.Api) j.Api = {};
  Object.assign(j.Api, extra);
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('merged Api auth keys →', loc);
}
