import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frPath = path.join(__dirname, '..', 'messages', 'fr.json');

const extra = {
  pageTitle: 'Avis',
  pageSubtitle: 'Gérez vos avis et la file de publication automatique.',
  queueSectionTitle: "Réponses IA · file d'attente",
  queueSectionDesc:
    "Publication différée de quelques heures (comportement humain). Compte à rebours affiché ; vous pouvez modifier le texte tant que ce n'est pas publié. « Publier maintenant » saute le délai.",
  queueEmpty: 'Aucun avis en file automatique.',
  paginationRange: 'Affichage {from}–{to} sur {total}',
  paginationPrev: 'Précédent',
  paginationNext: 'Suivant',
  publishedTitle: 'Publiés',
  publishedDesc:
    "Réponses passées en statut publié (y compris après la file d'attente).",
  publishedEmpty: 'Aucune réponse publiée sur cette période / cet établissement.',
  publicationScheduled: 'Publication prévue : {time}',
  seoBoostBadge: '🚀 Boosté',
  save: 'Enregistrer',
  cancel: 'Annuler',
  editResponse: 'Modifier la réponse',
  publishNow: 'Publier maintenant',
  cancelScheduled: 'Annuler',
  quickLink: 'Lien rapide →',
  generateWithAi: "Générer avec l'IA",
  generateResponse: 'Générer une réponse IA',
  generating: 'Génération…',
};

const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
if (!fr.Dashboard) fr.Dashboard = {};
if (!fr.Dashboard.reviewsPage) fr.Dashboard.reviewsPage = {};
Object.assign(fr.Dashboard.reviewsPage, extra);
fs.writeFileSync(frPath, JSON.stringify(fr));
console.log('Merged reviews page keys:', Object.keys(extra).length);
