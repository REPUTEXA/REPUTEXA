# Configuration Stripe - REPUTEXA

Guide pour configurer Stripe (webhook, produits, variables) sans te prendre la tête.

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
| `STRIPE_PRICE_ID_VISION` | Stripe → Products → Prix Vision 59€/mois | `price_...` |
| `STRIPE_PRICE_ID_PULSE` | Stripe → Products → Prix Pulse 97€/mois | `price_...` |
| `STRIPE_PRICE_ID_ZENITH` | Stripe → Products → Prix Zenith 157€/mois | `price_...` |
| `NEXT_PUBLIC_APP_URL` | URL de ton site en prod | `https://reputexa.vercel.app` |

**Important :** Crée 3 prix (Price IDs) dans Stripe pour Vision, Pulse et Zenith avec essai 14 jours.

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

1. User clique sur un plan (Starter/Manager/Dominator) sur la landing → `/checkout?plan=manager`
2. Si non connecté → redirection sign-in puis retour checkout avec le plan
3. User clique "Ajouter ma carte" → API `/api/stripe/checkout?planType=manager` crée une session Stripe
4. Session Stripe : Price ID correspondant (STRIPE_PRICE_ID_VISION/PULSE/ZENITH), essai 14 jours, 0€ aujourd'hui
5. User entre sa carte sur Stripe
6. Stripe envoie `checkout.session.completed` à ton webhook
7. Le webhook met à jour `User` (stripeSubscriptionId, trialEndsAt)
8. User est redirigé vers `/dashboard?welcome=1`
