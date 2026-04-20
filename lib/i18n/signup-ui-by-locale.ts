import { SITE_LOCALE_CODES, type SiteLocaleCode } from '@/lib/i18n/site-locales-catalog';
import { expandPricingTokensInString } from '@/lib/i18n/pricing-message-format';

/**
 * Inscription : textes UI + exemples culturels (noms, enseignes, villes — transcréation, pas traduction littérale).
 */
export type SignupUiCopy = {
  login: string;
  title: string;
  checkoutSubtitle: string;
  checkoutSubtitleAnnual: string;
  checkoutSubtitleMonthly: string;
  checkoutEnd: string;
  trialLine: string;
  trialBox: string;
  securityTitle: string;
  securityBody: string;
  labelFullName: string;
  placeholderFullName: string;
  labelEstablishment: string;
  placeholderEstablishment: string;
  labelEstablishmentType: string;
  placeholderEstablishmentType: string;
  hintEstablishmentType: string;
  labelAddress: string;
  placeholderAddress: string;
  labelCountry: string;
  hintCountry: string;
  labelPhone: string;
  placeholderPhone: string;
  labelEmail: string;
  placeholderEmail: string;
  submitLoading: string;
  submitIdle: string;
  footerLoginPrompt: string;
  footerLoginCta: string;
  footerHome: string;
  toastInvalidPhone: string;
  toastCheckFields: string;
  toastTurnstileWait: string;
  toastVerifyFailed: string;
  toastNetwork: string;
  toastRateLimit: string;
  toastPhoneTaken: string;
  toastCreated: string;
};

const signupUiEn: SignupUiCopy = {
  login: 'Log in',
  title: 'Create my account',
  checkoutSubtitle: 'You selected the',
  checkoutSubtitleAnnual: 'plan (annual billing -20%)',
  checkoutSubtitleMonthly: 'plan (monthly billing)',
  checkoutEnd: '— Complete signup to continue to payment.',
  trialLine: 'Free ZENITH trial — [[PX:zero]] today, card required',
  trialBox:
    'Free trial on the ZENITH plan. Card required to activate access. Cancel anytime in one click from your account.',
  securityTitle: 'Passwordless security',
  securityBody:
    'No password to create or remember: secure email activation, then magic-link login or optional passkey on your dashboard.',
  labelFullName: 'First & last name',
  placeholderFullName: 'Jordan Smith',
  labelEstablishment: 'Business name',
  placeholderEstablishment: 'The Riverside Café',
  labelEstablishmentType: 'Business type',
  placeholderEstablishmentType: 'Hotel, restaurant, bar, hair salon…',
  hintEstablishmentType:
    'Describe your activity (e.g. hotel, restaurant, bar, medical practice). You can be specific.',
  labelAddress: 'Address',
  placeholderAddress: 'Enter your street address…',
  labelCountry: 'Country',
  hintCountry:
    'Prefilled from site language. All countries: click the field and type the name or ISO code (e.g. us, United States). Same logic as the phone prefix.',
  labelPhone: 'Phone',
  placeholderPhone: '512 555 0198',
  labelEmail: 'Email',
  placeholderEmail: 'you@yourbusiness.com',
  submitLoading: 'Creating your account…',
  submitIdle: 'Create secure access',
  footerLoginPrompt: 'Already have an account?',
  footerLoginCta: 'Log in',
  footerHome: '← Back to home',
  toastInvalidPhone: 'Invalid phone number.',
  toastCheckFields: 'Please check the fields.',
  toastTurnstileWait: 'Security check in progress. Try again in a moment.',
  toastVerifyFailed: 'Verification failed. Please retry.',
  toastNetwork: 'Network error. Please retry.',
  toastRateLimit: 'Too many attempts. Please wait a minute.',
  toastPhoneTaken: 'This phone number is already linked to an account.',
  toastCreated:
    'Account created! Check your email: 6-digit code or secure link. No password to remember.',
};

