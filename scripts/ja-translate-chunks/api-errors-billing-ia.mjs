/** Api.errors.billing + Api.errors.ia */
export const billing = {
  stripeNotConfigured: 'お支払いをご利用いただけません：Stripe の設定が不完全です。',
  planPriceEnvNotConfigured: '環境変数 {envKey} が設定されていません。',
  checkoutFailed: '決済を開始できませんでした。しばらくしてから再度お試しください。',
  checkoutParamsInvalid: '決済パラメータが無効です。',
  checkoutSessionCreateFailed:
    '安全な決済セッションを作成できませんでした。再度お試しいただくか、サポートまでご連絡ください。',
  stripeCustomerNotFoundEmail: 'このメールアドレスに紐づく Stripe アカウントが見つかりません。',
  stripeCustomerNotFound: 'Stripe アカウントが見つかりません。',
  billingAccountNotFound: '請求アカウントが見つかりません。',
  noActiveSubscription: 'このアカウントに有効なサブスクリプションは検出されませんでした。',
  noActiveSubscriptionPortalHint:
    '有効なサブスクリプションがありません。ポータルからご契約をご管理ください。',
  invalidSubscriptionItem: 'サブスクリプションが無効です（項目が見つかりません）。',
  invalidSubscriptionPrice: 'サブスクリプションが不完全です：Stripe の料金が見つかりません。',
  invalidSubscriptionNoItem: 'サブスクリプションが無効です（項目がありません）。',
  quantityTargetMustExceedCurrent: '目標数量は現在の数量より大きい必要があります。',
  expansionAddCountRequired:
    '追加する拠点数を指定してください（expansionAddCount：1〜15）。',
  bulkSessionUpdateFailed: 'サブスクリプションの更新に失敗しました。再度お試しください。',
  expansionFlowFailed: '拠点追加の準備ができませんでした。再度お試しください。',
  addEstablishmentSessionFailed: '決済セッションを作成できませんでした。再度お試しください。',
  portalOpenFailed: '請求ポータルを開けませんでした。再度お試しください。',
  expansionSessionCreateFailed: '拠点追加セッションを作成できませんでした。再度お試しください。',
  syncProfileSessionIdRequired: 'セッションID（session_id）が必要です。',
  syncProfileFailed: 'アカウントの同期に失敗しました。再度お試しください。',
  subscriptionReadFailed: 'サブスクリプションを読み取れませんでした。再度お試しください。',
  upgradePlanInvalid: 'プランが認識できません（pulse, vision, zenith のいずれかが必要です）。',
  upgradeUpdateFailed: '更新を完了できませんでした。再度お試しください。',
  previewExpansionFailed: '概算を計算できませんでした。再度お試しください。',
  switchAnnualGeneric: 'エラーが発生しました。再度お試しください。',
  annualPriceNotConfigured: 'このプランでは年払いをご用意しておりません。サポートまでご連絡ください。',
  alreadyAnnualBilling: 'すでに年払いです。',
  planNotRecognized: 'この変更に対応するプランを認識できませんでした。',
  webhookSecretNotConfigured: 'サーバー側の Webhook 設定が不完全です。',
  webhookNoSignature: 'Webhook リクエストが無効です（署名がありません）。',
  webhookInvalidSignature: 'Webhook 署名が無効です。',
  webhookHandlerFailed: 'イベントの処理が中断されました。',
  switchAnnualUpdated: '更新が完了しました。',
  switchAnnualAlreadyPaid: 'お支払い済みです。',
};

export const ia = {
  openAiNotConfigured:
    'ただいま AI サービスをご利用いただけません（サーバー側の設定）。しばらくしてから再度お試しいただくか、サポートまでご連絡ください。',
  draftTooShort: '再構成には最低3文字以上の下書きが必要です。',
  draftTooLong: 'テキストが再構成の上限を超えています。短くしてから再度お試しください。',
  modelEmptyResponse:
    'AI サービスから有効なテキストが返りませんでした。しばらくしてから再度お試しください。お客様のアカウントの不具合ではありません。',
  modelOutputInvalid:
    'モデルの応答を正しく解釈できませんでした。再度お試しください。お客様の REPUTEXA アカウントの不具合ではありません。',
  quotaOrRateLimit:
    'AI プロバイダーの一時的な上限に達したか、サービスが混雑しています。お客様の REPUTEXA アカウントの不具合ではありません。数分後に再度お試しください。',
  providerTemporaryError:
    'AI サービスを一時的にご利用いただけません。しばらくしてから再度お試しください。プロバイダー側の技術的要因であり、アプリケーションの不具合ではありません。',
};
