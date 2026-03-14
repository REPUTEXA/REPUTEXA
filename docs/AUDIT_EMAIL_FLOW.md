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

## 2. Route Forgot Password (`api/auth/forgot-password`)

### 2.1 generateLink Supabase

| Point | Statut | Détail |
|-------|--------|--------|
| `type: 'recovery'` | ✅ | Ligne 46-49 : `admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: callbackUrl } })` |
| `redirectTo` correct | ✅ | `callbackUrl = ${baseUrl}/${locale}/auth/callback?next=/reset-password` |

### 2.2 URL injectée dans Resend

| Point | Statut | Détail |
|-------|--------|--------|
| action_link / recovery_link | ✅ | Lignes 61-65 : Extraction de `action_link` ou `recovery_link` depuis la réponse Supabase |
| Template Resend | ✅ | `getPasswordRecoveryEmailHtml({ resetUrl: actionLink })` — lien injecté dans le CTA |

### 2.3 Clic sur l’email → destination

| Point | Statut | Détail |
|-------|--------|--------|
| URL Supabase | — | Lien Supabase (type recovery) → validation token |
| Redirection vers auth/callback | ✅ | Supabase redirige vers `redirectTo` = `/locale/auth/callback?next=/reset-password` avec hash tokens |
| auth/callback → reset-password | ✅ | Détection `next=/reset-password` ou `type=recovery` dans hash → `router.replace(/${locale}/reset-password)` |

**Conclusion :** Clic email → auth/callback → page reset-password. ✅

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

Puis lancer le serveur et déclencher les flux (signup, forgot-password, send-welcome-email). La console affichera les URLs finales, par exemple :

```
[DEBUG EMAIL] --- Signup ---
[DEBUG EMAIL] Redirect post-signup (vers confirm-email): https://reputexa.fr/fr/confirm-email?email=user%40test.com
[DEBUG EMAIL] Redirect post-OTP (vers dashboard):        https://reputexa.fr/fr/dashboard
[DEBUG EMAIL] Domaine: https://reputexa.fr | Locale: fr

[DEBUG EMAIL] --- Forgot Password ---
[DEBUG EMAIL] redirectTo (injecté dans generateLink):    https://reputexa.fr/fr/auth/callback?next=/reset-password
[DEBUG EMAIL] action_link (Supabase, envoyé par Resend): https://xxx.supabase.co/auth/v1/verify?token=...
[DEBUG EMAIL] → Clic user → Supabase valide → redirect vers: https://reputexa.fr/fr/auth/callback?next=/reset-password

[DEBUG EMAIL] --- Welcome Email ---
[DEBUG EMAIL] loginUrl (CTA "Accéder à mon dashboard"):  https://reputexa.fr/fr/dashboard
```
