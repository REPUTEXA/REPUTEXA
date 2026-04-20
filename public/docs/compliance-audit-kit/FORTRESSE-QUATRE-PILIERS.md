# Forteresse REPUTEXA — quatre piliers (RGPD client, droit du travail, B2B, transparence & technique)

Document de **cadrage audit-ready** : articulation entre **exigences « niveau conseil »**, **textes publiés** et **mécanismes techniques** dans le dépôt.  
*Aucun document ne remplace l’avis d’un avocat ou d’un DPO sur votre situation.*

**Voir aussi :** [GUIDE-COMPLET-VERIFICATION-CONFORMITE.md](./GUIDE-COMPLET-VERIFICATION-CONFORMITE.md)

---

## Sommaire

1. [Bouclier RGPD — client final](#1-bouclier-rgpd--client-final)
2. [Cadre social — patron & équipe](#2-cadre-social--patron--équipe)
3. [Responsabilité contractuelle B2B](#3-responsabilité-contractuelle-b2b)
4. [Transparence — affichage & information](#4-transparence--affichage--information)
5. [Technique « inattaquable » (minimalisme honnête)](#5-technique-inattaquable-minimalisme-honnête)
6. [Écarts à surveiller / questions produit](#6-écarts-à-surveiller--questions-produit)

---

## 1. Bouclier RGPD — client final

| Exigence (votre checklist) | Articulation contractuelle / publique | Implémentation / preuves techniques (extraits) |
|----------------------------|----------------------------------------|-----------------------------------------------|
| **Finalité unique** (téléphone → demande d’avis, amélioration liée à la visite) | Politique de confidentialité (`messages/legal-fr.json` — sections Zenith, rôles, durées). CGU § Zenith (obligations commerçant). | File d’avis / Zenith : traitements documentés dans le registre HTML public ; flux limité au produit « avis / satisfaction ». |
| **Interdiction de relance abusive** | Mentions durées + opposition. | `lib/zenith-capture/policy.ts` + `can-contact.ts` : **pas de nouvelle campagne de sollicitation** sur le même numéro avant **120 jours** depuis le début de la précédente (`contact_history` + file `review_queue`). **À J+120**, nouvelle sollicitation à nouveau possible **hors STOP**. À valider juridiquement si vous promettez « un seul message » strict : le produit envoie une **sollicitation initiale** puis un **fil conversationnel** (réponses client) — voir §6. |
| **Droit à l’oubli / minimisation (~120 j.)** | Politique : identifiants en file anonymisés / supprimés **au plus tard** à 120 j. | Cron `app/api/cron/send-messages/route.ts` (bloc anonymisation) ; `send-zenith-messages` — `queueRetentionCutoffIso()` / `ZENITH_QUEUE_RETENTION_DAYS` ; vérifier alignement **durées réelles** BDD vs texte publié lors des évols schéma. |
| **STOP → opposition définitive** | Politique liste noire. | `addToBlacklist` dans `can-contact.ts` ; table `blacklist` ; webhook / parsing STOP côté conversations — garder **preuve** (`consent_logs`, §5). |
| **Page de droits hors WhatsApp (effacement)** | Paragraphe « clients finaux » + lien formulaire. | Route publique formulaire : `app/[locale]/data-rights/client/page.tsx`, API `app/api/public/client-data-erasure/route.ts`, `lib/end-client-erasure.ts`. URL typique : `/fr/data-rights/client` (adapter locale / domaine). |

**Actions dossier contrôle :** captures d’écran datées de la politique + **export** du registre ; extrait SQL ou rapport montrant anonymisation / blacklists sur échantillon **anonymisé**.

---

## 2. Cadre social — patron & équipe

| Exigence | Côté REPUTEXA (SaaS) | Côté employeur (obligations du marchand) |
|----------|----------------------|------------------------------------------|
| **Information préalable** des salariés avant challenge / points | Le produit fournit des **classements** et un **lien équipe** ; la **démarche RH** (information, IR, accords) est **à la charge du marchand**. | Documenter en interne : date d’information, supports (note service, CSE le cas échéant). |
| **Finalité valorisante** (récompense, pas surveillance sanction) | Les **CGU** (fallback JSON) précisent le **cadre d’usage loyal** — à relire par le conseil du marchand pour les déclinaisons internes (prime, jeu, charte). | Règlement interne / note RH : pas de lien automatique avec sanction disciplinaire. |
| **Accès restreint** au tableau d’équipe | Partage par **jeton** (`099_reputexa_team_share_token.sql`, page `defi-reputexa/equipe/[token]`), **robots noindex** sur la page équipe. | Ne pas diffuser le lien sur des canaux publics ; rotation du jeton si fuite. |
| **Exactitude des noms** | L’outil affiche ce que le **marchand saisit**. | CGU : garantie d’exactitude et de droit à l’image / dignité — charge du marchand. |

---

## 3. Responsabilité contractuelle B2B

| Exigence | Où c’est posé | Détail |
|----------|---------------|--------|
| **Rôles : responsable vs sous-traitant** | Politique de confidentialité (`roles_rgpd_content`) ; CGU Zenith. | Marchand = responsable des données **clients finaux** pour leurs traitements métiers ; REPUTEXA exécute sur **instructions** (paramètres, webhooks). |
| **Interdiction spam / pub / newsletter** | CGU § responsabilité / Zenith (renforcé dans le JSON fallback). | Engagement du **marchand** ; répression possible (suspension CGU) en cas d’abus manifeste. |
| **Exactitude des données** (dont noms équipe) | CGU § responsabilité. | Marchand indemnise / supporte les litiges en cas de contenu illicite ou inexact. |

**À tenir à jour :** DPA / annexe traitement signée avec gros comptes ; copie dans le dossier Drive du kit.

---

## 4. Transparence — affichage & information

| Exigence | Livrable produit / doc |
|----------|-------------------------|
| **Identité REPUTEXA + rôle** | Modèle annexe « fidélité / caisse / WhatsApp » dans les CGU ; affiche PDF `lib/compliance-poster-pdf-server.tsx` (génération publique). |
| **Canal WhatsApp explicite** | Même annexe + politique « Zenith captation ». |
| **Pas d’usage publicitaire** (information loyale) | Texte politique + affiche (mentionner finalité limitée). |
| **Lien vers politique complète** | Affiche : URL confidentialité + URL effacement clients finaux (`erasureUrl`). |

**Process :** à chaque changement de domaine ou de chemin légal, régénérer l’affiche et les QR / liens imprimés en caisse.

---

## 5. Technique « inattaquable » (minimalisme honnête)

| Exigence | Réalité dans le projet | Limite connue |
|----------|-------------------------|---------------|
| **Chiffrement en transit** | HTTPS Vercel / TLS vers APIs (Stripe, Supabase, Twilio, etc.). | Vérifier **TLS minimum** côté intégrations self-hosted si un jour hors Vercel. |
| **Cloisonnement multi-tenant** | Supabase **RLS** sur tables métier (migrations, politiques par `user_id` / établissement). | Revue obligatoire **à chaque nouvelle table** ; tests d’intrusion logique (requête cross-user). |
| **Preuve STOP / opposition** | `consent_logs` (`lib/consent-log.ts`) — trace avec **hash téléphone**, type `yes` / `no` / `stop`, horodatage. | Prouver que **aucun envoi** ultérieur n’a lieu : enchaînement `blacklist` + crons à auditer. |

**Ne pas promettre « inattaquable »** aux clients : formulations type **« mesures appropriées / état de l’art raisonnable »** dans les contrats.

---

## 6. Écarts à surveiller / questions produit

1. **« Un seul message WhatsApp »** (strict) vs **fil conversationnel** (plusieurs bulles après réponse du client). Aujourd’hui : **une sollicitation initiale** gate-keepée par 90 j. + blacklist ; les relances du fil doivent être **conformes** au cadre ePrivacy / consentement — **valider la formulation contractuelle** avec le conseil (FR + pays cibles).

2. **Durée liste noire « sans limite fixée »** (politique) : cohérent pour **opposition** ; documenter la **base légale** (intérêt légitime / exécution opposition) dans le registre.

3. **Publication CGU depuis l’admin** : si vous utilisez le HTML publié (`legal_versioning`), le **fallback JSON** (`messages/legal-fr.json`) peut être **en retard** par rapport au texte « officiel » — process : soit sync, soit une seule source de vérité.

4. **Employés hors UE** : si vous ouvrez des marchés, dupliquer les analyses droit du travail locaux.

---

## Calendrier suggéré (rappel)

| Fréquence | Action |
|-----------|--------|
| **Mensuelle** | Spot-check : STOP sur un numéro de test → pas de ré-envoi ; consent_logs alimenté. |
| **Trimestrielle** | PDF politique + CGU datés ; CSV sous-traitants ; relecture paragraphe Zenith / affiche. |
| **À chaque feature** touchant PII | RLS + registre + texte légal + emplacement logs (`emplacements-logs.md`). |

---

*Dernière mise à jour rédactionnelle : mars 2026 (alignement avec le dépôt aaaempire-reputation-ai).*
