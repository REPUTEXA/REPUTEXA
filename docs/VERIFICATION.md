# Checklist de vérification complète - Reputexa

Cocher chaque point pour vérifier que tout est correctement configuré.

---

## 1. Variables d'environnement

### 1.1 Vercel (projet → Settings → Environment Variables)

| Variable | Format attendu | Vérifié |
|----------|----------------|---------|
| `DATABASE_URL` | `postgresql://postgres:MOT_DE_PASSE@host:port/postgres?sslmode=require` | ☐ |
| `OPENAI_API_KEY` | `sk-proj-...` | ☐ |
| `MAPS_API_KEY` | `AIza...` | ☐ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` ou `pk_live_...` | ☐ |
| `CLERK_SECRET_KEY` | `sk_test_...` ou `sk_live_...` | ☐ |
| `STRIPE_SECRET_KEY` | `sk_test_...` ou `sk_live_...` | ☐ |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | ☐ |
| `STRIPE_PRODUCT_ID` | `prod_...` | ☐ |
| `STRIPE_PRICE_AMOUNT_CENTS` | `7900` (nombre) | ☐ |
| `NEXT_PUBLIC_APP_URL` | `https://ton-site.vercel.app` (sans slash final) | ☐ |

### 1.2 DATABASE_URL - pièges courants

- [ ] Pas de `[` ni `]` autour du mot de passe
- [ ] Si mot de passe contient `?` → remplacer par `%3F`
- [ ] Si mot de passe contient `@` → remplacer par `%40`
- [ ] Si mot de passe contient `#` → remplacer par `%23`
- [ ] Si mot de passe contient `/` → remplacer par `%2F`
- [ ] Pour Supabase sur Vercel : préférer **Session pooler** (port 6543) si la connexion directe (5432) ne répond pas
- [ ] Format final : `postgresql://user:password@host:port/db?sslmode=require`

---

## 2. GitHub

- [ ] Repo créé
- [ ] Code poussé (`git push`)
- [ ] Pas de `.env` dans le repo (vérifier `.gitignore` contient `.env`)

---

## 3. Vercel

- [ ] Projet importé depuis GitHub
- [ ] Toutes les variables d'environnement ajoutées
- [ ] Dernier déploiement en statut **Ready** (vert)
- [ ] URL de production fonctionne : `https://ton-site.vercel.app` ou `https://reputexa.fr`

---

## 4. Supabase (base de données)

- [ ] Projet créé
- [ ] Tables créées (`npx prisma db push` exécuté avec `DATABASE_URL` Supabase)
- [ ] Connection string Session pooler récupérée (Connect → Connection string → Session pooler)
- [ ] Mot de passe connu (ou réinitialisé si besoin)

---

## 5. Clerk

- [ ] Application créée
- [ ] Domaine de production ajouté : `https://ton-site.vercel.app`
- [ ] Fallback development host = `https://ton-site.vercel.app` (sans `/fr`)

---

## 6. Stripe

- [ ] Compte créé
- [ ] Clés API récupérées (Developers → API keys)
- [ ] Webhook créé (Webhooks → Add endpoint)
- [ ] URL webhook : `https://ton-site.vercel.app/api/stripe/webhook`
- [ ] Événement : `checkout.session.completed` sélectionné
- [ ] Signing secret copié et mis dans `STRIPE_WEBHOOK_SECRET` sur Vercel

---

## 7. Tests des API

Ouvrir ces URLs dans le navigateur ou avec une requête :

| URL | Résultat attendu |
|-----|------------------|
| `https://ton-site.vercel.app/api/health` | `{"ok":true,"timestamp":...}` en JSON |
| `https://ton-site.vercel.app/fr` | Page d'accueil en français |

---

## 8. Flux utilisateur complet

1. [ ] Aller sur `https://ton-site.vercel.app/fr`
2. [ ] Cliquer **Essai gratuit**
3. [ ] Créer un compte (Clerk) ou se connecter
4. [ ] Arriver sur la page « Complétez votre essai gratuit »
5. [ ] Cliquer **Commencer l'essai gratuit — Ajouter ma carte**
6. [ ] Être redirigé vers Stripe Checkout (pas d'erreur 404, pas d'erreur Prisma)
7. [ ] Saisir carte test : `4242 4242 4242 4242`, date future, CVC `123`
8. [ ] Valider → être redirigé vers le dashboard
9. [ ] Vérifier dans Stripe (Payments) que le paiement apparaît

---

## 9. Erreurs courantes et solutions

| Erreur | Cause | Solution |
|--------|-------|----------|
| 404 sur `/api/stripe/checkout` | Middleware ou routing | Vérifier que le dernier commit avec le fix middleware est déployé |
| "invalid port number" | Mot de passe avec `?` non encodé | Remplacer `?` par `%3F` dans `DATABASE_URL` |
| "Can't reach database server" | IPv4 vs IPv6 (Supabase direct) | Utiliser Session pooler (port 6543) |
| "auth() was called but clerkMiddleware" | API exclue du matcher | Vérifier middleware : routes `/api/` doivent retourner `NextResponse.next()` |
| Erreur Prisma `findUnique` | `DATABASE_URL` invalide sur Vercel | Corriger `DATABASE_URL`, redeploy |
| Clerk redirect incorrect | Domaine pas configuré | Ajouter domaine dans Clerk Dashboard |

---

## 10. Commandes utiles

```bash
# Vérifier la config Prisma
npx prisma validate

# Tester la connexion DB (avec DATABASE_URL dans .env)
npx prisma db push

# Build local
npm run build

# Lancer en local
npm run dev
```

---

Après chaque modification de variable sur Vercel : **Redeploy** (Deployments → ⋯ → Redeploy).
