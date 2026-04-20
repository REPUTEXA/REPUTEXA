# Configuration Supabase pour REPUTEXA

## 1. Variables d'environnement

Dans `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Récupérez l’URL et la clé **anon** (publique) dans le dashboard Supabase : **Project Settings → API**.

Pour l’anti-abus de l’essai gratuit (blocage si même établissement), ajoutez la clé **service_role** :

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## 2. Appliquer les migrations (tables + RLS)

- **Option A – Dashboard Supabase**  
  Exécutez les fichiers dans l’ordre : `001_`, `002_`, `003_` dans **SQL Editor**.

- **Option B – CLI Supabase**  
  Si le projet est lié à Supabase :  
  `supabase db push`

## 3. Contenu de la migration

- **Table `profiles`**  
  Liée à `auth.users`, avec `establishment_name`, `subscription_plan`  
  (`'starter' | 'manager' | 'Dominator'`), `trial_started_at` et `has_used_trial`.  
  Un profil est créé à l’inscription ; l’essai gratuit de 7 jours démarre automatiquement.

- **Table `reviews`**  
  Colonnes : `user_id`, `reviewer_name`, `rating`, `comment`, `source`  
  (ex. `'google'`, `'facebook'`, `'trustpilot'`).  
  Chaque avis est lié à l’utilisateur connecté.

- **RLS (Row Level Security)**  
  Activé sur `profiles` et `reviews` : chaque utilisateur ne peut lire/écrire que ses propres lignes.

## 4. Auth

- **Connexion** : `/login` — **lien magique** : `generateLink` côté API puis envoi **Resend** (`/api/auth/send-magic-link`). **Google OAuth** inchangé. Désactiver l’envoi d’e-mails « Magic Link » côté Supabase si vous ne voulez aucun doublon.  
- **Inscription** : `/signup` — profil établissement + e-mail ; secret serveur uniquement côté Supabase + OTP / lien de confirmation.  
- **Google OAuth** : bouton « Continuer avec Google ». Redirection via `/[locale]/auth/callback`. Profil auto avec `full_name`, `avatar_url`, `email`. Activer Auto-Link dans Auth → Providers → Google pour lier un compte existant.
- **Récupération d’accès** : uniquement via le **lien magique** depuis `/login` (pas de page « mot de passe oublié »). Désactiver ou neutraliser le template **Reset Password** dans Supabase s’il n’est plus utilisé.
- **Nom expéditeur emails** : harmoniser (Confirm Signup, Magic Link, etc.) en **REPUTEXA** dans Authentication → Email Templates. Avec Resend : *From* du type `REPUTEXA <votre-email@reputexa.fr>`.
- Après connexion, redirection vers `/[locale]/dashboard`.

Si la confirmation d’email est activée dans **Authentication → Providers → Email**, l’utilisateur devra valider son email avant d’être considéré comme connecté.