const BY: Record<SiteLocaleCode, SignupUiCopy> = {
  fr: {
    login: 'Connexion',
    title: 'Créer mon compte',
    checkoutSubtitle: 'Vous avez choisi le plan',
    checkoutSubtitleAnnual: '(facturation annuelle -20%)',
    checkoutSubtitleMonthly: '(facturation mensuelle)',
    checkoutEnd: '— Finalisez votre inscription pour passer au paiement.',
    trialLine: 'Essai gratuit ZENITH — [[PX:zero]] aujourd’hui, carte requise',
    trialBox:
      'Essai gratuit sur le plan ZENITH. Carte bancaire requise pour valider l’accès. Annulation en un clic depuis votre espace client.',
    securityTitle: 'Sécurité sans mot de passe',
    securityBody:
      'Aucun mot de passe à créer ni à mémoriser : activation par e-mail sécurisé, puis connexion par lien magique ou biométrie (passkey) optionnelle sur votre espace.',
    labelFullName: 'Prénom / Nom',
    placeholderFullName: 'Jean Dupont',
    labelEstablishment: 'Nom de l’établissement',
    placeholderEstablishment: 'La Frite d’Or',
    labelEstablishmentType: 'Type d’établissement',
    placeholderEstablishmentType: 'Hôtel, restaurant, bar, salon de coiffure…',
    hintEstablishmentType:
      'Indiquez le type d’activité (ex. : hôtel, restaurant, bar, cabinet médical…). Vous pouvez préciser librement.',
    labelAddress: 'Adresse',
    placeholderAddress: 'Saisissez votre adresse…',
    labelCountry: 'Pays',
    hintCountry:
      'Prérempli selon la langue du site. Tous les pays : cliquez dans le champ puis tapez le nom ou le code (ex. fr, France). Même logique que l’indicatif téléphone.',
    labelPhone: 'Téléphone',
    placeholderPhone: '6 12 34 56 78',
    labelEmail: 'Email',
    placeholderEmail: 'vous@etablissement.com',
    submitLoading: 'Création en cours…',
    submitIdle: 'Créer mon accès sécurisé',
    footerLoginPrompt: 'Déjà un compte ?',
    footerLoginCta: 'Se connecter',
    footerHome: '← Retour à l’accueil',
    toastInvalidPhone: 'Numéro de téléphone invalide.',
    toastCheckFields: 'Vérifiez les champs.',
    toastTurnstileWait: 'Vérification de sécurité en cours. Réessayez dans un instant.',
    toastVerifyFailed: 'Vérification échouée. Réessayez.',
    toastNetwork: 'Erreur réseau. Réessayez.',
    toastRateLimit: 'Trop de tentatives. Veuillez patienter une minute.',
    toastPhoneTaken: 'Ce numéro de téléphone est déjà associé à un compte.',
    toastCreated:
      'Compte créé ! Vérifiez votre e-mail : code à 6 chiffres ou lien sécurisé. Aucun mot de passe à retenir.',
  },
  en: signupUiEn,
  'en-gb': {
    ...signupUiEn,
    trialLine: 'Free ZENITH trial — [[PX:zero]] today, card required',
    placeholderPhone: '7700 900123',
    placeholderFullName: 'James Smith',
    placeholderEstablishment: 'The Crown & Anchor',
  },
  es: {
    login: 'Acceder',
    title: 'Crear mi cuenta',
    checkoutSubtitle: 'Ha elegido el plan',
    checkoutSubtitleAnnual: '(facturación anual -20%)',
    checkoutSubtitleMonthly: '(facturación mensual)',
    checkoutEnd: '— Finalice el registro para continuar al pago.',
    trialLine: 'Prueba ZENITH gratis — [[PX:zero]] hoy, tarjeta obligatoria',
    trialBox:
      'Prueba gratuita del plan ZENITH. Tarjeta necesaria para activar el acceso. Cancelación en un clic desde su cuenta.',
    securityTitle: 'Seguridad sin contraseña',
    securityBody:
      'Sin contraseña que crear ni recordar: activación por e-mail seguro, luego acceso por enlace mágico o passkey opcional.',
    labelFullName: 'Nombre y apellidos',
    placeholderFullName: 'Carlos García López',
    labelEstablishment: 'Nombre del negocio',
    placeholderEstablishment: 'Taberna El Faro',
    labelEstablishmentType: 'Tipo de negocio',
    placeholderEstablishmentType: 'Hotel, restaurante, bar, peluquería…',
    hintEstablishmentType:
      'Indique el tipo de actividad (ej.: hotel, restaurante, bar, clínica). Puede detallar libremente.',
    labelAddress: 'Dirección',
    placeholderAddress: 'Introduzca su dirección…',
    labelCountry: 'País',
    hintCountry:
      'Pre-rellenado según el idioma del sitio. Todos los países: haga clic y escriba el nombre o código (ej. es, España).',
    labelPhone: 'Teléfono',
    placeholderPhone: '612 345 678',
    labelEmail: 'Correo electrónico',
    placeholderEmail: 'usted@restaurante.es',
    submitLoading: 'Creando cuenta…',
    submitIdle: 'Crear acceso seguro',
    footerLoginPrompt: '¿Ya tiene cuenta?',
    footerLoginCta: 'Iniciar sesión',
    footerHome: '← Volver al inicio',
    toastInvalidPhone: 'Número de teléfono no válido.',
    toastCheckFields: 'Revise los campos.',
    toastTurnstileWait: 'Verificación de seguridad en curso. Inténtelo de nuevo.',
    toastVerifyFailed: 'Verificación fallida. Inténtelo de nuevo.',
    toastNetwork: 'Error de red. Inténtelo de nuevo.',
    toastRateLimit: 'Demasiados intentos. Espere un minuto.',
    toastPhoneTaken: 'Este teléfono ya está asociado a una cuenta.',
    toastCreated:
      '¡Cuenta creada! Revise su correo: código de 6 dígitos o enlace seguro. Sin contraseña que recordar.',
  },
  de: {
    login: 'Anmelden',
    title: 'Konto erstellen',
    checkoutSubtitle: 'Sie haben den Plan',
    checkoutSubtitleAnnual: 'gewählt (jährliche Abrechnung -20%)',
    checkoutSubtitleMonthly: 'gewählt (monatliche Abrechnung)',
    checkoutEnd: '— Schließen Sie die Registrierung ab, um zur Zahlung zu gelangen.',
    trialLine: 'Kostenlose ZENITH-Testphase — [[PX:zero]] heute, Karte erforderlich',
    trialBox:
      'Kostenlose Testphase auf ZENITH. Karte zur Freischaltung nötig. Kündigung mit einem Klick im Kundenbereich.',
    securityTitle: 'Sicherheit ohne Passwort',
    securityBody:
      'Kein Passwort anlegen oder merken: Aktivierung per sicherer E-Mail, dann Magic-Link oder optional Passkey.',
    labelFullName: 'Vor- und Nachname',
    placeholderFullName: 'Lukas Schmidt',
    labelEstablishment: 'Name des Betriebs',
    placeholderEstablishment: 'Café Berliner Tor',
    labelEstablishmentType: 'Art des Betriebs',
    placeholderEstablishmentType: 'Hotel, Restaurant, Bar, Friseursalon…',
    hintEstablishmentType:
      'Beschreiben Sie Ihre Branche (z. B. Hotel, Restaurant, Arztpraxis). Frei formulierbar.',
    labelAddress: 'Adresse',
    placeholderAddress: 'Straße und Hausnummer eingeben…',
    labelCountry: 'Land',
    hintCountry:
      'Vorausgefüllt nach Sprache. Alle Länder: Feld anklicken und Name oder ISO-Code eingeben (z. B. de, Deutschland).',
    labelPhone: 'Telefon',
    placeholderPhone: '0176 12345678',
    labelEmail: 'E-Mail',
    placeholderEmail: 'sie@restaurant.de',
    submitLoading: 'Konto wird erstellt…',
    submitIdle: 'Sicheren Zugang erstellen',
    footerLoginPrompt: 'Schon ein Konto?',
    footerLoginCta: 'Anmelden',
    footerHome: '← Zur Startseite',
    toastInvalidPhone: 'Ungültige Telefonnummer.',
    toastCheckFields: 'Bitte Felder prüfen.',
    toastTurnstileWait: 'Sicherheitsprüfung läuft. Bitte kurz warten.',
    toastVerifyFailed: 'Prüfung fehlgeschlagen. Bitte erneut versuchen.',
    toastNetwork: 'Netzwerkfehler. Bitte erneut versuchen.',
    toastRateLimit: 'Zu viele Versuche. Bitte eine Minute warten.',
    toastPhoneTaken: 'Diese Nummer ist bereits vergeben.',
    toastCreated:
      'Konto erstellt! E-Mail prüfen: 6-stelliger Code oder sicherer Link. Kein Passwort nötig.',
  },
  it: {
    login: 'Accedi',
    title: 'Crea il mio account',
    checkoutSubtitle: 'Hai scelto il piano',
    checkoutSubtitleAnnual: '(fatturazione annuale -20%)',
    checkoutSubtitleMonthly: '(fatturazione mensile)',
    checkoutEnd: '— Completa la registrazione per andare al pagamento.',
    trialLine: 'Prova ZENITH gratuita — [[PX:zero]] oggi, carta richiesta',
    trialBox:
      'Prova gratuita sul piano ZENITH. Carta necessaria per attivare l’accesso. Disdetta in un clic dall’area cliente.',
    securityTitle: 'Sicurezza senza password',
    securityBody:
      'Nessuna password da creare: attivazione via e-mail sicura, poi accesso con link magico o passkey opzionale.',
    labelFullName: 'Nome e cognome',
    placeholderFullName: 'Alessandro Conti',
    labelEstablishment: 'Nome dell’attività',
    placeholderEstablishment: 'Trattoria Da Luigi',
    labelEstablishmentType: 'Tipo di attività',
    placeholderEstablishmentType: 'Hotel, ristorante, bar, salone…',
    hintEstablishmentType:
      'Indica il settore (es. hotel, ristorante, bar, studio medico). Puoi specificare liberamente.',
    labelAddress: 'Indirizzo',
    placeholderAddress: 'Inserisci indirizzo e civico…',
    labelCountry: 'Paese',
    hintCountry:
      'Precompilato in base alla lingua del sito. Tutti i Paesi: clicca e digita nome o codice (es. it, Italia).',
    labelPhone: 'Telefono',
    placeholderPhone: '320 123 4567',
    labelEmail: 'Email',
    placeholderEmail: 'tu@ristorante.it',
    submitLoading: 'Creazione account…',
    submitIdle: 'Crea accesso sicuro',
    footerLoginPrompt: 'Hai già un account?',
    footerLoginCta: 'Accedi',
    footerHome: '← Torna alla home',
    toastInvalidPhone: 'Numero di telefono non valido.',
    toastCheckFields: 'Controlla i campi.',
    toastTurnstileWait: 'Verifica di sicurezza in corso. Riprova tra poco.',
    toastVerifyFailed: 'Verifica non riuscita. Riprova.',
    toastNetwork: 'Errore di rete. Riprova.',
    toastRateLimit: 'Troppi tentativi. Attendi un minuto.',
    toastPhoneTaken: 'Questo numero è già associato a un account.',
    toastCreated:
      'Account creato! Controlla l’email: codice a 6 cifre o link sicuro. Nessuna password da ricordare.',
  },
  pt: {
    login: 'Entrar',
    title: 'Criar a minha conta',
    checkoutSubtitle: 'Escolheu o plano',
    checkoutSubtitleAnnual: '(faturação anual -20%)',
    checkoutSubtitleMonthly: '(faturação mensal)',
    checkoutEnd: '— Conclua o registo para seguir para o pagamento.',
    trialLine: 'Teste ZENITH gratuito — [[PX:zero]] hoje, cartão obrigatório',
    trialBox:
      'Teste gratuito no plano ZENITH. Cartão necessário para ativar o acesso. Cancelamento num clique na sua conta.',
    securityTitle: 'Segurança sem palavra-passe',
    securityBody:
      'Sem palavra-passe a memorizar: ativação por e-mail seguro, depois link mágico ou passkey opcional.',
    labelFullName: 'Nome completo',
    placeholderFullName: 'João Silva',
    labelEstablishment: 'Nome do estabelecimento',
    placeholderEstablishment: 'Restaurante O Porto',
    labelEstablishmentType: 'Tipo de estabelecimento',
    placeholderEstablishmentType: 'Hotel, restaurante, bar, salão…',
    hintEstablishmentType:
      'Indique a atividade (ex.: hotel, restaurante, bar, clínica). Pode detalhar à vontade.',
    labelAddress: 'Morada',
    placeholderAddress: 'Introduza a sua morada…',
    labelCountry: 'País',
    hintCountry:
      'Pré-preenchido conforme o idioma do site. Todos os países: clique e escreva o nome ou código (ex. pt, Portugal).',
    labelPhone: 'Telefone',
    placeholderPhone: '912 345 678',
    labelEmail: 'E-mail',
    placeholderEmail: 'voce@restaurante.pt',
    submitLoading: 'A criar a conta…',
    submitIdle: 'Criar acesso seguro',
    footerLoginPrompt: 'Já tem conta?',
    footerLoginCta: 'Entrar',
    footerHome: '← Voltar ao início',
    toastInvalidPhone: 'Número de telefone inválido.',
    toastCheckFields: 'Verifique os campos.',
    toastTurnstileWait: 'Verificação de segurança em curso. Tente novamente.',
    toastVerifyFailed: 'Verificação falhou. Tente novamente.',
    toastNetwork: 'Erro de rede. Tente novamente.',
    toastRateLimit: 'Demasiadas tentativas. Aguarde um minuto.',
    toastPhoneTaken: 'Este número já está associado a uma conta.',
    toastCreated:
      'Conta criada! Verifique o e-mail: código de 6 dígitos ou ligação segura. Sem palavra-passe.',
  },
  ja: {
    login: 'ログイン',
    title: 'アカウントを作成',
    checkoutSubtitle: '選択したプラン：',
    checkoutSubtitleAnnual: '（年払い -20%）',
    checkoutSubtitleMonthly: '（月払い）',
    checkoutEnd: '— 登録を完了してお支払いへ。',
    trialLine: 'ZENITH 無料トライアル — 本日[[PX:zero]]、カード登録が必要です',
    trialBox:
      'ZENITHプランの無料トライアル。利用開始にカードが必要です。マイページからワンクリックで解約できます。',
    securityTitle: 'パスワード不要のセキュリティ',
    securityBody:
      'パスワードの作成・記憶は不要です。安全なメールで認証後、マジックリンクまたはパスキー（任意）でログイン。',
    labelFullName: 'お名前',
    placeholderFullName: '山田 太郎',
    labelEstablishment: '店舗・事業所名',
    placeholderEstablishment: '喫茶 さくら',
    labelEstablishmentType: '業種',
    placeholderEstablishmentType: 'ホテル、飲食店、バー、美容室など',
    hintEstablishmentType:
      '業種を具体的にご記入ください（例：ホテル、レストラン、クリニック）。自由記述で構いません。',
    labelAddress: '住所',
    placeholderAddress: '住所を入力…',
    labelCountry: '国',
    hintCountry:
      'サイト表示言語に応じて初期値が入ります。各国名や国コード（例：jp）で検索できます。電話の国番号と連動します。',
    labelPhone: '電話番号',
    placeholderPhone: '090-1234-5678',
    labelEmail: 'メールアドレス',
    placeholderEmail: 'you@example.co.jp',
    submitLoading: '作成中…',
    submitIdle: '安全なアクセスを作成',
    footerLoginPrompt: 'すでにアカウントをお持ちですか？',
    footerLoginCta: 'ログイン',
    footerHome: '← ホームへ戻る',
    toastInvalidPhone: '電話番号の形式が正しくありません。',
    toastCheckFields: '入力内容をご確認ください。',
    toastTurnstileWait: 'セキュリティ確認中です。しばらくしてから再試行してください。',
    toastVerifyFailed: '確認に失敗しました。再試行してください。',
    toastNetwork: '通信エラー。再試行してください。',
    toastRateLimit: '試行回数が多すぎます。1分ほどお待ちください。',
    toastPhoneTaken: 'この電話番号は既に登録されています。',
    toastCreated:
      'アカウントを作成しました。メールをご確認ください（6桁コードまたは安全なリンク）。パスワードは不要です。',
  },
  zh: {
    login: '登录',
    title: '创建账户',
    checkoutSubtitle: '您选择的方案：',
    checkoutSubtitleAnnual: '（年付 -20%）',
    checkoutSubtitleMonthly: '（月付）',
    checkoutEnd: '— 完成注册后继续付款。',
    trialLine: 'ZENITH 免费试用 — 今日[[PX:zero]]，需绑定银行卡',
    trialBox:
      'ZENITH 方案免费试用。需银行卡验证开通。可在账户内一键取消。',
    securityTitle: '无密码安全登录',
    securityBody:
      '无需创建或记忆密码：通过安全邮件激活，随后使用魔法链接或可选通行密钥登录。',
    labelFullName: '姓名',
    placeholderFullName: '张伟',
    labelEstablishment: '门店 / 企业名称',
    placeholderEstablishment: '金星餐厅',
    labelEstablishmentType: '经营类型',
    placeholderEstablishmentType: '酒店、餐厅、酒吧、美发店等',
    hintEstablishmentType: '请说明业态（如酒店、餐饮、诊所等），可自由填写。',
    labelAddress: '地址',
    placeholderAddress: '请输入详细地址…',
    labelCountry: '国家/地区',
    hintCountry:
      '根据网站语言预填。支持搜索国家名或代码（如 cn、中国）。与电话区号逻辑一致。',
    labelPhone: '手机',
    placeholderPhone: '138 0013 8000',
    labelEmail: '电子邮箱',
    placeholderEmail: 'you@example.com',
    submitLoading: '正在创建…',
    submitIdle: '创建安全访问',
    footerLoginPrompt: '已有账户？',
    footerLoginCta: '去登录',
    footerHome: '← 返回首页',
    toastInvalidPhone: '手机号格式无效。',
    toastCheckFields: '请检查表单。',
    toastTurnstileWait: '安全验证进行中，请稍后再试。',
    toastVerifyFailed: '验证失败，请重试。',
    toastNetwork: '网络错误，请重试。',
    toastRateLimit: '尝试次数过多，请等待一分钟。',
    toastPhoneTaken: '该手机号已绑定账户。',
    toastCreated: '账户已创建！请查收邮件：6 位验证码或安全链接。无需密码。',
  },
  /* @babel-anchor signup-locale-insert */
};

export function getSignupUi(locale: string): SignupUiCopy {
  const code = (SITE_LOCALE_CODES as readonly string[]).includes(locale) ? (locale as SiteLocaleCode) : 'fr';
  const base = BY[code];
  return {
    ...base,
    trialLine: expandPricingTokensInString(base.trialLine, code),
  };
}
