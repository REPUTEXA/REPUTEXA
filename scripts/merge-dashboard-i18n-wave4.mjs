/**
 * Vague 4 : Suggestions (modales, toasts, UI restants) + toasts Dashboard.establishments
 * Exécuter : node scripts/merge-dashboard-i18n-wave4.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'messages');

const SUGGESTIONS_FR = {
  lightbox: {
    alt: 'Aperçu suggestion',
    closeAria: 'Fermer',
  },
  doneModal: {
    title: 'Publier comme mise à jour',
    subtitle:
      "Rédigez ou générez l'annonce officielle avant de publier dans le changelog.",
    sourceLabel: 'Suggestion source',
    officialLabel: 'Annonce officielle',
    generateWithAi: "Générer avec l'IA",
    generating: 'Génération…',
    placeholder: "Cliquez sur « Générer avec l'IA » ou rédigez manuellement l'annonce…",
    cancel: 'Annuler',
    publish: 'Publier officiellement',
    publishing: 'Publication…',
    charCount: '{count} caractères',
    toastGenerated: 'Annonce générée avec succès !',
    errAi: 'Erreur IA',
    errGen: 'Erreur lors de la génération IA',
    errPublishEmpty: "Veuillez générer ou rédiger l'annonce avant de publier",
    toastPublished: 'Mise à jour publiée officiellement !',
    errPublish: 'Erreur lors de la publication',
  },
  deleteModal: {
    headline: 'Supprimer cette suggestion ?',
    previewLabel: 'Suggestion',
    bodyBefore: 'Cette action est ',
    bodyStrong: 'définitive',
    bodyAfter:
      '. La suggestion sera supprimée ainsi que la mise à jour associée, si elle existe.',
  },
  form: {
    errMic: 'Micro non accessible',
    errTranscription: 'Erreur transcription',
  },
  list: {
    adminModeBadge: 'Mode Admin',
    enlargeTitle: 'Cliquer pour agrandir',
    enlargeLabel: 'Agrandir',
    attachPhotoTitle: 'Joindre une photo (optionnel)',
    attachmentAlt: 'Photo jointe',
    removePhotoAria: 'Retirer la photo',
    micRecordTitle: 'Cliquer pour enregistrer un vocal (Whisper)',
    deleteSuggestionTitle: 'Supprimer cette suggestion',
    errLoadList: 'Erreur',
    errStatus: 'Erreur',
  },
  toasts: {
    suggestionDeleted: 'Suggestion supprimée.',
    errDelete: 'Erreur lors de la suppression',
  },
};

const SUGGESTIONS_EN = {
  lightbox: {
    alt: 'Suggestion preview',
    closeAria: 'Close',
  },
  doneModal: {
    title: 'Publish as product update',
    subtitle: 'Write or generate the official announcement before publishing to the changelog.',
    sourceLabel: 'Source suggestion',
    officialLabel: 'Official announcement',
    generateWithAi: 'Generate with AI',
    generating: 'Generating…',
    placeholder: 'Click “Generate with AI” or write the announcement manually…',
    cancel: 'Cancel',
    publish: 'Publish officially',
    publishing: 'Publishing…',
    charCount: '{count} characters',
    toastGenerated: 'Announcement generated successfully!',
    errAi: 'AI error',
    errGen: 'Error while generating with AI',
    errPublishEmpty: 'Please generate or write the announcement before publishing',
    toastPublished: 'Update published officially!',
    errPublish: 'Error while publishing',
  },
  deleteModal: {
    headline: 'Delete this suggestion?',
    previewLabel: 'Suggestion',
    bodyBefore: 'This action is ',
    bodyStrong: 'permanent',
    bodyAfter: '. The suggestion will be removed along with any linked update.',
  },
  form: {
    errMic: 'Microphone unavailable',
    errTranscription: 'Transcription error',
  },
  list: {
    adminModeBadge: 'Admin mode',
    enlargeTitle: 'Click to enlarge',
    enlargeLabel: 'Enlarge',
    attachPhotoTitle: 'Attach a photo (optional)',
    attachmentAlt: 'Attached photo',
    removePhotoAria: 'Remove photo',
    micRecordTitle: 'Click to record voice (Whisper)',
    errLoadList: 'Error',
    errStatus: 'Error',
  },
  toasts: {
    suggestionDeleted: 'Suggestion deleted.',
    errDelete: 'Error while deleting',
  },
};

const ESTABLISHMENTS_FR = {
  errLoad: 'Erreur chargement',
  errGeneric: 'Erreur',
  errTranscription: 'Erreur transcription',
  errNoTranscript: 'Aucune transcription détectée.',
  errAiVoice: 'Erreur IA',
  toastVoicePrefsOk: 'Préférences IA mises à jour depuis votre voix !',
  errVoiceAnalyze: 'Impossible d’analyser le vocal.',
  errMicDenied: 'Micro non accessible. Vérifiez les autorisations du navigateur.',
  toastReduceNextInvoice: 'La réduction de prix sera effective à la prochaine date de facturation.',
  toastSlotsUnlocked: 'Emplacements débloqués ! Configurez vos nouveaux établissements.',
  toastEstablishmentAdded:
    'Félicitations ! Votre nouvel établissement a été ajouté avec sa remise dégressive.',
  errNameMin: 'Le nom doit faire au moins 2 caractères.',
  toastEstablishmentActivated: 'Établissement activé !',
  toastDefaultProfile: 'Profil principal par défaut.',
  toastDefaultEstablishment: 'Établissement défini par défaut.',
  errPhoneInvalid: 'Numéro de téléphone invalide.',
  errWhatsappInvalid: 'Numéro WhatsApp invalide.',
  toastPrefsSaved: 'Modifications enregistrées. Les Paramètres reflètent les mêmes réglages.',
  errHeadquartersDelete: 'Le siège (profil) ne peut pas être supprimé ici.',
  errPaymentOpen: 'Erreur ouverture du paiement',
  toastEstablishmentDeleted: 'Établissement supprimé.',
  errStripePage: 'Impossible d’ouvrir la page Stripe.',
  errAddSlot: 'Erreur lors de l’ajout d’un emplacement.',
  errBillingPortal: "Impossible d'ouvrir le portail de facturation.",
  toastSlotsSynced: 'Emplacements synchronisés. Cliquez sur « À configurer » si besoin.',
  toastRetrySoon: 'Réessayez dans un instant.',
  toastDataKeptQuota:
    'Vos données sont conservées. Réaugmentez votre quota pour réactiver cet emplacement.',
  btnKeepData: 'Conserver les données',
  btnEdit: 'Modifier',
  btnDelete: 'Supprimer',
};

const ESTABLISHMENTS_EN = {
  errLoad: 'Load error',
  errGeneric: 'Error',
  errTranscription: 'Transcription error',
  errNoTranscript: 'No transcript detected.',
  errAiVoice: 'AI error',
  toastVoicePrefsOk: 'AI preferences updated from your voice!',
  errVoiceAnalyze: 'Could not analyze the recording.',
  errMicDenied: 'Microphone unavailable. Check browser permissions for this site.',
  toastReduceNextInvoice: 'The price reduction will apply on your next billing date.',
  toastSlotsUnlocked: 'Slots unlocked! Configure your new establishments.',
  toastEstablishmentAdded:
    'Congratulations! Your new establishment was added with its tiered discount.',
  errNameMin: 'Name must be at least 2 characters.',
  toastEstablishmentActivated: 'Establishment activated!',
  toastDefaultProfile: 'Main profile set as default.',
  toastDefaultEstablishment: 'Establishment set as default.',
  errPhoneInvalid: 'Invalid phone number.',
  errWhatsappInvalid: 'Invalid WhatsApp number.',
  toastPrefsSaved: 'Changes saved. Settings reflect the same preferences.',
  errHeadquartersDelete: 'The headquarters (profile) cannot be deleted here.',
  errPaymentOpen: 'Error opening payment',
  toastEstablishmentDeleted: 'Establishment deleted.',
  errStripePage: 'Unable to open the Stripe page.',
  errAddSlot: 'Error adding a slot.',
  errBillingPortal: 'Unable to open the billing portal.',
  toastSlotsSynced: 'Slots synced. Click “To configure” if needed.',
  toastRetrySoon: 'Try again in a moment.',
  toastDataKeptQuota: 'Your data is kept. Increase your quota to reactivate this slot.',
  btnKeepData: 'Keep data',
  btnEdit: 'Edit',
  btnDelete: 'Delete',
};

function mergeSuggestions(data, patch) {
  data.Suggestions = data.Suggestions || {};
  const s = data.Suggestions;
  s.lightbox = { ...(s.lightbox || {}), ...patch.lightbox };
  s.doneModal = { ...(s.doneModal || {}), ...patch.doneModal };
  s.deleteModal = { ...(s.deleteModal || {}), ...patch.deleteModal };
  s.form = { ...(s.form || {}), ...patch.form };
  s.list = { ...(s.list || {}), ...patch.list };
  s.toasts = { ...(s.toasts || {}), ...patch.toasts };
}

function mergeFile(filename, sugPatch, estPatch) {
  const p = path.join(messagesDir, filename);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  mergeSuggestions(data, sugPatch);
  data.Dashboard = data.Dashboard || {};
  data.Dashboard.establishments = {
    ...(data.Dashboard.establishments || {}),
    ...estPatch,
  };
  fs.writeFileSync(p, JSON.stringify(data));
}

mergeFile('fr.json', SUGGESTIONS_FR, ESTABLISHMENTS_FR);
mergeFile('en.json', SUGGESTIONS_EN, ESTABLISHMENTS_EN);

console.log('merge-dashboard-i18n-wave4: Suggestions + Dashboard.establishments (fr, en)');
