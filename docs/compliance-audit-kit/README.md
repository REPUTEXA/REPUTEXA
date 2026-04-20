# Dossier « prêt contrôle » — REPUTEXA

Ce dossier sert à **constituer un classeur unique** (Google Drive, SharePoint, ou dossier local chiffré) pour un **contrôle CNIL**, un **audit client B2B**, ou un **due diligence**.  
Ce n’est **pas** une fonctionnalité produit : c’est **l’organisation** du responsable / sous-traitant.

**Guide exhaustif (tout vérifier, tout tenir à jour, fréquences, limites du « 100 % ») :**  
→ [`GUIDE-COMPLET-VERIFICATION-CONFORMITE.md`](./GUIDE-COMPLET-VERIFICATION-CONFORMITE.md) (copié automatiquement vers `/docs/compliance-audit-kit/` au build, comme ce README).

**Quadripilier juridique & technique (RGPD client, droit du travail, B2B, transparence, preuves code) :**  
→ [`FORTRESSE-QUATRE-PILIERS.md`](./FORTRESSE-QUATRE-PILIERS.md)

---

## Étape 1 — Registre des traitements (Art. 30 RGPD)

| Action | Détail |
|--------|--------|
| Source dans le projet | `public/docs/registre-rgpd-reputexa.html` |
| URL publique (prod) | `https://reputexa.fr/docs/registre-rgpd-reputexa.html` (adapter le domaine si besoin) |
| Pour le dossier contrôle | Ouvrir l’URL dans le navigateur → **Imprimer** → **Enregistrer au format PDF**. Archiver le PDF avec une **date** dans le nom, ex. `registre-rgpd-reputexa_2026-03.pdf`. |

À chaque **modification substantielle** du registre : régénérer le PDF et conserver l’ancienne version (historique).

---

## Étape 2 — Politiques et mentions publiées

À stocker dans le dossier (PDF ou **liens datés** + capture d’écran optionnelle) :

- Politique de confidentialité (URL site)
- CGU / CGV utilisateurs REPUTEXA
- Mentions légales
- Toute page « légal » liée depuis le footer

**Astuce :** une fois par trimestre, export PDF ou Wayback / capture pour prouver le texte **à une date donnée**.

---

## Étape 3 — Liste des sous-traitants + DPA

1. Copier le modèle `liste-sous-traitants.csv` dans ton Drive.
2. Pour **chaque** prestataire (Supabase, Stripe, Resend, Twilio, Vercel, OpenAI/Anthropic si applicable, etc.) :
   - Remplir le rôle (hébergement BDD, emails, paiement, WhatsApp, etc.)
   - Coller le **lien** vers la page **DPA / GDPR** du fournisseur
   - Noter la **date** à laquelle **toi** (entreprise) as accepté le DPA ou les CGU à jour (souvent visible dans le compte ou par email de confirmation).

Mettre à jour ce fichier **à chaque nouveau sous-traitant** ou changement majeur.

---

## Étape 4 — Où sont les logs et preuves opérationnelles

Remplir le gabarit `emplacements-logs.md` (ou le tableau équivalent dans Drive) avec **tes** URLs de dashboard et la **nature** des preuves (emails envoyés, paiements, requêtes SQL, etc.).

Références typiques :

| Service | Ce qu’on y trouve en général |
|---------|------------------------------|
| **Resend** | Historique d’envoi des emails transactionnels |
| **Stripe** | Paiements, abonnements, factures, clients |
| **Supabase** | Données applicatives, logs projet (selon offre), région du projet |
| **Vercel** | Logs de déploiement / runtime (selon config) |
| **Twilio** | Logs messages WhatsApp / SMS, erreurs d’envoi |

---

## Étape 5 — Preuves dans l’application (pour un dossier client précis)

- Export JSON utilisateur : **Paramètres** → Données personnelles (RGPD) → téléchargement (Art. 20).
- Base : tables `consent_logs`, `profiles`, `review_queue`, etc. (accès réservé, traçabilité des accès).

Ne pas stocker des exports **clients** dans le même dossier public que le registre : **séparer** dossier « cadre général » et dossier « dossier personne X ».

---

## Checklist rapide avant un contrôle

- [ ] PDF registre à jour
- [ ] Liens / PDF politiques à jour
- [ ] CSV sous-traitants à jour + dates DPA
- [ ] Fiche emplacements logs à jour
- [ ] Liste des personnes avec accès admin (Supabase, Stripe, etc.) — hors repo, note interne sécurisée

---

## Rester à jour en continu (sans tout refaire à la main)

| Fréquence | Action |
|-----------|--------|
| **À chaque** nouveau sous-traitant ou changement de flux produit | Mettre à jour le CSV sous-traitants + la politique / registre si besoin. |
| **À chaque** publication de documents légaux (admin) | Régénérer le PDF du registre ; les comptes marchands voient la modale de ré-acceptation si la version a augmenté. |
| **Trimestriel** | Export ou capture datée des pages légales (preuve du texte à une date donnée). |
| **Annuel** (ou avant levée de fonds / gros client) | Point juridique sur clauses sensibles (Zenith, transferts hors UE, responsabilité). |
| **DPA fournisseurs** | Noter dans le CSV la date d’acceptation à chaque renouvellement de conditions. |

**Côté produit** : la validation marchand (confirm-email / Collecte d’avis) enregistre désormais un **horodatage** et le **numéro de version légale** (`legal_versioning`) au moment de l’acceptation — utile en contrôle pour prouver l’alignement avec le texte publié.

---

## Accès rapide (équipe admin)

Dans l’application : **Tableau de bord → Panel Admin → Kit dossier contrôle** (`/…/dashboard/admin/compliance-audit-kit`). Cette page liste des **liens uniquement** (guide README, registre HTML, modèle CSV, pages légales) — **aucune donnée sensible**.

Une copie du README, du **guide complet**, du CSV et du gabarit `emplacements-logs.md` est servie sous `/docs/compliance-audit-kit/` (générée **automatiquement** depuis ce dossier à chaque `npm run dev` et `npm run build` — script `compliance-kit:sync`).

---

*Document interne REPUTEXA — à adapter avec ton conseil juridique si besoin.*
