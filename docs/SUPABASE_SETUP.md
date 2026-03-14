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
  (ex. `'Google'`, `'TripAdvisor'`).  
  Chaque avis est lié à l’utilisateur connecté.

- **RLS (Row Level Security)**  
  Activé sur `profiles` et `reviews` : chaque utilisateur ne peut lire/écrire que ses propres lignes.

## 4. Auth

- **Connexion** : `/login` (email + mot de passe).  
- **Inscription** : `/signup` (nom de l’établissement, email, mot de passe).  
- **Google OAuth** : bouton « Se connecter avec Google ». Redirection via `/[locale]/auth/callback`. Profil auto avec `full_name`, `avatar_url`, `email`. Activer Auto-Link dans Auth → Providers → Google pour lier un compte existant.
- **Mot de passe oublié** : lien sur login vers `/forgot-password`, email template Reputexa via Resend.
- **Nom expéditeur emails** : Pour harmoniser l'affichage (Confirm Signup, Reset Password, Magic Link) en **REPUTEXA** dans le client mail, configurez dans Supabase Dashboard → Authentication → Email Templates le sujet et le corps. Si vous utilisez un SMTP personnalisé (ex. Resend), définissez le champ *From* au format : `REPUTEXA <votre-email@reputexa.fr>`.
- Après connexion, redirection vers `/[locale]/dashboard`.

Si la confirmation d’email est activée dans **Authentication → Providers → Email**, l’utilisateur devra valider son email avant d’être considéré comme connecté.
