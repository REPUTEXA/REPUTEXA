# Audit — Flux Emails (Signup, Welcome, Forgot Password)

**Date :** 2025-03-12  
**Rôle :** Lead QA & Auth Specialist  
**Objectif :** Cohérence totale du flux emails via Resend

---

## 1. Route Signup (`api/auth/signup`)

### 1.1 Création utilisateur Supabase

| Point | Statut | Détail |
|-------|--------|--------|
| `email_confirm: false` | ✅ | Ligne 48 : `createUser({ email_confirm: false, ... })` |

L'utilisateur est bien créé avec email non confirmé. La confirmation se fait par **OTP (6 chiffres)**, pas par lien magic.

### 1.2 Resend — expéditeur

| Point | Statut | Détail |
|-------|--------|--------|
| Nom REPUTEXA | ✅ | `RESEND_FROM = process.env.RESEND_FROM ?? 'REPUTEXA <contact@reputexa.fr>'` |
| Cohérence avec DEFAULT_FROM | ⚠️ | Signup utilise `contact@reputexa.fr` ; `lib/resend` définit `noreply@reputexa.fr`. Les deux contiennent "REPUTEXA". |

**Recommandation :** Utiliser `DEFAULT_FROM` de `@/lib/resend` pour uniformité (noreply).

### 1.3 Lien de confirmation / redirection

| Point | Statut | Détail |
|-------|--------|--------|
| Lien avec next=/dashboard | N/A | Le flow signup utilise **OTP**, pas de lien dans l’email. |
| Redirection post-confirmation | ✅ | Après OTP sur `/confirm-email`, redirection vers `/${locale}/dashboard` (confirm-email ligne 85). |
| Redirection post-signup | ✅ | Après signup, redirection vers `/${locale}/confirm-email?email=xxx` (signup page ligne 196). |

**Flux réel :** Signup → Email OTP → Confirm-email (saisie code) → Dashboard.

---

## 2. Récupération d’accès (sans mot de passe)

La route `api/auth/forgot-password` et les pages `/forgot-password` / `/reset-password` ont été **retirées**.  
Toute connexion par e-mail passe par **`POST /api/auth/send-magic-link`** (`generateLink` + **Resend** + template Zenith), pas par le SMTP Supabase. Google OAuth inchangé.  
Les anciens liens e-mail « recovery » dans le hash redirigent vers `/login?message=passwordless-recovery`.

---

## 3. Email de Bienvenue (`api/send-welcome-email`)

| Point | Statut | Détail |
|-------|--------|--------|
| Expéditeur REPUTEXA | ✅ | `from: process.env.RESEND_FROM ?? DEFAULT_FROM` |
| Ton pro | ✅ | Templates : « Bienvenue chez REPUTEXA », « L’équipe REPUTEXA », CTA « Accéder à mon dashboard » |
| loginUrl | ✅ | `${getSiteUrl()}/${locale}/dashboard` |

---

## 4. Simulation de test (URLs debug)

Activer les logs en définissant dans `.env.local` :
```bash
DEBUG_EMAIL_URLS=1
```

Puis lancer le serveur et déclencher les flux (signup, send-welcome-email). La console affichera les URLs finales, par exemple :

```
[DEBUG EMAIL] --- Signup ---
[DEBUG EMAIL] Redirect post-signup (vers confirm-email): https://reputexa.fr/fr/confirm-email?email=user%40test.com
[DEBUG EMAIL] Redirect post-OTP (vers dashboard):        https://reputexa.fr/fr/dashboard
[DEBUG EMAIL] Domaine: https://reputexa.fr | Locale: fr

[DEBUG EMAIL] --- Welcome Email ---
[DEBUG EMAIL] loginUrl (CTA "Accéder à mon dashboard"):  https://reputexa.fr/fr/dashboard
```
