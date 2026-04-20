/** Api.errors — partie 2 */
export const errorsMainPart2 = {
  google_tokenUnavailable: 'Googleトークンを利用できません。接続をやり直してください。',
  google_accountsAccessFailed:
    'Google Business にアクセスできません。プロフィール設定をご確認ください。',
  google_noBusinessAccount:
    'Google Business アカウントが見つかりません。Google でプロフィールを作成してください。',
  google_accountFormatInvalid: 'アカウント形式が無効です。',
  google_locationsFetchFailed: 'Google の拠点一覧を取得できませんでした。',
  google_noLocation: '店舗が見つかりません。Googleのプロフィールに場所を追加してください。',
  googleImportedLocationTitle: '店舗',
  google_test_noProviderToken:
    'Googleトークンがありません。設定の「プラットフォーム連携」から Google を接続し、business.manage スコープと prompt=consent を指定してください。',
  google_test_accountsApiError: 'Google Accounts API エラーです。',
  google_test_locationsApiError: 'Google Locations API エラーです。',
  google_test_noAccountsMessage:
    'このアカウントに紐づく Google Business アカウントが見つかりません。',
  google_list_reconnectHint: '拠点を取り込むには、設定から Google 連携を再度実行してください。',
  google_list_tokenExpiredHint:
    'Googleトークンの有効期限が切れました。設定から Google を再接続してください。',
  google_list_locationsListFailedHint: 'Google の拠点一覧を取得できませんでした。',
  shield_aiKeysMissing:
    'AI用のAPIキーが設定されていません。ANTHROPIC_API_KEY または OPENAI_API_KEY をご確認ください。',
  shield_invalidAiResponse: 'AIの応答が無効です。再度お試しください。',
  shield_analysisFailed: '分析に失敗しました。',
  ai_reviewRequired: '口コミが必要です。',
  ai_planFeatureNotIncluded: 'このプランではご利用いただけません。',
  ai_pulseZenithWeeklyInsight: 'Pulse／Zenith 専用の機能です。',
  ai_weeklyInsightFailed: 'AI分析に失敗しました。',
  ai_subscriptionRequired: 'サブスクリプションが必要です。',
  transcriptRequired: '文字起こし結果がありません。',
  reportIssue_invalidPayload: 'データが無効です。',
  reportIssue_allFieldsRequired: '必須項目をすべて入力してください。',
  reportIssue_emailSendFailed:
    '送信に失敗しました。再試行するか、{supportEmail} までご連絡ください。',
  reportIssue_genericError: 'エラーが発生しました。',
  monthly_yearMonthRequired: '有効な年と月を指定してください（例：?year=2026&month=3）。',
  monthly_reportNotFound: 'レポートが見つかりません。',
  monthly_pdfNotReady: 'PDFはまだ利用できません。',
  monthly_downloadFailed: 'ダウンロードに失敗しました。',
  monthly_listFailed: '一覧を読み込めませんでした。',
  monthly_storageFileNotFound: 'ストレージにファイルが見つかりません。',
  notifyWhatsapp_planPulseRequired:
    'ネガティブな口コミのWhatsApp通知はPulseプラン以降で利用できます。PulseまたはZenithにアップグレードして有効にしてください。',
  notifyWhatsapp_phoneNotConfigured:
    'WhatsApp番号が未設定です。設定で番号を登録すると口コミ通知を受け取れます。',
  monthly_eliteReportPlanRequired:
    '月次PDFレポートは現在のプランに含まれていません。PDFレポート付きのプランに変更するか、サブスクリプションをご確認ください。',
  suggestionTitleRequired: 'タイトルが必要です。',
  whisperNotConfigured: 'Whisper が設定されていません。',
  appSuggestion_photoUploadFailed: '写真のアップロード中にエラーが発生しました。',
  appSuggestion_notFound: '提案が見つかりません。',
  appSuggestion_idMissing: 'IDがありません。',
  appSuggestion_titleMissing: 'タイトルがありません。',
  stripe_planInvalidUpgrade: 'プランが無効です（pulse, vision, zenith のいずれかが必要です）。',
  stripe_webhookSecretNotConfigured: 'Webhookシークレットが設定されていません。',
  stripe_webhookNoSignature: '署名がありません。',
  stripe_webhookInvalidSignature: '署名が無効です。',
  reputexaTeam_rateLimited: 'リクエストが多すぎます。しばらくしてから再度お試しください。',
  reputexaTeam_notFound: '見つかりません。',
  reputexaTeam_unavailable: 'ただいまサービスをご利用いただけません。',
  zenithCapture_invalidJson: 'JSON本文が無効です。',
  zenithCapture_cronUserIdRequired: 'cron 呼び出しには userId が必要です。',
  zenithCapture_planZenithRequired: 'Zenithプランが必要です。',
  zenithCapture_phoneRequired: '電話番号が必要です。',
  zenithCapture_supabaseConfig: 'Supabase の設定がありません。',
  zenithCapture_sendFailed: '送信に失敗しました。',
  noChangesToSave: '変更がありません。',
  establishmentNotFound: '拠点が見つかりません。',
  establishment_quotaReached: '上限に達しました。プランをアップグレードしてください。',
  establishment_addViaStripeOnly:
    '拠点を追加するには、ダッシュボードからサブスクリプションをアップグレードしてください（Stripe決済）。',
  support_ticketStatusOrTitleRequired: 'ステータスまたはタイトルを指定してください。',
  supabase_invalidReviewAction: '操作が無効です。',
  supabase_responseTextRequiredForEdit: '編集には返信テキストが必要です。',
  generateOptions_subscriptionCanceled:
    'サブスクリプションは解約済みです。過去の口コミは閲覧できますが、AI返信の生成は無効です。',
  generateOptions_paymentOverdueGrace:
    'お支払いが3日以上保留されています。AI返信を使い続けるにはお支払いを完了してください。',
  generateOptions_paymentPending:
    'お支払いが保留されています。AI返信を使い続けるにはお支払い方法を更新してください。',
  shieldReportDossierMissing:
    'AIシールドが案件（有害／通報対象の口コミ）を準備したときにこのボタンを使用してください。「アラート」タブをご確認ください。',
  supportTicketArchived: 'このチケットはアーカイブ済みです。新しいチケットを作成してください。',
  profile_generateTokenFailed: '生成中にエラーが発生しました。',
  profile_acceptLegalVersionInvalid: 'バージョンが無効です。',
  legal_noPublishedVersion: '現在有効な法的文書のバージョンがありません。',
  legal_versionChangedRefresh: 'バージョンが更新されました。ページを再読み込みしてください。',
  legal_noPublishedVersionServer: '現在有効な公開済み法的文書がありません。',
};
