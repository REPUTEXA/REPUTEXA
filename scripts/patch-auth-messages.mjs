/**
 * Ajoute LoginPage, AuthErrors, clés Auth + SignupPage.validation dans messages/{en,fr,es,de,it}.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const LOGIN_PAGE = {
  en: {
    brandAria: 'REPUTEXA',
    signupLink: 'Sign up',
    title: 'Log in',
    subtitle: 'Access your e-reputation dashboard',
    confirmEmailTitle: 'Check your inbox',
    confirmEmailBody: 'Click the link to activate your account, then sign in.',
    passwordResetTitle: 'Your password has been reset.',
    passwordResetBody: 'Sign in with your new password.',
    authCallbackTitle: 'Link expired or invalid.',
    authCallbackBody: 'Sign in with your email and password.',
    authCallbackToast:
      'This confirmation link has expired or is invalid. Sign in with your email and password.',
    emailLabel: 'Email',
    emailRequired: 'Required',
    emailPlaceholder: 'you@yourbusiness.com',
    passwordLabel: 'Password',
    forgotPassword: 'Forgot password?',
    submit: 'Sign in',
    submitting: 'Signing in…',
    or: 'or',
    googleCta: 'Continue with Google',
    noAccount: 'No account yet?',
    signUpLink: 'Create account',
    footerHome: '← Back to home',
  },
  fr: {
    brandAria: 'REPUTEXA',
    signupLink: 'Inscription',
    title: 'Connexion',
    subtitle: 'Accédez à votre tableau de bord e-réputation',
    confirmEmailTitle: 'Vérifiez votre boîte mail',
    confirmEmailBody: 'Cliquez sur le lien pour activer votre compte, puis connectez-vous.',
    passwordResetTitle: 'Votre mot de passe a été réinitialisé.',
    passwordResetBody: 'Connectez-vous avec votre nouveau mot de passe.',
    authCallbackTitle: 'Lien expiré ou invalide.',
    authCallbackBody: 'Connectez-vous avec votre email et mot de passe.',
    authCallbackToast:
      'Le lien de confirmation a expiré ou est invalide. Connectez-vous avec votre email et mot de passe.',
    emailLabel: 'Email',
    emailRequired: 'Obligatoire',
    emailPlaceholder: 'vous@etablissement.com',
    passwordLabel: 'Mot de passe',
    forgotPassword: 'Mot de passe oublié ?',
    submit: 'Se connecter',
    submitting: 'Connexion…',
    or: 'ou',
    googleCta: 'Continuer avec Google',
    noAccount: 'Pas encore de compte ?',
    signUpLink: "S'inscrire",
    footerHome: "← Retour à l'accueil",
  },
  es: {
    brandAria: 'REPUTEXA',
    signupLink: 'Registrarse',
    title: 'Iniciar sesión',
    subtitle: 'Acceda a su panel de e-reputación',
    confirmEmailTitle: 'Revise su correo',
    confirmEmailBody: 'Haga clic en el enlace para activar su cuenta e inicie sesión.',
    passwordResetTitle: 'Su contraseña se ha restablecido.',
    passwordResetBody: 'Inicie sesión con su nueva contraseña.',
    authCallbackTitle: 'Enlace caducado o no válido.',
    authCallbackBody: 'Inicie sesión con su correo y contraseña.',
    authCallbackToast:
      'El enlace de confirmación ha caducado o no es válido. Inicie sesión con su correo y contraseña.',
    emailLabel: 'Correo electrónico',
    emailRequired: 'Obligatorio',
    emailPlaceholder: 'tu@establecimiento.com',
    passwordLabel: 'Contraseña',
    forgotPassword: '¿Ha olvidado su contraseña?',
    submit: 'Iniciar sesión',
    submitting: 'Iniciando sesión…',
    or: 'o',
    googleCta: 'Continuar con Google',
    noAccount: '¿Aún no tiene cuenta?',
    signUpLink: 'Crear cuenta',
    footerHome: '← Volver al inicio',
  },
  de: {
    brandAria: 'REPUTEXA',
    signupLink: 'Registrieren',
    title: 'Anmelden',
    subtitle: 'Zugriff auf Ihr E-Reputations-Dashboard',
    confirmEmailTitle: 'Prüfen Sie Ihr Postfach',
    confirmEmailBody: 'Klicken Sie auf den Link, um Ihr Konto zu aktivieren, und melden Sie sich dann an.',
    passwordResetTitle: 'Ihr Passwort wurde zurückgesetzt.',
    passwordResetBody: 'Melden Sie sich mit Ihrem neuen Passwort an.',
    authCallbackTitle: 'Link abgelaufen oder ungültig.',
    authCallbackBody: 'Melden Sie sich mit E-Mail und Passwort an.',
    authCallbackToast:
      'Der Bestätigungslink ist abgelaufen oder ungültig. Melden Sie sich mit E-Mail und Passwort an.',
    emailLabel: 'E-Mail',
    emailRequired: 'Pflichtfeld',
    emailPlaceholder: 'sie@betrieb.de',
    passwordLabel: 'Passwort',
    forgotPassword: 'Passwort vergessen?',
    submit: 'Anmelden',
    submitting: 'Wird angemeldet…',
    or: 'oder',
    googleCta: 'Mit Google fortfahren',
    noAccount: 'Noch kein Konto?',
    signUpLink: 'Konto erstellen',
    footerHome: '← Zur Startseite',
  },
  it: {
    brandAria: 'REPUTEXA',
    signupLink: 'Registrati',
    title: 'Accedi',
    subtitle: 'Accedi alla tua dashboard e-reputazione',
    confirmEmailTitle: 'Controlla la posta',
    confirmEmailBody: "Clicca sul link per attivare l'account, poi accedi.",
    passwordResetTitle: 'La password è stata reimpostata.',
    passwordResetBody: 'Accedi con la nuova password.',
    authCallbackTitle: 'Link scaduto o non valido.',
    authCallbackBody: 'Accedi con email e password.',
    authCallbackToast:
      'Il link di conferma è scaduto o non è valido. Accedi con email e password.',
    emailLabel: 'Email',
    emailRequired: 'Obbligatorio',
    emailPlaceholder: 'tu@attivita.it',
    passwordLabel: 'Password',
    forgotPassword: 'Password dimenticata?',
    submit: 'Accedi',
    submitting: 'Accesso in corso…',
    or: 'oppure',
    googleCta: 'Continua con Google',
    noAccount: 'Non hai ancora un account?',
    signUpLink: 'Crea account',
    footerHome: '← Torna alla home',
  },
};

const AUTH_ERRORS = {
  en: {
    invalidCredentials: 'Incorrect email or password. Check your details or create an account.',
    emailNotConfirmed: 'Check your inbox to confirm your account.',
    userAlreadyRegistered: 'An account already exists with this email.',
    phoneDuplicate: 'This phone number is already linked to an account.',
    passwordWeak: 'Password too weak. Use at least 6 characters.',
    signupDisabled: 'Sign-ups are temporarily disabled.',
    rateLimit: 'Too many attempts. Try again in a few minutes.',
    databaseError:
      'Technical error while creating your profile. Ensure all Supabase migrations have been applied.',
    duplicateKey: 'An account already exists with this email.',
    dbConfigOutdated: 'Database configuration outdated. Run: supabase db push',
    rlsError: 'Permission error. Contact support.',
    generic: 'Something went wrong. Try again or contact support.',
  },
  fr: {
    invalidCredentials:
      'Email ou mot de passe incorrect. Vérifiez vos identifiants ou créez un compte.',
    emailNotConfirmed: 'Vérifiez votre boîte mail pour confirmer votre compte.',
    userAlreadyRegistered: 'Un compte existe déjà avec cet email.',
    phoneDuplicate: 'Ce numéro de téléphone est déjà associé à un compte.',
    passwordWeak: 'Mot de passe trop faible. Utilisez au moins 6 caractères.',
    signupDisabled: 'Les inscriptions sont temporairement désactivées.',
    rateLimit: 'Trop de tentatives. Réessayez dans quelques minutes.',
    databaseError:
      'Erreur technique lors de la création du profil. Vérifiez que toutes les migrations Supabase ont été appliquées.',
    duplicateKey: 'Un compte existe déjà avec cet email.',
    dbConfigOutdated: 'Configuration base de données obsolète. Exécutez : supabase db push',
    rlsError: 'Erreur de permissions. Contactez le support.',
    generic: 'Une erreur est survenue. Réessayez ou contactez le support.',
  },
  es: {
    invalidCredentials:
      'Correo o contraseña incorrectos. Revise sus datos o cree una cuenta.',
    emailNotConfirmed: 'Revise su correo para confirmar la cuenta.',
    userAlreadyRegistered: 'Ya existe una cuenta con este correo.',
    phoneDuplicate: 'Este número de teléfono ya está vinculado a una cuenta.',
    passwordWeak: 'Contraseña demasiado débil. Use al menos 6 caracteres.',
    signupDisabled: 'Los registros están temporalmente desactivados.',
    rateLimit: 'Demasiados intentos. Inténtelo de nuevo en unos minutos.',
    databaseError:
      'Error técnico al crear el perfil. Compruebe que todas las migraciones de Supabase estén aplicadas.',
    duplicateKey: 'Ya existe una cuenta con este correo.',
    dbConfigOutdated: 'Configuración de base de datos obsoleta. Ejecute: supabase db push',
    rlsError: 'Error de permisos. Contacte con soporte.',
    generic: 'Algo salió mal. Inténtelo de nuevo o contacte con soporte.',
  },
  de: {
    invalidCredentials:
      'E-Mail oder Passwort falsch. Prüfen Sie Ihre Daten oder erstellen Sie ein Konto.',
    emailNotConfirmed: 'Bestätigen Sie Ihr Konto über den Link in der E-Mail.',
    userAlreadyRegistered: 'Mit dieser E-Mail existiert bereits ein Konto.',
    phoneDuplicate: 'Diese Telefonnummer ist bereits mit einem Konto verknüpft.',
    passwordWeak: 'Passwort zu schwach. Mindestens 6 Zeichen verwenden.',
    signupDisabled: 'Registrierungen sind vorübergehend deaktiviert.',
    rateLimit: 'Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.',
    databaseError:
      'Technischer Fehler beim Anlegen des Profils. Stellen Sie sicher, dass alle Supabase-Migrationen angewendet wurden.',
    duplicateKey: 'Mit dieser E-Mail existiert bereits ein Konto.',
    dbConfigOutdated: 'Datenbank-Konfiguration veraltet. Ausführen: supabase db push',
    rlsError: 'Berechtigungsfehler. Kontaktieren Sie den Support.',
    generic: 'Etwas ist schiefgelaufen. Erneut versuchen oder Support kontaktieren.',
  },
  it: {
    invalidCredentials:
      'Email o password non corretti. Verifica i dati o crea un account.',
    emailNotConfirmed: "Controlla la posta per confermare l'account.",
    userAlreadyRegistered: 'Esiste già un account con questa email.',
    phoneDuplicate: 'Questo numero di telefono è già associato a un account.',
    passwordWeak: 'Password troppo debole. Usa almeno 6 caratteri.',
    signupDisabled: 'Le registrazioni sono temporaneamente disabilitate.',
    rateLimit: 'Troppi tentativi. Riprova tra qualche minuto.',
    databaseError:
      'Errore tecnico durante la creazione del profilo. Verifica che tutte le migrazioni Supabase siano state applicate.',
    duplicateKey: 'Esiste già un account con questa email.',
    dbConfigOutdated: 'Configurazione database obsoleta. Esegui: supabase db push',
    rlsError: 'Errore di permessi. Contatta il supporto.',
    generic: 'Si è verificato un problema. Riprova o contatta il supporto.',
  },
};

const AUTH_EXTRA = {
  en: { toastCaptchaFailed: 'Verification failed. Try again.', toastPhoneTaken: 'This phone number is already linked to an account.' },
  fr: { toastCaptchaFailed: 'Vérification échouée. Réessayez.', toastPhoneTaken: 'Ce numéro de téléphone est déjà associé à un compte.' },
  es: { toastCaptchaFailed: 'Verificación fallida. Inténtelo de nuevo.', toastPhoneTaken: 'Este número ya está vinculado a una cuenta.' },
  de: { toastCaptchaFailed: 'Überprüfung fehlgeschlagen. Bitte erneut versuchen.', toastPhoneTaken: 'Diese Nummer ist bereits mit einem Konto verknüpft.' },
  it: { toastCaptchaFailed: 'Verifica non riuscita. Riprova.', toastPhoneTaken: 'Questo numero è già associato a un account.' },
};

const SIGNUP_VALIDATION = {
  en: {
    emailRequired: 'Email is required',
    emailInvalid: 'Invalid email format',
    passwordRequired: 'Password is required',
    fullNameRequired: 'First and last name are required',
    fullNameMin: 'At least 2 characters',
    establishmentNameRequired: 'Business name is required',
    establishmentNameMin: 'At least 2 characters',
    establishmentTypeRequired: 'Business type is required',
    establishmentTypeMin: 'At least 2 characters',
    phoneInvalid: 'Invalid phone number format',
    passwordMin: 'At least 6 characters',
    passwordMax: 'Maximum 72 characters',
    passwordMismatch: 'Passwords do not match',
  },
  fr: {
    emailRequired: "L'email est requis",
    emailInvalid: "Format d'email invalide",
    passwordRequired: 'Le mot de passe est requis',
    fullNameRequired: 'Le prénom/nom est requis',
    fullNameMin: 'Minimum 2 caractères',
    establishmentNameRequired: "Le nom de l'établissement est requis",
    establishmentNameMin: 'Minimum 2 caractères',
    establishmentTypeRequired: "Le type d'établissement est requis",
    establishmentTypeMin: 'Minimum 2 caractères',
    phoneInvalid: 'Format de numéro invalide',
    passwordMin: 'Minimum 6 caractères',
    passwordMax: 'Maximum 72 caractères',
    passwordMismatch: 'Les deux mots de passe ne correspondent pas',
  },
  es: {
    emailRequired: 'El correo es obligatorio',
    emailInvalid: 'Formato de correo no válido',
    passwordRequired: 'La contraseña es obligatoria',
    fullNameRequired: 'Nombre y apellidos obligatorios',
    fullNameMin: 'Al menos 2 caracteres',
    establishmentNameRequired: 'El nombre del negocio es obligatorio',
    establishmentNameMin: 'Al menos 2 caracteres',
    establishmentTypeRequired: 'El tipo de negocio es obligatorio',
    establishmentTypeMin: 'Al menos 2 caracteres',
    phoneInvalid: 'Formato de teléfono no válido',
    passwordMin: 'Al menos 6 caracteres',
    passwordMax: 'Máximo 72 caracteres',
    passwordMismatch: 'Las contraseñas no coinciden',
  },
  de: {
    emailRequired: 'E-Mail ist erforderlich',
    emailInvalid: 'Ungültiges E-Mail-Format',
    passwordRequired: 'Passwort ist erforderlich',
    fullNameRequired: 'Vor- und Nachname sind erforderlich',
    fullNameMin: 'Mindestens 2 Zeichen',
    establishmentNameRequired: 'Betriebsname ist erforderlich',
    establishmentNameMin: 'Mindestens 2 Zeichen',
    establishmentTypeRequired: 'Branche/Typ ist erforderlich',
    establishmentTypeMin: 'Mindestens 2 Zeichen',
    phoneInvalid: 'Ungültiges Telefonnummernformat',
    passwordMin: 'Mindestens 6 Zeichen',
    passwordMax: 'Höchstens 72 Zeichen',
    passwordMismatch: 'Die Passwörter stimmen nicht überein',
  },
  it: {
    emailRequired: "L'email è obbligatoria",
    emailInvalid: 'Formato email non valido',
    passwordRequired: 'La password è obbligatoria',
    fullNameRequired: 'Nome e cognome obbligatori',
    fullNameMin: 'Almeno 2 caratteri',
    establishmentNameRequired: "Il nome dell'attività è obbligatorio",
    establishmentNameMin: 'Almeno 2 caratteri',
    establishmentTypeRequired: "Il tipo di attività è obbligatorio",
    establishmentTypeMin: 'Almeno 2 caratteri',
    phoneInvalid: 'Formato del numero non valido',
    passwordMin: 'Almeno 6 caratteri',
    passwordMax: 'Massimo 72 caratteri',
    passwordMismatch: 'Le password non coincidono',
  },
};

const LOGIN_VALIDATION = {
  en: {
    emailRequired: 'Email is required',
    emailInvalid: 'Invalid email format',
    passwordRequired: 'Password is required',
  },
  fr: {
    emailRequired: "L'email est requis",
    emailInvalid: "Format d'email invalide",
    passwordRequired: 'Le mot de passe est requis',
  },
  es: {
    emailRequired: 'El correo es obligatorio',
    emailInvalid: 'Formato de correo no válido',
    passwordRequired: 'La contraseña es obligatoria',
  },
  de: {
    emailRequired: 'E-Mail ist erforderlich',
    emailInvalid: 'Ungültiges E-Mail-Format',
    passwordRequired: 'Passwort ist erforderlich',
  },
  it: {
    emailRequired: "L'email è obbligatoria",
    emailInvalid: 'Formato email non valido',
    passwordRequired: 'La password è obbligatoria',
  },
};

const DEMO_EXTRA = {
  en: {
    contactWithPhone: 'You can reach us directly at {phone} so we can find the best solution together.',
    contactWithEmail: 'You can email us at {email} so we can follow up on your case personally.',
    phoneMaskPlaceholder: '+1 · · · · · · · ·',
    replyOptionLabel: 'Option {n}',
  },
  fr: {
    contactWithPhone: 'Vous pouvez nous joindre au {phone} pour trouver la meilleure solution avec vous.',
    contactWithEmail:
      'Vous pouvez nous écrire à {email} pour que nous suivions votre dossier personnellement.',
    phoneMaskPlaceholder: '+33 · · · · · · · ·',
    replyOptionLabel: 'Option {n}',
  },
  es: {
    contactWithPhone: 'Puede llamarnos al {phone} para encontrar juntos la mejor solución.',
    contactWithEmail: 'Puede escribirnos a {email} para hacer un seguimiento personalizado.',
    phoneMaskPlaceholder: '+34 · · · · · · · ·',
    replyOptionLabel: 'Opción {n}',
  },
  de: {
    contactWithPhone: 'Sie erreichen uns unter {phone}, damit wir gemeinsam die beste Lösung finden.',
    contactWithEmail: 'Schreiben Sie uns an {email}, damit wir Ihr Anliegen persönlich verfolgen.',
    phoneMaskPlaceholder: '+49 · · · · · · · ·',
    replyOptionLabel: 'Option {n}',
  },
  it: {
    contactWithPhone: 'Ci può contattare al {phone} per trovare insieme la soluzione migliore.',
    contactWithEmail: 'Può scriverci a {email} per un follow-up personalizzato.',
    phoneMaskPlaceholder: '+39 · · · · · · · ·',
    replyOptionLabel: 'Opzione {n}',
  },
};

for (const loc of ['en', 'fr', 'es', 'de', 'it']) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.LoginPage = { ...LOGIN_PAGE[loc], validation: LOGIN_VALIDATION[loc] };
  j.AuthErrors = AUTH_ERRORS[loc];
  j.Auth = { ...j.Auth, ...AUTH_EXTRA[loc] };
  j.SignupPage = { ...j.SignupPage, validation: SIGNUP_VALIDATION[loc] };
  if (j.HomePage?.demo && typeof j.HomePage.demo === 'object') {
    j.HomePage.demo = { ...j.HomePage.demo, ...DEMO_EXTRA[loc] };
  }
  fs.writeFileSync(p, JSON.stringify(j));
  console.log('patched', loc);
}
