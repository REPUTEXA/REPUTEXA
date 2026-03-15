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
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `invoice.paid`
   - `invoice.payment_failed`
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
| `STRIPE_PRICE_ID_VISION_ANNUAL` | Vision facturé annuellement (-20%) | `price_...` |
| `STRIPE_PRICE_ID_PULSE_ANNUAL` | Pulse facturé annuellement (-20%) | `price_...` |
| `STRIPE_PRICE_ID_ZENITH_ANNUAL` | Zenith facturé annuellement (-20%) | `price_...` |
| `STRIPE_ADDON_PRODUCT_ID` | Produit Stripe pour addons établissements (voir ci-dessous) | `prod_...` |
| `NEXT_PUBLIC_APP_URL` | URL de ton site en prod | `https://reputexa.vercel.app` |

**Important :** Crée 6 prix dans Stripe avec *Graduated Tiers* : Vision, Pulse, Zenith × Mensuel, Annuel. Paliers : 1er 0%, 2e -20%, 3e -30%, 4e -40%, 5e+ -50%. L’annuel applique -20%. La quantité (nombre d’établissements) est gérée dans la subscription principale via `adjustable_quantity`.

**Portail facturation (Customer Portal) :** Stripe → Settings → Billing → Customer portal → active "Subscription updates" pour permettre : changement de plan (Vision/Pulse/Zenith), changement de période (mensuel ↔ annuel), ajustement de la quantité (établissements). Le lien `/api/stripe/portal?flow=upgrade` ou `flow=add-establishment` ouvre directement la page de mise à jour.

**CRITIQUE – Éviter qu’un changement de plan crée un nouvel abonnement :** Dans le portail (Settings → Billing → Customer portal → Subscription updates), configure :
- **Update a subscription** : l’utilisateur doit **modifier** l’abonnement existant (remplacer le plan/prix), pas ajouter un nouveau produit. Si l’option "Add products" est activée, désactive-la ou assure-toi que "Update subscription" remplace bien l’item existant.
- **Proration behavior** : mets **"Always invoice"** pour que la prévisualisation du prorata s’affiche et que la facturation soit immédiate au clic sur Confirmer (l’utilisateur est ensuite renvoyé vers `/dashboard?status=upgraded` avec la base déjà à jour via le webhook).

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
