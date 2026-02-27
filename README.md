# AAA Empire - Reputation AI

SaaS de réputation IA international (Next.js 14, App Router, TypeScript, Tailwind).

## Structure

```
├── app/
│   ├── [locale]/       # Routes multi-langue (en, fr)
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── i18n/               # Configuration next-intl
│   ├── routing.ts
│   ├── request.ts
│   └── navigation.ts
├── messages/           # Traductions (en.json, fr.json)
├── prisma/             # Schéma et migrations
├── scripts/            # Scripts (ex: Sniper prospection)
└── middleware.ts
```

## Démarrage

```bash
# Installer les dépendances
npm install

# Copier .env
cp .env.example .env
# Modifier DATABASE_URL

# Générer le client Prisma
npm run db:generate

# Lancer en dev
npm dev
```

Routes : `http://localhost:3000/en` ou `http://localhost:3000/fr`

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lancer le serveur de dev |
| `npm run db:generate` | Générer le client Prisma |
| `npm run db:push` | Synchroniser le schéma avec la DB |
| `npm run db:migrate` | Créer une migration |
| `npm run db:studio` | Ouvrir Prisma Studio |
| `npm run stripe:listen` | Tester le webhook Stripe en local (nécessite Stripe CLI) |

## Déploiement & configuration

- **[docs/DEPLOI_COMPLET.md](./docs/DEPLOI_COMPLET.md)** — Guide A à Z : GitHub, Vercel, base de données, Stripe, Clerk
- **[docs/STRIPE_SETUP.md](./docs/STRIPE_SETUP.md)** — Configuration Stripe (webhook, variables)

## Installer des packages additionnels

```bash
# OpenAI
npm install openai

# Stripe
npm install stripe @stripe/stripe-js

# Lucide React (icônes)
npm install lucide-react
```
