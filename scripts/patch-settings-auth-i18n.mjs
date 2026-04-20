/**
 * Ajoute les clés Dashboard.settings pour SecurityKeysPanel, TotpMfaEnroll, PasskeyEnrollButton.
 * Exécuter : node scripts/patch-settings-auth-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'messages');

const PATCH = {
  fr: {
    securityPanelIntro:
      "Votre compte se connecte surtout par <magiclink>lien e-mail</magiclink>. Vous pouvez ajouter un <secondfactor>second facteur</secondfactor> optionnel : d'abord une <totpapp>application TOTP</totpapp> (recommandé, déjà activable dans <authdash>Authentication → Multi-factor</authdash> avec « TOTP : Enabled »), puis éventuellement une <passkey>passkey</passkey> lorsque Supabase aura activé l'enrôlement <webauthn>WebAuthn</webauthn> pour votre projet cloud (sinon l'API renvoie une erreur — contacter le <support>support Supabase</support>).",
    securityRegisteredSectionTitle: 'Second facteur enregistré',
    securityLoading: 'Chargement…',
    securityNoFactors:
      'Aucun pour l’instant. Commencez par « Ajouter une application d’authentification (TOTP) » ci-dessous.',
    securityFactorTotpLabel: 'Application TOTP',
    securityFactorPasskeyLabel: 'Passkey',
    securityRemoveFactor: 'Retirer',
    toastSecurityFactorRemoved: 'Facteur retiré de ce compte.',
    securityStep1Title: 'Étape 1 — Application d’authentification (fonctionne tout de suite)',
    securityStep2Title: 'Étape 2 — Passkey biométrique (Touch ID, Face ID, Windows Hello)',
    securityStep2Hint:
      'Si vous voyez une erreur du type « MFA enroll is disabled for WebAuthn », ce n’est pas un bug de l’app : l’enrôlement WebAuthn doit être activé sur votre projet Supabase hébergé.',
    mfaFactorFriendlyName: 'REPUTEXA · {date}',
    totpErrIncompleteResponse: 'Réponse serveur incomplète.',
    totpErrPrepareQr: 'Impossible de préparer le QR code.',
    totpErrEnterSixDigits: 'Saisissez les 6 chiffres affichés dans l’application.',
    totpToastAppRegistered: 'Application d’authentification enregistrée.',
    totpErrVerifyFallback: 'Code refusé. Vérifiez l’heure de l’appareil et réessayez.',
    totpScanDescription:
      "Scannez ce QR avec <ga>Google Authenticator</ga>, <au>Authy</au>, <op>1Password</op> ou l’app sécurité de votre téléphone, puis entrez le code à 6 chiffres.",
    totpQrAlt: 'QR code pour configurer l’authentificateur TOTP',
    totpShowSecret: 'Impossible de scanner ? Afficher la clé secrète',
    totpHideSecret: 'Masquer la clé secrète',
    totpCodeLabel: 'Code à 6 chiffres',
    totpCodePlaceholder: '000000',
    totpCancel: 'Annuler',
    totpVerify: 'Valider',
    totpBusyPreparing: 'Préparation…',
    totpAddButton: 'Ajouter une application d’authentification (TOTP)',
    passkeyErrWebauthnDisabled:
      "L'enrôlement passkey est désactivé sur votre projet Supabase. Dashboard → Authentication → Multi-factor → WebAuthn : activer l'enrôlement (Enroll).",
    passkeyErrMfaDisabled:
      "L'enrôlement MFA est désactivé dans Supabase (Authentication → Multi-factor). Activez l'enrôlement pour les passkeys.",
    passkeyErrBrowserUnsupported:
      'Ce navigateur ne supporte pas WebAuthn (HTTPS ou localhost requis, ou contexte non sécurisé).',
    passkeyErrUnavailableSdk:
      'Passkey indisponible : mettez à jour @supabase/supabase-js ou activez le MFA WebAuthn dans Supabase.',
    passkeyErrIncomplete: 'Enregistrement incomplet',
    passkeyToastSuccess:
      'Passkey enregistrée. Sur cet appareil, privilégiez la connexion biométrique quand elle est proposée.',
    passkeyErrGenericFallback: 'Passkey indisponible. La connexion par lien e-mail reste possible.',
    passkeyButtonBusy: 'Enregistrement…',
    passkeyButtonLabel: 'Activer Touch ID / Face ID / Windows Hello',
  },
  en: {
    securityPanelIntro:
      'You mostly sign in with a <magiclink>magic link</magiclink>. You can add an optional <secondfactor>second factor</secondfactor>: first a <totpapp>TOTP authenticator app</totpapp> (recommended—enable it in <authdash>Authentication → Multi-factor</authdash> with “TOTP : Enabled”), then optionally a <passkey>passkey</passkey> when Supabase enables <webauthn>WebAuthn</webauthn> enrollment for your hosted project (otherwise the API returns an error—contact <support>Supabase support</support>).',
    securityRegisteredSectionTitle: 'Registered second factor',
    securityLoading: 'Loading…',
    securityNoFactors: 'None yet. Start with “Add authenticator app (TOTP)” below.',
    securityFactorTotpLabel: 'TOTP app',
    securityFactorPasskeyLabel: 'Passkey',
    securityRemoveFactor: 'Remove',
    toastSecurityFactorRemoved: 'Factor removed from this account.',
    securityStep1Title: 'Step 1 — Authenticator app (works immediately)',
    securityStep2Title: 'Step 2 — Biometric passkey (Touch ID, Face ID, Windows Hello)',
    securityStep2Hint:
      'If you see “MFA enroll is disabled for WebAuthn”, this is not an app bug: WebAuthn enrollment must be enabled on your hosted Supabase project.',
    mfaFactorFriendlyName: 'REPUTEXA · {date}',
    totpErrIncompleteResponse: 'Incomplete server response.',
    totpErrPrepareQr: 'Could not prepare the QR code.',
    totpErrEnterSixDigits: 'Enter the 6-digit code from your app.',
    totpToastAppRegistered: 'Authenticator app registered.',
    totpErrVerifyFallback: 'Code rejected. Check device time and try again.',
    totpScanDescription:
      'Scan this QR with <ga>Google Authenticator</ga>, <au>Authy</au>, <op>1Password</op> or your phone’s authenticator app, then enter the 6-digit code.',
    totpQrAlt: 'QR code to set up TOTP authenticator',
    totpShowSecret: 'Can’t scan? Show secret key',
    totpHideSecret: 'Hide secret key',
    totpCodeLabel: '6-digit code',
    totpCodePlaceholder: '000000',
    totpCancel: 'Cancel',
    totpVerify: 'Verify',
    totpBusyPreparing: 'Preparing…',
    totpAddButton: 'Add authenticator app (TOTP)',
    passkeyErrWebauthnDisabled:
      'Passkey enrollment is disabled on your Supabase project. Dashboard → Authentication → Multi-factor → WebAuthn: enable enrollment.',
    passkeyErrMfaDisabled:
      'MFA enrollment is disabled in Supabase (Authentication → Multi-factor). Enable enrollment for passkeys.',
    passkeyErrBrowserUnsupported:
      'This browser does not support WebAuthn (HTTPS or localhost required, or insecure context).',
    passkeyErrUnavailableSdk:
      'Passkey unavailable: update @supabase/supabase-js or enable MFA WebAuthn in Supabase.',
    passkeyErrIncomplete: 'Registration incomplete',
    passkeyToastSuccess:
      'Passkey saved. On this device, prefer biometric sign-in when offered.',
    passkeyErrGenericFallback: 'Passkey unavailable. Email magic-link sign-in still works.',
    passkeyButtonBusy: 'Registering…',
    passkeyButtonLabel: 'Enable Touch ID / Face ID / Windows Hello',
  },
  de: {
    securityPanelIntro:
      'Sie melden sich vor allem per <magiclink>E-Mail-Link</magiclink> an. Optional können Sie einen <secondfactor>zweiten Faktor</secondfactor> hinzufügen: zuerst eine <totpapp>TOTP-App</totpapp> (empfohlen—in <authdash>Authentication → Multi-factor</authdash> mit „TOTP : Enabled“), ggf. eine <passkey>Passkey</passkey>, sobald Supabase <webauthn>WebAuthn</webauthn>-Enrollment für Ihr Projekt aktiviert (sonst API-Fehler — <support>Supabase-Support</support> kontaktieren).',
    securityRegisteredSectionTitle: 'Hinterlegter zweiter Faktor',
    securityLoading: 'Wird geladen…',
    securityNoFactors: 'Noch keiner. Starten Sie unten mit „TOTP-App hinzufügen“.',
    securityFactorTotpLabel: 'TOTP-App',
    securityFactorPasskeyLabel: 'Passkey',
    securityRemoveFactor: 'Entfernen',
    toastSecurityFactorRemoved: 'Faktor von diesem Konto entfernt.',
    securityStep1Title: 'Schritt 1 — Authenticator-App (sofort nutzbar)',
    securityStep2Title: 'Schritt 2 — Biometrische Passkey (Touch ID, Face ID, Windows Hello)',
    securityStep2Hint:
      '„MFA enroll is disabled for WebAuthn“ ist kein App-Fehler: WebAuthn-Enrollment muss im gehosteten Supabase-Projekt aktiviert sein.',
    mfaFactorFriendlyName: 'REPUTEXA · {date}',
    totpErrIncompleteResponse: 'Unvollständige Serverantwort.',
    totpErrPrepareQr: 'QR-Code konnte nicht vorbereitet werden.',
    totpErrEnterSixDigits: 'Geben Sie den 6-stelligen Code aus der App ein.',
    totpToastAppRegistered: 'Authenticator-App registriert.',
    totpErrVerifyFallback: 'Code abgelehnt. Gerätezeit prüfen und erneut versuchen.',
    totpScanDescription:
      'Scannen Sie den QR-Code mit <ga>Google Authenticator</ga>, <au>Authy</au>, <op>1Password</op> oder der Authenticator-App Ihres Telefons, dann den 6-stelligen Code eingeben.',
    totpQrAlt: 'QR-Code zur TOTP-Einrichtung',
    totpShowSecret: 'Scannen unmöglich? Geheimschlüssel anzeigen',
    totpHideSecret: 'Geheimschlüssel ausblenden',
    totpCodeLabel: '6-stelliger Code',
    totpCodePlaceholder: '000000',
    totpCancel: 'Abbrechen',
    totpVerify: 'Bestätigen',
    totpBusyPreparing: 'Wird vorbereitet…',
    totpAddButton: 'Authenticator-App hinzufügen (TOTP)',
    passkeyErrWebauthnDisabled:
      'Passkey-Enrollment ist im Supabase-Projekt deaktiviert. Dashboard → Authentication → Multi-factor → WebAuthn: Enrollment aktivieren.',
    passkeyErrMfaDisabled:
      'MFA-Enrollment in Supabase deaktiviert (Authentication → Multi-factor). Enrollment für Passkeys aktivieren.',
    passkeyErrBrowserUnsupported:
      'Dieser Browser unterstützt kein WebAuthn (HTTPS oder localhost erforderlich).',
    passkeyErrUnavailableSdk:
      'Passkey nicht verfügbar: @supabase/supabase-js aktualisieren oder MFA WebAuthn in Supabase aktivieren.',
    passkeyErrIncomplete: 'Registrierung unvollständig',
    passkeyToastSuccess:
      'Passkey gespeichert. Nutzen Sie auf diesem Gerät die biometrische Anmeldung, wenn angeboten.',
    passkeyErrGenericFallback: 'Passkey nicht verfügbar. Anmeldung per E-Mail-Link funktioniert weiter.',
    passkeyButtonBusy: 'Wird registriert…',
    passkeyButtonLabel: 'Touch ID / Face ID / Windows Hello aktivieren',
  },
  es: {
    securityPanelIntro:
      'Accede sobre todo con un <magiclink>enlace por correo</magiclink>. Puede añadir un <secondfactor>segundo factor</secondfactor> opcional: primero una <totpapp>app TOTP</totpapp> (recomendado—actívela en <authdash>Authentication → Multi-factor</authdash> con « TOTP : Enabled »), luego opcionalmente una <passkey>passkey</passkey> cuando Supabase active el registro <webauthn>WebAuthn</webauthn> (si no, la API devuelve error—contacte con <support>soporte de Supabase</support>).',
    securityRegisteredSectionTitle: 'Segundo factor registrado',
    securityLoading: 'Cargando…',
    securityNoFactors: 'Ninguno por ahora. Empiece con « Añadir app de autenticación (TOTP) » abajo.',
    securityFactorTotpLabel: 'App TOTP',
    securityFactorPasskeyLabel: 'Passkey',
    securityRemoveFactor: 'Quitar',
    toastSecurityFactorRemoved: 'Factor eliminado de esta cuenta.',
    securityStep1Title: 'Paso 1 — App de autenticación (funciona ya)',
    securityStep2Title: 'Paso 2 — Passkey biométrica (Touch ID, Face ID, Windows Hello)',
    securityStep2Hint:
      'Si ve « MFA enroll is disabled for WebAuthn », no es un fallo de la app: debe activar el registro WebAuthn en su proyecto Supabase.',
    mfaFactorFriendlyName: 'REPUTEXA · {date}',
    totpErrIncompleteResponse: 'Respuesta del servidor incompleta.',
    totpErrPrepareQr: 'No se pudo preparar el código QR.',
    totpErrEnterSixDigits: 'Introduzca los 6 dígitos de la app.',
    totpToastAppRegistered: 'App de autenticación registrada.',
    totpErrVerifyFallback: 'Código rechazado. Compruebe la hora del dispositivo.',
    totpScanDescription:
      'Escanee el QR con <ga>Google Authenticator</ga>, <au>Authy</au>, <op>1Password</op> o la app de autenticación del teléfono, luego el código de 6 dígitos.',
    totpQrAlt: 'Código QR para configurar TOTP',
    totpShowSecret: '¿No puede escanear? Mostrar clave secreta',
    totpHideSecret: 'Ocultar clave secreta',
    totpCodeLabel: 'Código de 6 dígitos',
    totpCodePlaceholder: '000000',
    totpCancel: 'Cancelar',
    totpVerify: 'Verificar',
    totpBusyPreparing: 'Preparando…',
    totpAddButton: 'Añadir app de autenticación (TOTP)',
    passkeyErrWebauthnDisabled:
      'El registro de passkey está desactivado en Supabase. Dashboard → Authentication → Multi-factor → WebAuthn: activar registro.',
    passkeyErrMfaDisabled:
      'El registro MFA está desactivado en Supabase (Authentication → Multi-factor).',
    passkeyErrBrowserUnsupported:
      'Este navegador no admite WebAuthn (se requiere HTTPS o localhost).',
    passkeyErrUnavailableSdk:
      'Passkey no disponible: actualice @supabase/supabase-js o active MFA WebAuthn en Supabase.',
    passkeyErrIncomplete: 'Registro incompleto',
    passkeyToastSuccess:
      'Passkey guardada. En este dispositivo, prefiera el inicio biométrico cuando se ofrezca.',
    passkeyErrGenericFallback: 'Passkey no disponible. El acceso por enlace de correo sigue activo.',
    passkeyButtonBusy: 'Registrando…',
    passkeyButtonLabel: 'Activar Touch ID / Face ID / Windows Hello',
  },
  it: {
    securityPanelIntro:
      'Accedi soprattutto tramite <magiclink>link e-mail</magiclink>. Puoi aggiungere un <secondfactor>secondo fattore</secondfactor> opzionale: prima un’<totpapp>app TOTP</totpapp> (consigliato—in <authdash>Authentication → Multi-factor</authdash> con « TOTP : Enabled »), poi eventualmente una <passkey>passkey</passkey> quando Supabase abilita <webauthn>WebAuthn</webauthn> (altrimenti l’API restituisce errore—contatta il <support>supporto Supabase</support>).',
    securityRegisteredSectionTitle: 'Secondo fattore registrato',
    securityLoading: 'Caricamento…',
    securityNoFactors: 'Nessuno per ora. Inizia con « Aggiungi app di autenticazione (TOTP) » sotto.',
    securityFactorTotpLabel: 'App TOTP',
    securityFactorPasskeyLabel: 'Passkey',
    securityRemoveFactor: 'Rimuovi',
    toastSecurityFactorRemoved: 'Fattore rimosso da questo account.',
    securityStep1Title: 'Passo 1 — App di autenticazione (funziona subito)',
    securityStep2Title: 'Passo 2 — Passkey biometrica (Touch ID, Face ID, Windows Hello)',
    securityStep2Hint:
      'Se vedi « MFA enroll is disabled for WebAuthn », non è un bug dell’app: abilita l’enrollment WebAuthn sul progetto Supabase ospitato.',
    mfaFactorFriendlyName: 'REPUTEXA · {date}',
    totpErrIncompleteResponse: 'Risposta del server incompleta.',
    totpErrPrepareQr: 'Impossibile preparare il QR.',
    totpErrEnterSixDigits: 'Inserisci le 6 cifre dall’app.',
    totpToastAppRegistered: 'App di autenticazione registrata.',
    totpErrVerifyFallback: 'Codice rifiutato. Controlla l’orario del dispositivo.',
    totpScanDescription:
      'Scansiona il QR con <ga>Google Authenticator</ga>, <au>Authy</au>, <op>1Password</op> o l’app di autenticazione del telefono, poi il codice a 6 cifre.',
    totpQrAlt: 'QR code per configurare TOTP',
    totpShowSecret: 'Non riesci a scansionare? Mostra la chiave segreta',
    totpHideSecret: 'Nascondi chiave segreta',
    totpCodeLabel: 'Codice a 6 cifre',
    totpCodePlaceholder: '000000',
    totpCancel: 'Annulla',
    totpVerify: 'Conferma',
    totpBusyPreparing: 'Preparazione…',
    totpAddButton: 'Aggiungi app di autenticazione (TOTP)',
    passkeyErrWebauthnDisabled:
      'Enrollment passkey disattivato su Supabase. Dashboard → Authentication → Multi-factor → WebAuthn: abilitare enrollment.',
    passkeyErrMfaDisabled:
      'Enrollment MFA disattivato in Supabase (Authentication → Multi-factor).',
    passkeyErrBrowserUnsupported:
      'Questo browser non supporta WebAuthn (serve HTTPS o localhost).',
    passkeyErrUnavailableSdk:
      'Passkey non disponibile: aggiorna @supabase/supabase-js o abilita MFA WebAuthn in Supabase.',
    passkeyErrIncomplete: 'Registrazione incompleta',
    passkeyToastSuccess:
      'Passkey registrata. Su questo dispositivo preferisci l’accesso biometrico quando proposto.',
    passkeyErrGenericFallback: 'Passkey non disponibile. Il login con link e-mail resta attivo.',
    passkeyButtonBusy: 'Registrazione…',
    passkeyButtonLabel: 'Attiva Touch ID / Face ID / Windows Hello',
  },
  pt: {
    securityPanelIntro:
      'Inicia sessão sobretudo por <magiclink>link por e-mail</magiclink>. Pode adicionar um <secondfactor>segundo fator</secondfactor> opcional: primeiro uma <totpapp>app TOTP</totpapp> (recomendado—ative em <authdash>Authentication → Multi-factor</authdash> com « TOTP : Enabled »), depois opcionalmente uma <passkey>passkey</passkey> quando o Supabase ativar <webauthn>WebAuthn</webauthn> (senão a API devolve erro—contacte o <support>suporte Supabase</support>).',
    securityRegisteredSectionTitle: 'Segundo fator registado',
    securityLoading: 'A carregar…',
    securityNoFactors: 'Nenhum por agora. Comece com « Adicionar app de autenticação (TOTP) » abaixo.',
    securityFactorTotpLabel: 'App TOTP',
    securityFactorPasskeyLabel: 'Passkey',
    securityRemoveFactor: 'Remover',
    toastSecurityFactorRemoved: 'Fator removido desta conta.',
    securityStep1Title: 'Passo 1 — App de autenticação (funciona já)',
    securityStep2Title: 'Passo 2 — Passkey biométrica (Touch ID, Face ID, Windows Hello)',
    securityStep2Hint:
      'Se vir « MFA enroll is disabled for WebAuthn », não é um bug da app: ative o enrollment WebAuthn no projeto Supabase.',
    mfaFactorFriendlyName: 'REPUTEXA · {date}',
    totpErrIncompleteResponse: 'Resposta do servidor incompleta.',
    totpErrPrepareQr: 'Não foi possível preparar o QR.',
    totpErrEnterSixDigits: 'Introduza os 6 dígitos da app.',
    totpToastAppRegistered: 'App de autenticação registada.',
    totpErrVerifyFallback: 'Código recusado. Verifique a hora do dispositivo.',
    totpScanDescription:
      'Digitalize o QR com <ga>Google Authenticator</ga>, <au>Authy</au>, <op>1Password</op> ou a app de autenticação do telemóvel, depois o código de 6 dígitos.',
    totpQrAlt: 'Código QR para configurar TOTP',
    totpShowSecret: 'Não consegue digitalizar? Mostrar chave secreta',
    totpHideSecret: 'Ocultar chave secreta',
    totpCodeLabel: 'Código de 6 dígitos',
    totpCodePlaceholder: '000000',
    totpCancel: 'Cancelar',
    totpVerify: 'Validar',
    totpBusyPreparing: 'A preparar…',
    totpAddButton: 'Adicionar app de autenticação (TOTP)',
    passkeyErrWebauthnDisabled:
      'Enrollment de passkey desativado no Supabase. Dashboard → Authentication → Multi-factor → WebAuthn: ativar enrollment.',
    passkeyErrMfaDisabled:
      'Enrollment MFA desativado no Supabase (Authentication → Multi-factor).',
    passkeyErrBrowserUnsupported:
      'Este navegador não suporta WebAuthn (HTTPS ou localhost necessário).',
    passkeyErrUnavailableSdk:
      'Passkey indisponível: atualize @supabase/supabase-js ou ative MFA WebAuthn no Supabase.',
    passkeyErrIncomplete: 'Registo incompleto',
    passkeyToastSuccess:
      'Passkey guardada. Neste dispositivo, prefira o início biométrico quando disponível.',
    passkeyErrGenericFallback: 'Passkey indisponível. O início por link de e-mail continua disponível.',
    passkeyButtonBusy: 'A registar…',
    passkeyButtonLabel: 'Ativar Touch ID / Face ID / Windows Hello',
  },
  ja: {
    securityPanelIntro:
      '<magiclink>メールのリンク</magiclink>が主なログイン方法です。任意で<secondfactor>第2要素</secondfactor>を追加できます：まず<totpapp>TOTPアプリ</totpapp>（推奨。<authdash>Authentication → Multi-factor</authdash>で「TOTP : Enabled」）、その後、Supabaseが<webauthn>WebAuthn</webauthn>登録を有効にしたら<passkey>パスキー</passkey>も可能です（未設定の場合はAPIエラー—<support>Supabaseサポート</support>へ）。',
    securityRegisteredSectionTitle: '登録済みの第2要素',
    securityLoading: '読み込み中…',
    securityNoFactors: 'まだありません。下の「TOTPアプリを追加」から始めてください。',
    securityFactorTotpLabel: 'TOTPアプリ',
    securityFactorPasskeyLabel: 'パスキー',
    securityRemoveFactor: '削除',
    toastSecurityFactorRemoved: '第2要素をこのアカウントから削除しました。',
    securityStep1Title: 'ステップ1 — 認証アプリ（すぐ使えます）',
    securityStep2Title: 'ステップ2 — 生体認証パスキー（Touch ID、Face ID、Windows Hello）',
    securityStep2Hint:
      '「MFA enroll is disabled for WebAuthn」と出た場合はアプリの不具合ではありません。ホスト中のSupabaseプロジェクトでWebAuthn登録を有効にしてください。',
    mfaFactorFriendlyName: 'REPUTEXA · {date}',
    totpErrIncompleteResponse: 'サーバー応答が不完全です。',
    totpErrPrepareQr: 'QRコードを準備できませんでした。',
    totpErrEnterSixDigits: 'アプリに表示される6桁のコードを入力してください。',
    totpToastAppRegistered: '認証アプリを登録しました。',
    totpErrVerifyFallback: 'コードが拒否されました。端末の時刻を確認してください。',
    totpScanDescription:
      '<ga>Google Authenticator</ga>、<au>Authy</au>、<op>1Password</op>またはスマホの認証アプリでQRを読み取り、6桁のコードを入力してください。',
    totpQrAlt: 'TOTP設定用QRコード',
    totpShowSecret: 'スキャンできない場合は秘密鍵を表示',
    totpHideSecret: '秘密鍵を隠す',
    totpCodeLabel: '6桁のコード',
    totpCodePlaceholder: '000000',
    totpCancel: 'キャンセル',
    totpVerify: '確認',
    totpBusyPreparing: '準備中…',
    totpAddButton: '認証アプリを追加（TOTP）',
    passkeyErrWebauthnDisabled:
      'Supabaseでパスキー登録が無効です。Dashboard → Authentication → Multi-factor → WebAuthn で登録を有効にしてください。',
    passkeyErrMfaDisabled:
      'SupabaseでMFA登録が無効です（Authentication → Multi-factor）。',
    passkeyErrBrowserUnsupported:
      'このブラウザはWebAuthnに対応していません（HTTPSまたはlocalhostが必要）。',
    passkeyErrUnavailableSdk:
      'パスキー利用不可：@supabase/supabase-jsを更新するか、SupabaseでMFA WebAuthnを有効にしてください。',
    passkeyErrIncomplete: '登録が完了していません',
    passkeyToastSuccess:
      'パスキーを保存しました。この端末では生体認証ログインを優先してください。',
    passkeyErrGenericFallback: 'パスキーは利用できません。メールリンクでのログインは引き続き利用できます。',
    passkeyButtonBusy: '登録中…',
    passkeyButtonLabel: 'Touch ID / Face ID / Windows Hello を有効化',
  },
  zh: {
    securityPanelIntro:
      '您主要通过<magiclink>邮件链接</magiclink>登录。可添加可选的<secondfactor>第二因素</secondfactor>：先配置<totpapp>TOTP 应用</totpapp>（推荐，在<authdash>Authentication → Multi-factor</authdash>中启用「TOTP : Enabled」），之后在 Supabase 启用<webauthn>WebAuthn</webauthn>注册后可添加<passkey>通行密钥</passkey>（否则会 API 报错—联系<support>Supabase 支持</support>）。',
    securityRegisteredSectionTitle: '已登记的第二因素',
    securityLoading: '加载中…',
    securityNoFactors: '暂无。请从下方「添加身份验证应用（TOTP）」开始。',
    securityFactorTotpLabel: 'TOTP 应用',
    securityFactorPasskeyLabel: '通行密钥',
    securityRemoveFactor: '移除',
    toastSecurityFactorRemoved: '已从该账户移除此因素。',
    securityStep1Title: '步骤 1 — 身份验证应用（立即可用）',
    securityStep2Title: '步骤 2 — 生物识别通行密钥（Touch ID、Face ID、Windows Hello）',
    securityStep2Hint:
      '若出现「MFA enroll is disabled for WebAuthn」，并非应用故障：请在托管的 Supabase 项目中启用 WebAuthn 注册。',
    mfaFactorFriendlyName: 'REPUTEXA · {date}',
    totpErrIncompleteResponse: '服务器响应不完整。',
    totpErrPrepareQr: '无法生成二维码。',
    totpErrEnterSixDigits: '请输入应用中显示的 6 位数字代码。',
    totpToastAppRegistered: '身份验证应用已登记。',
    totpErrVerifyFallback: '代码被拒绝。请检查设备时间后重试。',
    totpScanDescription:
      '使用 <ga>Google Authenticator</ga>、<au>Authy</au>、<op>1Password</op> 或手机上的验证器应用扫描此二维码，然后输入 6 位代码。',
    totpQrAlt: '用于设置 TOTP 的二维码',
    totpShowSecret: '无法扫描？显示密钥',
    totpHideSecret: '隐藏密钥',
    totpCodeLabel: '6 位数字代码',
    totpCodePlaceholder: '000000',
    totpCancel: '取消',
    totpVerify: '验证',
    totpBusyPreparing: '准备中…',
    totpAddButton: '添加身份验证应用（TOTP）',
    passkeyErrWebauthnDisabled:
      'Supabase 项目未启用通行密钥注册。Dashboard → Authentication → Multi-factor → WebAuthn：启用注册。',
    passkeyErrMfaDisabled:
      'Supabase 中 MFA 注册已关闭（Authentication → Multi-factor）。',
    passkeyErrBrowserUnsupported:
      '此浏览器不支持 WebAuthn（需要 HTTPS 或 localhost）。',
    passkeyErrUnavailableSdk:
      '通行密钥不可用：请更新 @supabase/supabase-js 或在 Supabase 启用 MFA WebAuthn。',
    passkeyErrIncomplete: '注册未完成',
    passkeyToastSuccess:
      '通行密钥已保存。在本设备上建议优先使用生物识别登录。',
    passkeyErrGenericFallback: '通行密钥不可用。仍可使用邮件链接登录。',
    passkeyButtonBusy: '注册中…',
    passkeyButtonLabel: '启用 Touch ID / Face ID / Windows Hello',
  },
};

for (const [locale, keys] of Object.entries(PATCH)) {
  const fp = path.join(messagesDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  if (!data.Dashboard?.settings) throw new Error(`Missing Dashboard.settings in ${locale}`);
  Object.assign(data.Dashboard.settings, keys);
  fs.writeFileSync(fp, `${JSON.stringify(data)}\n`);
}

console.log('Patched:', Object.keys(PATCH).join(', '));
