/**
 * Vague 2 — Billing namespace (erreurs API + libellés plans + prix/mois).
 * node scripts/merge-billing-i18n-v2.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const locales = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];

const fr = {
  errors: {
    stripeNotConfigured:
      'Le paiement est momentanément indisponible. Réessayez dans quelques instants ou écrivez à votre conseiller REPUTEXA.',
    annualPriceNotConfigured:
      "La facturation annuelle n'est pas proposée pour cette offre. Passez en mensuel ou contactez-nous.",
    monthlyPriceNotConfigured:
      'Ce tarif est indisponible pour le moment. Actualisez la page ou contactez le support.',
    quantityTargetMustExceedCurrent:
      "Le nombre d'emplacements visé doit dépasser votre capacité actuelle.",
    stripeCustomerNotFound:
      "Aucun compte de facturation n'est rattaché à cette adresse e-mail.",
    noActiveSubscription: "Nous ne détectons pas d'abonnement actif sur ce compte.",
    noActiveSubscriptionUsePortal:
      "Pas d'abonnement actif. Ouvrez l'espace facturation Stripe depuis vos paramètres pour ajuster votre offre.",
    invalidSubscriptionItem:
      "Votre abonnement ne permet pas cette opération pour l'instant. Utilisez le portail client ou le support.",
    checkoutSessionCreateFailed:
      "Impossible d'ouvrir la session de paiement sécurisée. Réessayez ou contactez-nous.",
    checkoutFailed: 'Le paiement n’a pas pu démarrer. Réessayez dans un instant.',
    notAuthenticated: 'Connectez-vous pour poursuivre.',
    expansionFailed: "L'ajout d'emplacements n'a pas pu être confirmé. Réessayez ou contactez le support.",
    serviceUnavailable: 'Service momentanément indisponible. Merci de réessayer ultérieurement.',
    profileNotFound: 'Profil introuvable.',
    planInvalid: 'Offre non reconnue. Choisissez Vision, Pulse ou Zénith.',
    updateFailed: "La mise à jour n'a pas abouti. Réessayez.",
    premiumFallbackPlan: 'Premium',
    alreadyAnnualBilling: 'Vous êtes déjà en facturation annuelle.',
    planNotRecognizedForSwitch: 'Offre non reconnue pour ce changement de cycle.',
    portalOpenFailed: "Impossible d'ouvrir l'espace facturation. Réessayez.",
    expansionSessionCreateFailed: "Impossible de préparer l'ajout d'emplacements. Réessayez.",
    invalidJsonBody: 'Requête invalide (JSON).',
    expansionAddCountRequired: 'Indiquez un nombre d’emplacements à ajouter (1 à 15).',
    subscriptionInvalidPrice: 'Abonnement incomplet : tarif Stripe introuvable.',
    genericError: 'Une erreur est survenue. Réessayez.',
    syncFailed: 'La synchronisation du compte a échoué. Réessayez.',
    webhookSecretNotConfigured: 'Configuration webhook incomplète côté serveur.',
    webhookNoSignature: 'Requête webhook invalide (signature absente).',
    webhookInvalidSignature: 'Signature webhook invalide.',
    webhookHandlerFailed: "Traitement de l'événement interrompu.",
  },
  plans: { vision: 'Vision', pulse: 'Pulse', zenith: 'ZENITH' },
  pricePerMonthFormatted: '{price} / mois',
  placeholders: {
    pendingEstablishmentSlot: 'Nouvel emplacement en attente',
    defaultEstablishmentLabel: 'Votre établissement',
  },
  switchAnnualComplete: 'Mise à jour enregistrée.',
  switchAnnualPaid: 'Rien à payer : la facture est déjà réglée.',
};

const en = {
  errors: {
    stripeNotConfigured:
      'Checkout is temporarily unavailable. Try again in a moment — if it persists, reach out and we’ll fix it fast.',
    annualPriceNotConfigured:
      'Annual billing isn’t available for this plan right now. Switch to monthly or contact us.',
    monthlyPriceNotConfigured:
      'This price isn’t available at the moment. Refresh and try again, or contact support.',
    quantityTargetMustExceedCurrent:
      'Target seats must be higher than your current seat count.',
    stripeCustomerNotFound: 'No billing account is linked to this email address.',
    noActiveSubscription: 'We don’t see an active subscription on this account.',
    noActiveSubscriptionUsePortal:
      'No active subscription. Open the billing portal from Settings to manage your plan.',
    invalidSubscriptionItem:
      'Your subscription can’t run this action right now. Use the customer portal or contact support.',
    checkoutSessionCreateFailed:
      'We couldn’t open a secure checkout session. Try again or contact us.',
    checkoutFailed: 'We couldn’t start checkout. Try again in a moment.',
    notAuthenticated: 'Sign in to continue.',
    expansionFailed: 'We couldn’t confirm the seat expansion. Try again or contact support.',
    serviceUnavailable: 'Service temporarily unavailable. Please try again later.',
    profileNotFound: 'Profile not found.',
    planInvalid: 'Unknown plan. Pick Vision, Pulse, or Zenith.',
    updateFailed: 'Update didn’t go through. Try again.',
    premiumFallbackPlan: 'Premium',
    alreadyAnnualBilling: 'You’re already on annual billing.',
    planNotRecognizedForSwitch: 'That plan isn’t available for this billing switch.',
    portalOpenFailed: 'We couldn’t open the billing portal. Try again.',
    expansionSessionCreateFailed: 'We couldn’t prepare the seat add-on. Try again.',
    invalidJsonBody: 'Invalid request body.',
    expansionAddCountRequired: 'Add-on count required (1–15).',
    subscriptionInvalidPrice: 'Subscription misconfigured: Stripe price missing.',
    genericError: 'Something went wrong. Try again.',
    syncFailed: 'Account sync failed. Try again.',
    webhookSecretNotConfigured: 'Webhook is not configured on the server.',
    webhookNoSignature: 'Invalid webhook request (missing signature).',
    webhookInvalidSignature: 'Invalid webhook signature.',
    webhookHandlerFailed: 'Could not process this webhook event.',
  },
  plans: { vision: 'Vision', pulse: 'Pulse', zenith: 'ZENITH' },
  pricePerMonthFormatted: '{price}/mo',
  placeholders: {
    pendingEstablishmentSlot: 'New location pending setup',
    defaultEstablishmentLabel: 'Your business',
  },
  switchAnnualComplete: "You're all set — we've applied the change.",
  switchAnnualPaid: 'Nothing to pay — your invoice is already settled.',
};

const es = {
  errors: {
    stripeNotConfigured:
      'El pago no está disponible por ahora. Inténtelo de nuevo en unos minutos o contacte con soporte.',
    annualPriceNotConfigured:
      'La facturación anual no está disponible para este plan. Elija mensual o contáctenos.',
    monthlyPriceNotConfigured:
      'Este precio no está disponible. Actualice la página o contacte con soporte.',
    quantityTargetMustExceedCurrent:
      'El número de ubicaciones debe ser mayor que el actual.',
    stripeCustomerNotFound: 'No hay cuenta de facturación asociada a este correo.',
    noActiveSubscription: 'No detectamos una suscripción activa en esta cuenta.',
    noActiveSubscriptionUsePortal:
      'Sin suscripción activa. Abra el portal de facturación desde Ajustes.',
    invalidSubscriptionItem:
      'La suscripción no permite esta operación. Use el portal de cliente o soporte.',
    checkoutSessionCreateFailed:
      'No se pudo abrir la sesión de pago segura. Inténtelo de nuevo.',
    checkoutFailed: 'No se pudo iniciar el pago. Inténtelo de nuevo.',
    notAuthenticated: 'Inicie sesión para continuar.',
    expansionFailed: 'No se pudo confirmar el alta de ubicaciones. Inténtelo de nuevo.',
    serviceUnavailable: 'Servicio no disponible temporalmente. Inténtelo más tarde.',
    profileNotFound: 'Perfil no encontrado.',
    planInvalid: 'Plan no reconocido. Elija Vision, Pulse o Zenith.',
    updateFailed: 'La actualización no se completó. Inténtelo de nuevo.',
    premiumFallbackPlan: 'Premium',
    alreadyAnnualBilling: 'Ya está en facturación anual.',
    planNotRecognizedForSwitch: 'Plan no reconocido para este cambio.',
    portalOpenFailed: 'No se pudo abrir el portal de facturación.',
    expansionSessionCreateFailed: 'No se pudo preparar el alta de ubicaciones.',
    invalidJsonBody: 'Cuerpo JSON no válido.',
    expansionAddCountRequired: 'Indique cuántas ubicaciones añadir (1–15).',
    subscriptionInvalidPrice: 'Suscripción incompleta: precio Stripe no encontrado.',
    genericError: 'Ha ocurrido un error. Inténtelo de nuevo.',
    syncFailed: 'Error al sincronizar la cuenta. Inténtelo de nuevo.',
    webhookSecretNotConfigured: 'Webhook no configurado en el servidor.',
    webhookNoSignature: 'Solicitud webhook no válida (falta la firma).',
    webhookInvalidSignature: 'Firma webhook no válida.',
    webhookHandlerFailed: 'No se pudo procesar el evento webhook.',
  },
  plans: { vision: 'Vision', pulse: 'Pulse', zenith: 'ZENITH' },
  pricePerMonthFormatted: '{price}/mes',
  placeholders: {
    pendingEstablishmentSlot: 'Nueva ubicación pendiente',
    defaultEstablishmentLabel: 'Su establecimiento',
  },
  switchAnnualComplete: 'Cambio registrado.',
  switchAnnualPaid: 'Nada que pagar: la factura ya está saldada.',
};

const de = {
  errors: {
    stripeNotConfigured:
      'Zahlung vorübergehend nicht verfügbar. Bitte später erneut versuchen oder den Support kontaktieren.',
    annualPriceNotConfigured:
      'Jährliche Abrechnung für diesen Plan nicht verfügbar. Monatlich wählen oder kontaktieren.',
    monthlyPriceNotConfigured:
      'Preis derzeit nicht verfügbar. Seite aktualisieren oder Support kontaktieren.',
    quantityTargetMustExceedCurrent:
      'Die Zielanzahl Standorte muss höher sein als die aktuelle.',
    stripeCustomerNotFound: 'Kein Rechnungskonto mit dieser E-Mail verknüpft.',
    noActiveSubscription: 'Kein aktives Abonnement für dieses Konto gefunden.',
    noActiveSubscriptionUsePortal:
      'Kein aktives Abonnement. Öffnen Sie das Rechnungsportal in den Einstellungen.',
    invalidSubscriptionItem:
      'Aktion mit diesem Abonnement nicht möglich. Kundenportal oder Support nutzen.',
    checkoutSessionCreateFailed:
      'Sichere Checkout-Sitzung konnte nicht geöffnet werden. Erneut versuchen.',
    checkoutFailed: 'Checkout konnte nicht gestartet werden. Erneut versuchen.',
    notAuthenticated: 'Bitte anmelden, um fortzufahren.',
    expansionFailed: 'Standorterweiterung konnte nicht bestätigt werden. Erneut versuchen.',
    serviceUnavailable: 'Dienst vorübergehend nicht verfügbar. Später erneut versuchen.',
    profileNotFound: 'Profil nicht gefunden.',
    planInvalid: 'Unbekannter Plan. Vision, Pulse oder Zenith wählen.',
    updateFailed: 'Aktualisierung fehlgeschlagen. Erneut versuchen.',
    premiumFallbackPlan: 'Premium',
    alreadyAnnualBilling: 'Sie sind bereits jährlich abgerechnet.',
    planNotRecognizedForSwitch: 'Plan für diesen Wechsel nicht erkannt.',
    portalOpenFailed: 'Rechnungsportal konnte nicht geöffnet werden.',
    expansionSessionCreateFailed: 'Standorterweiterung konnte nicht vorbereitet werden.',
    invalidJsonBody: 'Ungültiger JSON-Body.',
    expansionAddCountRequired: 'Anzahl zusätzlicher Standorte angeben (1–15).',
    subscriptionInvalidPrice: 'Abonnement unvollständig: Stripe-Preis fehlt.',
    genericError: 'Etwas ist schiefgelaufen. Erneut versuchen.',
    syncFailed: 'Kontosynchronisierung fehlgeschlagen. Erneut versuchen.',
    webhookSecretNotConfigured: 'Webhook auf dem Server nicht konfiguriert.',
    webhookNoSignature: 'Ungültige Webhook-Anfrage (Signatur fehlt).',
    webhookInvalidSignature: 'Ungültige Webhook-Signatur.',
    webhookHandlerFailed: 'Webhook-Ereignis konnte nicht verarbeitet werden.',
  },
  plans: { vision: 'Vision', pulse: 'Pulse', zenith: 'ZENITH' },
  pricePerMonthFormatted: '{price}/Monat',
  placeholders: {
    pendingEstablishmentSlot: 'Neuer Standort — Einrichtung ausstehend',
    defaultEstablishmentLabel: 'Ihr Betrieb',
  },
  switchAnnualComplete: 'Änderung übernommen.',
  switchAnnualPaid: 'Keine Zahlung nötig — Rechnung bereits beglichen.',
};

const it = {
  errors: {
    stripeNotConfigured:
      'Pagamento temporaneamente non disponibile. Riprovare tra poco o contattare il supporto.',
    annualPriceNotConfigured:
      'Fatturazione annuale non disponibile per questo piano. Scegliere mensile o contattarci.',
    monthlyPriceNotConfigured:
      'Prezzo non disponibile. Aggiornare la pagina o contattare il supporto.',
    quantityTargetMustExceedCurrent:
      'Il numero di sedi deve essere superiore a quello attuale.',
    stripeCustomerNotFound: 'Nessun account di fatturazione associato a questa email.',
    noActiveSubscription: 'Nessun abbonamento attivo rilevato su questo account.',
    noActiveSubscriptionUsePortal:
      'Nessun abbonamento attivo. Aprire il portale di fatturazione dalle impostazioni.',
    invalidSubscriptionItem:
      'Operazione non consentita con questo abbonamento. Usare il portale o il supporto.',
    checkoutSessionCreateFailed:
      'Impossibile aprire la sessione di pagamento sicura. Riprovare.',
    checkoutFailed: 'Impossibile avviare il pagamento. Riprovare.',
    notAuthenticated: 'Accedi per continuare.',
    expansionFailed: 'Impossibile confermare l’aggiunta di sedi. Riprovare.',
    serviceUnavailable: 'Servizio temporaneamente non disponibile. Riprovare più tardi.',
    profileNotFound: 'Profilo non trovato.',
    planInvalid: 'Piano non riconosciuto. Scegli Vision, Pulse o Zenith.',
    updateFailed: 'Aggiornamento non riuscito. Riprovare.',
    premiumFallbackPlan: 'Premium',
    alreadyAnnualBilling: 'Sei già in fatturazione annuale.',
    planNotRecognizedForSwitch: 'Piano non riconosciuto per questo cambio.',
    portalOpenFailed: 'Impossibile aprire il portale di fatturazione.',
    expansionSessionCreateFailed: 'Impossibile preparare l’aggiunta sedi.',
    invalidJsonBody: 'Corpo JSON non valido.',
    expansionAddCountRequired: 'Indicare quante sedi aggiungere (1–15).',
    subscriptionInvalidPrice: 'Abbonamento incompleto: prezzo Stripe mancante.',
    genericError: 'Si è verificato un errore. Riprovare.',
    syncFailed: 'Sincronizzazione account non riuscita. Riprovare.',
    webhookSecretNotConfigured: 'Webhook non configurato sul server.',
    webhookNoSignature: 'Richiesta webhook non valida (firma mancante).',
    webhookInvalidSignature: 'Firma webhook non valida.',
    webhookHandlerFailed: 'Impossibile elaborare l’evento webhook.',
  },
  plans: { vision: 'Vision', pulse: 'Pulse', zenith: 'ZENITH' },
  pricePerMonthFormatted: '{price}/mese',
  placeholders: {
    pendingEstablishmentSlot: 'Nuova sede in attesa di configurazione',
    defaultEstablishmentLabel: 'La tua attività',
  },
  switchAnnualComplete: 'Aggiornamento registrato.',
  switchAnnualPaid: 'Niente da pagare: fattura già saldata.',
};

const pt = {
  errors: {
    stripeNotConfigured:
      'Pagamento temporariamente indisponível. Tente novamente em instantes ou contacte o suporte.',
    annualPriceNotConfigured:
      'Faturação anual indisponível para este plano. Escolha mensal ou contacte-nos.',
    monthlyPriceNotConfigured:
      'Preço indisponível. Atualize a página ou contacte o suporte.',
    quantityTargetMustExceedCurrent:
      'O número de unidades deve ser superior ao atual.',
    stripeCustomerNotFound: 'Nenhuma conta de faturação associada a este e-mail.',
    noActiveSubscription: 'Não detetámos uma subscrição ativa nesta conta.',
    noActiveSubscriptionUsePortal:
      'Sem subscrição ativa. Abra o portal de faturação nas definições.',
    invalidSubscriptionItem:
      'A subscrição não permite esta operação. Use o portal ou o suporte.',
    checkoutSessionCreateFailed:
      'Não foi possível abrir a sessão de pagamento segura. Tente novamente.',
    checkoutFailed: 'Não foi possível iniciar o pagamento. Tente novamente.',
    notAuthenticated: 'Inicie sessão para continuar.',
    expansionFailed: 'Não foi possível confirmar a adição de unidades. Tente novamente.',
    serviceUnavailable: 'Serviço temporariamente indisponível. Tente mais tarde.',
    profileNotFound: 'Perfil não encontrado.',
    planInvalid: 'Plano não reconhecido. Escolha Vision, Pulse ou Zenith.',
    updateFailed: 'A atualização falhou. Tente novamente.',
    premiumFallbackPlan: 'Premium',
    alreadyAnnualBilling: 'Já está em faturação anual.',
    planNotRecognizedForSwitch: 'Plano não reconhecido para esta alteração.',
    portalOpenFailed: 'Não foi possível abrir o portal de faturação.',
    expansionSessionCreateFailed: 'Não foi possível preparar a adição de unidades.',
    invalidJsonBody: 'Corpo JSON inválido.',
    expansionAddCountRequired: 'Indique quantas unidades adicionar (1–15).',
    subscriptionInvalidPrice: 'Subscrição incompleta: preço Stripe em falta.',
    genericError: 'Ocorreu um erro. Tente novamente.',
    syncFailed: 'Falha ao sincronizar a conta. Tente novamente.',
    webhookSecretNotConfigured: 'Webhook não configurado no servidor.',
    webhookNoSignature: 'Pedido webhook inválido (assinatura em falta).',
    webhookInvalidSignature: 'Assinatura webhook inválida.',
    webhookHandlerFailed: 'Não foi possível processar o evento webhook.',
  },
  plans: { vision: 'Vision', pulse: 'Pulse', zenith: 'ZENITH' },
  pricePerMonthFormatted: '{price}/mês',
  placeholders: {
    pendingEstablishmentSlot: 'Nova unidade pendente de configuração',
    defaultEstablishmentLabel: 'O seu estabelecimento',
  },
  switchAnnualComplete: 'Alteração registada.',
  switchAnnualPaid: 'Nada a pagar: a fatura já está liquidada.',
};

const ja = {
  errors: {
    stripeNotConfigured:
      'お支払いを一時的に処理できません。しばらくしてから再度お試しいただくか、サポートへご連絡ください。',
    annualPriceNotConfigured:
      'このプランでは年額請求をご利用いただけません。月額を選択するかお問い合わせください。',
    monthlyPriceNotConfigured:
      'この料金は現在ご利用いただけません。ページを更新するかサポートへご連絡ください。',
    quantityTargetMustExceedCurrent: '追加後の拠点数は現在の数より多くする必要があります。',
    stripeCustomerNotFound: 'このメールアドレスに紐づく請求アカウントが見つかりません。',
    noActiveSubscription: '有効なサブスクリプションが見つかりません。',
    noActiveSubscriptionUsePortal:
      '有効なサブスクリプションがありません。設定から請求ポータルを開いてください。',
    invalidSubscriptionItem:
      'このサブスクリプションでは操作できません。カスタマーポータルまたはサポートをご利用ください。',
    checkoutSessionCreateFailed:
      '安全な決済セッションを開けませんでした。再度お試しください。',
    checkoutFailed: '決済を開始できませんでした。再度お試しください。',
    notAuthenticated: '続行するにはログインしてください。',
    expansionFailed: '拠点の追加を確定できませんでした。再度お試しください。',
    serviceUnavailable: 'サービスが一時的に利用できません。後ほどお試しください。',
    profileNotFound: 'プロフィールが見つかりません。',
    planInvalid: 'プランが無効です。Vision、Pulse、Zenith からお選びください。',
    updateFailed: '更新に失敗しました。再度お試しください。',
    premiumFallbackPlan: 'プレミアム',
    alreadyAnnualBilling: 'すでに年額請求です。',
    planNotRecognizedForSwitch: 'この切り替えではそのプランは利用できません。',
    portalOpenFailed: '請求ポータルを開けませんでした。',
    expansionSessionCreateFailed: '拠点追加の準備に失敗しました。',
    invalidJsonBody: 'リクエストの形式が正しくありません。',
    expansionAddCountRequired: '追加する拠点数（1〜15）を指定してください。',
    subscriptionInvalidPrice: 'サブスクリプション設定に不備があります（Stripe 価格なし）。',
    genericError: 'エラーが発生しました。再度お試しください。',
    syncFailed: 'アカウントの同期に失敗しました。再度お試しください。',
    webhookSecretNotConfigured: 'サーバー側でWebhookが設定されていません。',
    webhookNoSignature: 'Webhookリクエストが無効です（署名がありません）。',
    webhookInvalidSignature: 'Webhookの署名が無効です。',
    webhookHandlerFailed: 'Webhookイベントを処理できませんでした。',
  },
  plans: { vision: 'Vision', pulse: 'Pulse', zenith: 'ZENITH' },
  pricePerMonthFormatted: '{price}/月',
  placeholders: {
    pendingEstablishmentSlot: '設定待ちの新規拠点',
    defaultEstablishmentLabel: 'ご利用の事業所',
  },
  switchAnnualComplete: '更新を反映しました。',
  switchAnnualPaid: 'お支払いは不要です（請求は完了済み）。',
};

const zh = {
  errors: {
    stripeNotConfigured:
      '支付服务暂时不可用。请稍后重试或联系顾问。',
    annualPriceNotConfigured: '该方案暂不支持年付。请选择月付或联系我们。',
    monthlyPriceNotConfigured: '该价格暂不可用。请刷新页面或联系支持。',
    quantityTargetMustExceedCurrent: '目标门店数量必须高于当前数量。',
    stripeCustomerNotFound: '此邮箱未关联账单账户。',
    noActiveSubscription: '未检测到有效订阅。',
    noActiveSubscriptionUsePortal: '无有效订阅。请在设置中打开账单门户进行管理。',
    invalidSubscriptionItem: '当前订阅无法执行此操作。请使用客户门户或联系支持。',
    checkoutSessionCreateFailed: '无法打开安全结账会话。请重试。',
    checkoutFailed: '无法启动支付。请稍后重试。',
    notAuthenticated: '请先登录。',
    expansionFailed: '无法确认新增门店。请重试或联系支持。',
    serviceUnavailable: '服务暂时不可用，请稍后再试。',
    profileNotFound: '未找到个人资料。',
    planInvalid: '方案无效。请选择 Vision、Pulse 或 Zenith。',
    updateFailed: '更新失败。请重试。',
    premiumFallbackPlan: '高级版',
    alreadyAnnualBilling: '您已处于年付计费。',
    planNotRecognizedForSwitch: '该方案不支持此切换。',
    portalOpenFailed: '无法打开账单门户。',
    expansionSessionCreateFailed: '无法准备新增门店流程。',
    invalidJsonBody: '请求体无效。',
    expansionAddCountRequired: '请填写要新增的门店数量（1–15）。',
    subscriptionInvalidPrice: '订阅配置不完整：缺少 Stripe 价格。',
    genericError: '发生错误，请重试。',
    syncFailed: '账户同步失败，请重试。',
    webhookSecretNotConfigured: '服务器未配置 Webhook。',
    webhookNoSignature: 'Webhook 请求无效（缺少签名）。',
    webhookInvalidSignature: 'Webhook 签名无效。',
    webhookHandlerFailed: '无法处理该 Webhook 事件。',
  },
  plans: { vision: 'Vision', pulse: 'Pulse', zenith: 'ZENITH' },
  pricePerMonthFormatted: '{price}/月',
  placeholders: {
    pendingEstablishmentSlot: '待配置的新门店',
    defaultEstablishmentLabel: '您的门店',
  },
  switchAnnualComplete: '已保存更改。',
  switchAnnualPaid: '无需付款：账单已结清。',
};

const PACK = { fr, en, es, de, it, pt, ja, zh };

for (const loc of locales) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Billing = PACK[loc];
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log('merged Billing ->', loc);
}
