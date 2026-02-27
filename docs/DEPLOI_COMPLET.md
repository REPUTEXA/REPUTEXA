# Guide de déploiement complet - Reputexa

Configuration de A à Z : GitHub → Vercel → Stripe → Base de données.

---

## Étape 0 : Prérequis

- Un compte **GitHub** (gratuit) : [github.com](https://github.com)
- Un compte **Vercel** (gratuit) : [vercel.com](https://vercel.com)
- Un compte **Stripe** (test gratuit) : [dashboard.stripe.com](https://dashboard.stripe.com)
- Une base PostgreSQL (on utilisera **Neon** gratuit ou **Supabase**)

---

## Étape 1 : Base de données (PostgreSQL en ligne)

Ta base actuelle est en local. Pour la production, il faut une base accessible sur internet.

### Option A : Neon (recommandé, gratuit)

1. Va sur [neon.tech](https://neon.tech)
2. Sign up (avec GitHub)
3. **New Project** → nomme-le `reputexa`
4. Région : choisis la plus proche (ex. Frankfurt pour l'Europe)
5. Clique **Create Project**
6. Sur la page du projet, copie la **Connection string** (format : `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)

### Option B : Supabase

1. Va sur [supabase.com](https://supabase.com)
2. Sign up → **New project**
3. Récupère l'URL de connexion dans **Settings → Database → Connection string (URI)**

---

## Étape 2 : GitHub

### 2.1 Créer un dépôt

1. Va sur [github.com](https://github.com) → Sign in
2. Clique **+** (en haut à droite) → **New repository**
3. Nom : `reputexa`
4. Visibilité : **Private** ou **Public**
5. Ne coche **pas** "Add a README" (ton projet en a déjà un)
6. Clique **Create repository**

### 2.2 Pousser ton code

Ouvre un terminal dans ton dossier projet et exécute :

```bash
# Initialiser Git si pas déjà fait
git init

# Ajouter le remote GitHub (remplace TON_USERNAME par ton pseudo GitHub)
git remote add origin https://github.com/TON_USERNAME/reputexa.git

# Ajouter tous les fichiers
git add .

# Premier commit
git commit -m "Initial commit - Reputexa"

# Pousser sur GitHub
git branch -M main
git push -u origin main
```

Si Git te demande identifiants : utilise un **Personal Access Token** (GitHub → Settings → Developer settings → Personal access tokens).

---

## Étape 3 : Vercel

### 3.1 Importer le projet

1. Va sur [vercel.com](https://vercel.com)
2. **Sign up** avec GitHub
3. Clique **Add New** → **Project**
4. Tu vois tes repos GitHub → sélectionne **reputexa** (ou le nom de ton repo)
5. Clique **Import**

### 3.2 Configurer les variables d'environnement

Avant de déployer, ajoute les variables. Clique **Environment Variables** et ajoute :

| Nom | Valeur | À copier depuis |
|-----|--------|-----------------|
| `DATABASE_URL` | `postgresql://...` (mot de passe : si `?` → `%3F`, pas de `[]`) | Neon ou Supabase (étape 1) |
| `OPENAI_API_KEY` | `sk-proj-...` | Ton `.env` local |
| `MAPS_API_KEY` | `AIza...` | Ton `.env` local |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | Ton `.env` local |
| `CLERK_SECRET_KEY` | `sk_test_...` | Ton `.env` local |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe → Developers → API keys |
| `STRIPE_PRODUCT_ID` | `prod_U3Wr41eJCMCSyF` | Ton produit Stripe |
| `STRIPE_PRICE_AMOUNT_CENTS` | `7900` | Fixe |
| `NEXT_PUBLIC_APP_URL` | *(à remplir après)* | On le mettra à l’étape 3.5 |
| `STRIPE_WEBHOOK_SECRET` | *(à remplir après)* | Stripe webhook (étape 4) |

Pour `NEXT_PUBLIC_APP_URL`, tu peux mettre `https://placeholder.vercel.app` pour l’instant.

### 3.3 Déployer

Clique **Deploy**. Vercel compile et met en ligne (2–3 min).

### 3.4 Récupérer l’URL

Quand le déploiement est terminé, Vercel affiche :
- **URL de production** : `https://reputexa-xxx.vercel.app` (ou un nom similaire)

Note cette URL.

### 3.5 Mettre à jour `NEXT_PUBLIC_APP_URL`

1. Dans Vercel : **Settings** → **Environment Variables**
2. Modifie `NEXT_PUBLIC_APP_URL` : mets ta vraie URL (ex. `https://reputexa-xxx.vercel.app`)
3. **Save**
4. **Deployments** → sur le dernier déploiement → **⋯** → **Redeploy** (pour appliquer la variable)

---

## Étape 4 : Migrer la base de données

Ta base de prod (Neon/Supabase) est vide. Il faut créer les tables.

### Option A : Avec Prisma (recommandé)

1. Dans ton `.env` local, remplace temporairement `DATABASE_URL` par l’URL Neon/Supabase
2. Dans le terminal :
```bash
npx prisma migrate deploy
```
3. Remets ton `DATABASE_URL` local si tu veux garder ta base locale

### Option B : Push direct

```bash
npx prisma db push
```

---

## Étape 5 : Clerk (domaines autorisés)

1. Va sur [dashboard.clerk.com](https://dashboard.clerk.com)
2. Ouvre ton application
3. **Configure** → **Domains** (ou **Paths**)
4. Ajoute ton domaine Vercel : `https://ton-projet.vercel.app`
5. Sauvegarde

---

## Étape 6 : Stripe Webhook

### 6.1 Créer le webhook

1. Va sur [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. **Add endpoint** / **Ajouter un endpoint**

### 6.2 Remplir le formulaire

**URL du endpoint :**
```
https://TON-PROJET.vercel.app/api/stripe/webhook
```
Remplace `TON-PROJET` par l’URL exacte de ton site Vercel.

Exemple : si ton site est `https://reputexa-abc123.vercel.app`, mets :
```
https://reputexa-abc123.vercel.app/api/stripe/webhook
```

**Événements :**
- Clique **Select events**
- Recherche : `checkout.session.completed`
- Coche **checkout.session.completed**
- **Add endpoint** / **Continuer**

### 6.3 Récupérer le Signing secret

1. Clique sur le webhook que tu viens de créer
2. Section **Signing secret**
3. **Reveal** / **Révéler**
4. Copie la valeur (commence par `whsec_`)

### 6.4 Ajouter le secret dans Vercel

1. Vercel → ton projet → **Settings** → **Environment Variables**
2. Ajoute `STRIPE_WEBHOOK_SECRET` = `whsec_...` (la valeur copiée)
3. **Save**
4. **Redeploy** le projet pour prendre en compte la nouvelle variable

---

## Récapitulatif des URL

| Service | Où configurer | Valeur |
|---------|---------------|--------|
| **Stripe Webhook** | Stripe → Webhooks → Endpoint URL | `https://[ton-site].vercel.app/api/stripe/webhook` |
| **Clerk** | Clerk Dashboard → Domains | `https://[ton-site].vercel.app` |
| **NEXT_PUBLIC_APP_URL** | Vercel → Env Variables | `https://[ton-site].vercel.app` |

---

## Ordre recommandé

1. Neon/Supabase → créer la base, récupérer `DATABASE_URL`
2. GitHub → créer le repo, pousser le code
3. Vercel → importer le projet, ajouter les variables (sauf webhook)
4. Déployer sur Vercel
5. Migrer la base (`prisma migrate deploy`)
6. Mettre `NEXT_PUBLIC_APP_URL` avec l’URL réelle
7. Clerk → ajouter le domaine Vercel
8. Stripe → créer le webhook avec l’URL
9. Vercel → ajouter `STRIPE_WEBHOOK_SECRET`, redeploy

---

## Checklist de vérification

**[VERIFICATION.md](./VERIFICATION.md)** — Liste à cocher pour tout vérifier (variables, API, flux, erreurs courantes).

---

## En cas de souci

- **Erreur 500 sur le webhook** : vérifie que `STRIPE_WEBHOOK_SECRET` est bien dans Vercel et qu’un redeploy a été fait.
- **Redirect Stripe vers mauvaise URL** : vérifie `NEXT_PUBLIC_APP_URL`.
- **Clerk ne se connecte pas** : vérifie que le domaine est ajouté dans Clerk.
