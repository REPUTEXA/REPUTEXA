# Configuration Stripe - Reputexa

Guide pour configurer Stripe (webhook, produit, variables) sans te prendre la tête.

> Pour le guide complet (GitHub, Vercel, base de données, tout) : voir **[DEPLOI_COMPLET.md](./DEPLOI_COMPLET.md)**

---

## 1. Créer le webhook dans Stripe

1. Va sur [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Clique **"Ajouter un endpoint"** / **"Add endpoint"**
3. **URL du endpoint :**
   - Remplace `[ton-site]` par l’URL exacte de ton site Vercel
   - Format : `https://[ton-site]/api/stripe/webhook`
   - Exemple : si ton site est `https://reputexa-abc123.vercel.app`, mets :  
     `https://reputexa-abc123.vercel.app/api/stripe/webhook`
4. **Événements à sélectionner :**
   - Recherche : `checkout.session.completed`
   - Coche **checkout.session.completed**
5. Clique **"Ajouter un endpoint"**
6. Clique sur ton endpoint → **"Révéler"** le **Signing secret** (commence par `whsec_`)
7. Copie-le et mets-le dans `.env` : `STRIPE_WEBHOOK_SECRET=whsec_...`

---

## 2. Variables d'environnement à configurer

Dans ton `.env` (local) et dans Vercel (Settings → Environment Variables) :

| Variable | Où la trouver | Exemple |
|----------|---------------|---------|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → Secret key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → ton endpoint → Signing secret | `whsec_...` |
| `STRIPE_PRODUCT_ID` | Stripe → Products → ton produit → ID | `prod_U3Wr41eJCMCSyF` |
| `STRIPE_PRICE_AMOUNT_CENTS` | Montant en centimes (79€ = 7900) | `7900` |
| `NEXT_PUBLIC_APP_URL` | URL de ton site en prod | `https://reputexa.vercel.app` |

---

## 3. Tester en local avec Stripe CLI

```bash
# Installer Stripe CLI : https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

La commande affiche un **webhook signing secret** temporaire (whsec_...) → utilise-le dans `.env` pour `STRIPE_WEBHOOK_SECRET`.

---

## 4. Résumé - Ce qui se passe quand un user paie

1. User clique "Essai gratuit" → Clerk sign-up
2. User arrive sur `/checkout` → clique "Ajouter ma carte"
3. API `/api/stripe/checkout` crée une session Stripe (essai 14 jours, 0€ aujourd'hui)
4. User entre sa carte sur Stripe
5. Stripe envoie `checkout.session.completed` à ton webhook
6. Le webhook met à jour `User` (stripeSubscriptionId, trialEndsAt)
7. User est redirigé vers `/dashboard?welcome=1`
