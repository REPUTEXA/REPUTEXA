# Guide complet — vérification et maintien « audit-ready » (REPUTEXA)

Ce document regroupe **tout ce qu’il faut vérifier**, **ce qu’il faut garder à jour**, **comment le faire** et **à quelle fréquence**, pour constituer un dossier **défendable** face à un contrôle CNIL, un audit client B2B ou un due diligence.

> **Important.** Aucun guide ne peut garantir un « 100 % juridique » : la loi et la jurisprudence évoluent, et seul un **conseil adapté à votre situation** peut trancher. Ici, « à 100 % » signifie : **preuves cohérentes, process documentés, données techniques alignées avec les textes publiés** — c’est-à-dire un niveau **audit-ready** raisonnable.

---

## Table des matières

1. [Principes](#1-principes)
2. [Inventaire technique (code + base + infra)](#2-inventaire-technique-code--base--infra)
3. [Données applicatives et traçabilité](#3-données-applicatives-et-traçabilité)
4. [Parcours produit à contrôler](#4-parcours-produit-à-contrôler)
5. [Documents hors application (Drive, PDF, CSV)](#5-documents-hors-application-drive-pdf-csv)
6. [Sécurité, accès et sous-traitance](#6-sécurité-accès-et-sous-traitance)
7. [Matrices de fréquence](#7-matrices-de-fréquence)
8. [Checklists condensées](#8-checklists-condensées)
9. [Ce qui n’est pas (et ne sera jamais) dans le dépôt Git](#9-ce-qui-nest-pas-et-ne-sera-jamais-dans-le-dépôt-git)
10. [Annexe — références code REPUTEXA](#10-annexe--références-code-reputexa)
11. [Sujets souvent hors d’un guide produit (à traiter à part)](#11-sujets-souvent-hors-dun-guide-produit-à-traiter-à-part)
12. [Calendrier opérationnel — que faire, quand](#12-calendrier-opérationnel--que-faire-quand)

---

## 1. Principes

| Principe | Ce que ça implique |
|----------|-------------------|
| **Une seule source de vérité pour le texte légal publié** | Version dans `legal_versioning` + contenu affiché (messages / pages légales) alignés après chaque publication admin. |
| **Preuve datée** | Horodatages en base, exports PDF datés, captures ou Wayback pour les pages publiques si besoin. |
| **Séparation des dossiers** | Dossier « cadre général » (registre, politiques, CSV) **≠** dossiers « personne X » (exports RGPD individuels). |
| **Minimisation** | Ne stocker nulle part des copies inutiles de données clients dans des endroits non sécurisés. |

---

## 2. Inventaire technique (code + base + infra)

### 2.1 Migrations Supabase

| À vérifier | Comment | Fréquence |
|------------|---------|-----------|
| Schéma `profiles` : conformité marchand | Colonnes `legal_compliance_accepted`, `legal_compliance_accepted_at`, `legal_compliance_accepted_legal_version` (migration **093** et cohérence avec le code TypeScript `types/`) | Après chaque migration touchant `profiles` |
| Table `legal_versioning` | Existe, contient au moins une ligne **publiée** par type de document pertinent ; `version` incrémentée à chaque publication | Après première mise en prod ; puis à chaque publication légale |
| Table `consent_logs` | Politiques RLS cohérentes ; enregistrements présents quand le produit collecte des consentements en conditions réelles | Revue après changement de flux consentement |
| Autres tables métier | `review_queue`, établissements, etc. : accès réservé (RLS / rôles) | Revue sécurité ou avant audit |

### 2.2 Variables d’environnement et secrets

| Zone | Vérifier |
|------|----------|
| Supabase (URL, clés service vs anon) | Clés service **jamais** exposées au client ; rotation documentée si fuite |
| Stripe, Resend, Twilio, etc. | Comptes au nom de l’entité contractante ; facturation et DPA à jour (voir CSV) |
| Hébergeur (ex. Vercel) | Région / conformité ; qui a accès au projet |

### 2.3 Contenu légal dans l’app (i18n)

| Fichier / zone | Action |
|----------------|--------|
| `messages/fr.json` — bloc **Legal** | Texte à jour, cohérent avec la version publiée dans l’admin |
| `messages/legal-fr.json` | Aligné avec les routes légales (sync manuel ou process d’équipe si vous dupliquez) |
| `messages/en.json` | Si vous exposez l’anglais : fournir un bloc Legal complet ou stratégie de repli documentée |

### 2.4 Scripts et kit dossier contrôle

| Élément | Rôle |
|---------|------|
| `npm run compliance-kit:sync` | Copie `README.md`, `liste-sous-traitants.csv`, `emplacements-logs.md`, **GUIDE-COMPLET** vers `public/docs/compliance-audit-kit/` |
| Page admin **Kit dossier contrôle** | Liens vers ces documents ; aucune donnée sensible dans la page |

---

## 3. Données applicatives et traçabilité

### 3.1 Table `legal_versioning`

- **À jour** : après chaque publication depuis l’admin (document_type, version, statut publié, résumé des changements si utilisé).
- **Vide en prod** : souvent signe qu’aucune publication n’a été faite ou que l’environnement est neuf — **à corriger avant de parler de traçabilité complète**.

### 3.2 Profil marchand (`profiles`)

| Champ | Utilité en contrôle |
|-------|---------------------|
| `legal_compliance_accepted` | Booléen « a accepté les conditions » |
| `legal_compliance_accepted_at` | Preuve d’**horodatage** |
| `legal_compliance_accepted_legal_version` | Lien avec **la version globale** `legal_versioning.version` au moment de l’acceptation |
| `last_legal_agreement_version` (si utilisé ailleurs) | Cohérence avec les flux qui mettent à jour ce champ |

### 3.3 Table `consent_logs`

- Vérifier que les **événements** importants y sont enregistrés (ex. flux **WhatsApp** / messages entrants — voir `lib/consent-log.ts` et webhooks associés), avec les bons **identifiants** et **horodatages**.
- D’autres canaux (newsletter, cookies, etc.) : à valider selon ce qui est **réellement** déployé côté produit et marketing.
- **Vide** peut être normal **avant** trafic / avant fonctionnalités actives — pas une « erreur » en soi, mais à **expliquer** dans un dossier.

### 3.4 APIs utiles à connaître (revue code / doc interne)

- Publication légale : routes admin sous `app/api/admin/legal/`.
- Acceptation marchand : `app/api/profile/accept-merchant-compliance` (ou équivalent).
- Version « latest » pour le front : `app/api/legal/latest-version` (vérifier alignement avec `legal_versioning`).

---

## 4. Parcours produit à contrôler

### 4.1 Inscription / confirmation email (`confirm-email`)

- Après validation, l’utilisateur doit enchaîner vers le flux prévu (ex. acceptation conformité **avant** paiement Stripe si c’est votre règle métier).
- Vérifier en base : `legal_compliance_accepted_at` et version renseignés quand l’utilisateur a validé.

### 4.2 Collecte d’avis / configuration e-commerce (ex. `collecte-avis`)

- Sauvegarde configuration : doit **enregistrer** l’audit conformité (version légale courante) si c’est le design produit.
- Toute **case / modale** « j’accepte » doit correspondre à un **enregistrement** exploitable (profil + version).

### 4.3 Automatisations (ex. envoi Zenith / webhooks)

- Vérifier les **garde-fous** : ne pas envoyer certains messages si `legal_compliance_accepted` est faux — ex. cron `send-zenith-messages` (motif `legal_compliance_required`), et routes **`/api/webhooks/zenith`** et **`/api/webhooks/[api_key]`** (même principe pour les envois déclenchés par webhook).
- Tester après changement de règles métier.

### 4.4 Export et suppression de compte (RGPD)

- **Art. 20 — Portabilité / copie** : API `GET /api/user/gdpr/export` (JSON : profil, file d’attente, `consent_logs`, etc.) ; déclenché depuis **Paramètres** (`dashboard/settings`).
- **Effacement** : parcours de suppression de compte (API associée sous `app/api/user/gdpr/`) — vérifier que la **cascade** / anonymisation en base correspond à ce qui est promis dans la politique.
- Ne pas archiver les exports individuels dans le **même** dossier public que le registre général.

---

## 5. Documents hors application (Drive, PDF, CSV)

| Document | Emplacement type | Mise à jour |
|----------|------------------|-------------|
| **Registre des traitements (Art. 30)** | `public/docs/registre-rgpd-reputexa.html` → PDF daté dans le Drive | À chaque traitement nouveau ou modification substantielle |
| **Politique de confidentialité, CGU, mentions** | URLs + PDF ou capture datée | Trimestriel ou à chaque changement |
| **`liste-sous-traitants.csv`** | Copie dans Drive ; modèle dans ce dossier | À chaque nouveau sous-traitant ou changement DPA |
| **`emplacements-logs.md`** | Où trouver les preuves (Resend, Stripe, Supabase, Vercel, Twilio…) | Quand vous changez d’outil ou d’URL de dashboard |
| **Ce guide** | Même dossier + copie sous `/docs/compliance-audit-kit/` après build | Quand vous changez de process ou de périmètre technique |

---

## 6. Sécurité, accès et sous-traitance

- Liste **à jour** des personnes avec accès **admin** (Supabase, Stripe, hébergeur, messagerie) — **hors repo**, note interne sécurisée.
- Revue **annuelle** (ou avant levée de fonds) : clauses sensibles (sous-traitance, transferts hors UE, responsabilité) avec **avocat** si nécessaire.
- Pour chaque sous-traitant : ligne dans le CSV + **lien DPA / GDPR** + **date d’acceptation** des conditions par l’entreprise.

---

## 7. Matrices de fréquence

### 7.1 À chaque événement

| Événement | Actions |
|-----------|---------|
| Nouveau sous-traitant | CSV + registre + politique si mention du traitement |
| Publication légale (admin) | Vérifier `legal_versioning` ; régénérer PDF registre si le registre cite ce texte ; informer l’équipe si ré-acceptation marchands |
| Nouvelle migration DB touchant PII | RLS, types TS, exports RGPD, registre |
| Changement de flux (signup, paiement, emails) | Parcours de test + champs d’audit + `consent_logs` si applicable |

### 7.2 Mensuel (ou selon volume)

- Coup d’œil sur **erreurs** d’envoi (email, SMS, webhooks) dans les dashboards listés dans `emplacements-logs.md`.
- Vérifier qu’aucun accès admin **inutile** n’a été ajouté.

### 7.3 Trimestriel

- Export ou **capture datée** des pages légales publiques (preuve du texte à une date donnée).
- Relecture rapide du **CSV** sous-traitants (liens DPA toujours valides).

### 7.4 Annuel

- PDF registre **daté** dans l’archive + version précédente conservée.
- Point juridique / conformité (interne ou conseil externe) sur l’évolution produit et les transferts de données.

---

## 8. Checklists condensées

### 8.1 Avant mise en production (ou grosse release)

- [ ] `legal_versioning` peuplé et document publié pour les types concernés  
- [ ] Flux confirm-email + collecte d’avis testés ; champs d’audit renseignés en base  
- [ ] Garde-fous automatisations (Zenith / crons) alignés avec `legal_compliance_accepted`  
- [ ] Variables d’environnement et secrets vérifiés  
- [ ] `npm run compliance-kit:sync` OK ; liens admin vers le kit fonctionnels  

### 8.2 Avant un contrôle / audit client

- [ ] PDF registre à jour (nom de fichier avec **date**)  
- [ ] Politiques + mentions : liens + PDF ou captures **datées**  
- [ ] CSV sous-traitants + dates DPA  
- [ ] `emplacements-logs.md` à jour  
- [ ] Liste des accès admin à jour (hors repo)  
- [ ] Échantillon : quelques profils avec `legal_compliance_accepted_at` / version **cohérents** avec `legal_versioning`  

### 8.3 « Tout à jour » — synthèse ultra courte

| Quoi | Où | Comment savoir que c’est OK |
|------|-----|----------------------------|
| Version légale publiée | DB `legal_versioning` | Ligne(s) publiée(s), `version` cohérente avec l’UI |
| Acceptation marchand | `profiles` | Horodatage + version non nuls après acceptation réelle |
| Consentements | `consent_logs` | Événements présents pour les flux en production |
| Preuves externes | Drive | PDF registre, CSV, captures légales, fiche logs |
| Code / kit | Repo | Ce guide + README du kit ; sync vers `public/` |

---

## 9. Ce qui n’est pas (et ne sera jamais) dans le dépôt Git

- Décisions juridiques **conclusives** sur votre cas (Zenith, clauses, transferts hors UE).
- **DPA signés** ou emails de confirmation fournisseurs (à stocker dans le Drive / outil contractuel).
- **Registre** au format PDF archivé — le HTML dans le repo est la base ; l’**archive datée** est votre responsabilité documentaire.
- **Exports de données personnes** issues de demandes RGPD (hors périmètre du kit général).

---

## 10. Annexe — références code REPUTEXA

À utiliser pour **revue technique** ou handover (chemins indicatifs, évolutifs) :

| Sujet | Fichiers / routes typiques |
|-------|----------------------------|
| Publication légale admin | `app/api/admin/legal/` (ex. `publish`) |
| Version affichée / latest | `app/api/legal/latest-version` |
| Acceptation marchand | `app/api/profile/accept-merchant-compliance` ; flux `confirm-email`, `collecte-avis` |
| Gate conformité automatisations | `app/api/cron/send-zenith-messages`, `app/api/webhooks/zenith`, `app/api/webhooks/[api_key]` |
| Export / effacement RGPD | `app/api/user/gdpr/export`, `app/api/user/gdpr/delete-account` ; UI `dashboard/settings` |
| Journal consentements | `lib/consent-log.ts` ; webhooks WhatsApp etc. |
| Schéma & audit profil | `supabase/migrations` (ex. 087, 089, 092, 093), `types/index.ts` |
| Kit dossier & sync | `scripts/sync-compliance-kit-public.ts`, `npm run compliance-kit:sync` |

---

## 11. Sujets souvent hors d’un guide produit (à traiter à part)

Le guide ci-dessus couvre **alignement produit ↔ données ↔ preuves documentaires**. Il ne remplace pas :

| Sujet | Pourquoi c’est à part |
|-------|------------------------|
| **Violation de données** (notification CNIL / personnes, registre interne) | Procédure organisationnelle + délais légaux ; souvent un **plan de réponse** dédié. |
| **AIPD / DPIA** | Selon risques (profilage, IA, grande échelle) — décision et documentation hors README. |
| **Cookies & traceurs** (bannière, refus, durées) | Outil CMP, politique cookies, liste des traceurs — souvent **marketing + juridique**. |
| **Contrats clients B2B** (DPA signé avec **vos** clients marchands) | Hors code ; dossier commercial / juridique. |
| **RH, paie, compta** | Données salariés / sous-traitance interne — autre registre ou annexes. |
| **Assurance cyber / responsabilité** | Police et exclusions — pas dans le repo. |

---

## 12. Calendrier opérationnel — que faire, quand

Cette section résume **l’usage concret** du guide : checklist + rythme, sans tout relire chaque semaine.

### 12.1 Comment s’en servir au quotidien

| Usage | Détail |
|-------|--------|
| **Référentiel** | Tu ne « lis » pas les 11 sections en boucle : tu t’en sers comme **liste de tâches** et **rappel de fréquence**. |
| **Événements** | Dès qu’il se passe quelque chose (nouveau prestataire, publication légale, migration PII, changement de parcours), ouvre la [§7.1](#71-à-chaque-événement) et exécute les actions correspondantes. |
| **Rituels** | Mensuel / trimestriel / annuel : blocs courts ci‑dessous (calendrier). |
| **Audit annoncé** | [§8.2](#82-avant-un-contrôle--audit-client) en une fois. |

### 12.2 Tableau « tout les combiens de temps »

| Fréquence | Durée indicative | Actions concrètes |
|-----------|------------------|-------------------|
| **À chaque événement** | Variable | Nouveau sous-traitant → CSV + registre si besoin. Publication légale admin → vérif `legal_versioning`, PDF registre si le texte a changé, info équipe si ré-acceptation marchands. Migration DB / PII → RLS, types, export RGPD, registre. Changement signup / paiement / emails → tests parcours + champs d’audit + `consent_logs` si applicable. Nouvel outil → màj `emplacements-logs` (copie Drive). |
| **Mensuelle** | ~15 min | Erreurs email / SMS / webhooks (dashboards type Resend, Twilio, Stripe). Vérifier qu’aucun accès admin **inutile** n’a été ajouté (Supabase, Stripe, hébergeur). |
| **Trimestrielle** | ~30–45 min | Export ou **capture datée** des pages légales publiques. Relecture rapide des **liens DPA** dans le CSV sous-traitants. |
| **Annuelle** (ou avant levée de fonds / gros client) | 1–2 h + juridique si besoin | PDF registre **daté** archivé + **version précédente** conservée. Point conformité / avocat (clauses sensibles, transferts). Relire **assurance cyber** si souscrite. |
| **Avant grosse mise en prod** | Selon release | [Checklist §8.1](#81-avant-mise-en-production-ou-grosse-release). |
| **Contrôle CNIL / audit client** | Préparation dédiée | [Checklist §8.2](#82-avant-un-contrôle--audit-client) + échantillon de profils en base (`legal_compliance_accepted_*` cohérent avec `legal_versioning`). |

### 12.3 Ce que tu ne fais pas

- **Ne pas** relire tout le guide **chaque semaine** sans raison.
- **Ne pas** tout mettre à jour « au cas où » : tu réagis aux **événements** + au rythme **mois / trimestre / an** du tableau ci‑dessus.

---

*Document interne REPUTEXA — à faire valider / adapter avec votre conseil juridique. Dernière mise à jour : structure alignée sur le kit `docs/compliance-audit-kit/` et les migrations légales du projet.*
