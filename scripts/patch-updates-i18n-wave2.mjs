/**
 * ApiAdminManualUpdate (erreurs API communiqués admin) + traductions Dashboard.adminUpdatesForm
 * pour en, es, de, it, pt, ja, zh (fr inchangé pour adminUpdatesForm si déjà FR).
 * node scripts/patch-updates-i18n-wave2.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'messages');
const LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];

const API_MANUAL = {
  fr: {
    invalidPublishAt: 'Date/heure de publication invalides.',
    publishInPast: 'La date de publication est dans le passé.',
    scheduleInvalid: 'Date/heure de planification invalide.',
    scheduleTooSoon: 'Choisissez une heure au moins ~30 secondes dans le futur.',
    scheduleTooFar: 'Planification trop lointaine (max. ~12 mois).',
    attachmentsInvalid:
      'Pièces jointes invalides (URL http(s) et type image ou vidéo par entrée).',
    titleAndContentRequired: 'Titre et contenu sont requis.',
    patchIdTitleContentRequired: 'id, titre et contenu sont requis.',
    deleteIdMissing: 'ID manquant.',
  },
  en: {
    invalidPublishAt: 'Invalid publish date or time.',
    publishInPast: 'The publish date is in the past.',
    scheduleInvalid: 'Invalid scheduled date or time.',
    scheduleTooSoon: 'Pick a time at least ~30 seconds in the future.',
    scheduleTooFar: 'Scheduled time is too far ahead (max. ~12 months).',
    attachmentsInvalid: 'Invalid attachments (each entry needs an http(s) URL and type image or video).',
    titleAndContentRequired: 'Title and content are required.',
    patchIdTitleContentRequired: 'id, title, and content are required.',
    deleteIdMissing: 'Missing id.',
  },
  es: {
    invalidPublishAt: 'Fecha u hora de publicación no válidas.',
    publishInPast: 'La fecha de publicación está en el pasado.',
    scheduleInvalid: 'Fecha u hora programada no válida.',
    scheduleTooSoon: 'Elija una hora al menos ~30 segundos en el futuro.',
    scheduleTooFar: 'La programación es demasiado lejana (máx. ~12 meses).',
    attachmentsInvalid:
      'Adjuntos no válidos (cada entrada necesita URL http(s) y tipo imagen o vídeo).',
    titleAndContentRequired: 'El título y el contenido son obligatorios.',
    patchIdTitleContentRequired: 'Se requieren id, título y contenido.',
    deleteIdMissing: 'Falta el id.',
  },
  de: {
    invalidPublishAt: 'Ungültiges Veröffentlichungsdatum oder -uhrzeit.',
    publishInPast: 'Das Veröffentlichungsdatum liegt in der Vergangenheit.',
    scheduleInvalid: 'Ungültiges geplantes Datum oder Uhrzeit.',
    scheduleTooSoon: 'Wählen Sie eine Zeit mindestens ~30 Sekunden in der Zukunft.',
    scheduleTooFar: 'Zeitpunkt zu weit in der Zukunft (max. ~12 Monate).',
    attachmentsInvalid:
      'Ungültige Anhänge (jeder Eintrag: http(s)-URL und Typ Bild oder Video).',
    titleAndContentRequired: 'Titel und Inhalt sind erforderlich.',
    patchIdTitleContentRequired: 'id, Titel und Inhalt sind erforderlich.',
    deleteIdMissing: 'Fehlende ID.',
  },
  it: {
    invalidPublishAt: 'Data o ora di pubblicazione non valide.',
    publishInPast: 'La data di pubblicazione è nel passato.',
    scheduleInvalid: 'Data o ora pianificata non valida.',
    scheduleTooSoon: 'Scegli un orario almeno ~30 secondi nel futuro.',
    scheduleTooFar: 'Data troppo lontana (max. ~12 mesi).',
    attachmentsInvalid:
      'Allegati non validi (ogni voce: URL http(s) e tipo immagine o video).',
    titleAndContentRequired: 'Titolo e contenuto sono obbligatori.',
    patchIdTitleContentRequired: 'Sono richiesti id, titolo e contenuto.',
    deleteIdMissing: 'ID mancante.',
  },
  pt: {
    invalidPublishAt: 'Data ou hora de publicação inválida.',
    publishInPast: 'A data de publicação está no passado.',
    scheduleInvalid: 'Data ou hora agendada inválida.',
    scheduleTooSoon: 'Escolha uma hora pelo menos ~30 segundos no futuro.',
    scheduleTooFar: 'Agendamento demasiado distante (máx. ~12 meses).',
    attachmentsInvalid:
      'Anexos inválidos (cada entrada: URL http(s) e tipo imagem ou vídeo).',
    titleAndContentRequired: 'O título e o conteúdo são obrigatórios.',
    patchIdTitleContentRequired: 'São necessários id, título e conteúdo.',
    deleteIdMissing: 'ID em falta.',
  },
  ja: {
    invalidPublishAt: '公開日時が無効です。',
    publishInPast: '公開日時が過去になっています。',
    scheduleInvalid: '予約日時が無効です。',
    scheduleTooSoon: '少なくとも約30秒先の日時を選んでください。',
    scheduleTooFar: '予約が遠すぎます（最大約12か月）。',
    attachmentsInvalid:
      '添付が無効です（各項目は http(s) URL と画像または動画タイプ）。',
    titleAndContentRequired: 'タイトルと本文は必須です。',
    patchIdTitleContentRequired: 'id・タイトル・本文が必要です。',
    deleteIdMissing: 'ID がありません。',
  },
  zh: {
    invalidPublishAt: '发布日期或时间无效。',
    publishInPast: '发布日期在过去。',
    scheduleInvalid: '计划的日期或时间无效。',
    scheduleTooSoon: '请选择至少约 30 秒之后的时间。',
    scheduleTooFar: '计划时间过远（最多约 12 个月）。',
    attachmentsInvalid: '附件无效（每项需要 http(s) 链接和 image 或 video 类型）。',
    titleAndContentRequired: '标题和正文为必填项。',
    patchIdTitleContentRequired: '需要 id、标题和正文。',
    deleteIdMissing: '缺少 ID。',
  },
};

/** Formulaire admin — remplace les chaînes encore en FR dans en/es/… */
const ADMIN_FORM = {
  en: {
    toastMediaError: 'Could not upload the media.',
    toastSublimeOk: 'Content refined by AI!',
    toastSublimeError: 'AI generation failed.',
    toastTitleOrNotes: 'Enter at least a title or rough notes.',
    toastTitleRequired: 'Title is required.',
    toastContentRequired: 'Content is required — use “Refine with AI” or write manually.',
    toastSchedulePick: 'Pick a publish date and time.',
    toastScheduleInvalid: 'Invalid date or time.',
    toastScheduledFor: 'Update scheduled for {when} (your browser time zone).',
    toastPublished: 'Update published!',
    heading: 'Create a manual update',
    fieldTitle: 'Update title',
    titlePlaceholder: 'E.g. New weekly reporting feature…',
    rawNotesPlaceholder:
      'Rough ideas, bullets, technical notes… AI will turn them into a polished changelog.',
    aiHint:
      'The server cross-checks your title and notes with a snippet from the repo (recent commits, changed files, CHANGELOG) for sharper wording — it does not replace your review.',
    labelSublimed: 'Refined',
    contentPlaceholder: 'Refined content appears here — edit before publishing.',
    charCount: '{count} characters',
    mediaHeading: 'Images or videos',
    mediaHint: 'Image or video files — admin use only.',
    addMedia: 'Add media',
    addMediaUploading: 'Uploading…',
    video: 'Video',
    removeMediaAria: 'Remove media',
    scheduleHelp:
      'By default the post is visible immediately to signed-in users. In scheduled mode, the date/time is interpreted in this browser’s time zone (converted to UTC on the server). Bounds: at least ~30s in the future, max ~12 months — same as scheduled email sends, unrelated to the 30-day legal notice.',
    publishNow: 'Publish now',
    publishScheduled: 'Schedule for later',
    ctaSchedule: 'Schedule update',
    ctaPublish: 'Publish update',
    subtitle: 'Only visible to you · AI refinement available',
    adminBadge: 'Admin',
    fieldRawNotes: 'Rough notes',
    optional: '(optional)',
    sublimeRunning: 'Refining…',
    sublimeCta: 'Refine with AI',
    contentLabel: 'Final changelog content',
    filesCount: '{count} file(s)',
    scheduleTitle: 'Publish schedule',
    scheduleRadioLater: 'Schedule date & time',
    publishSending: 'Sending…',
    toastPublishError: 'Could not publish.',
    scheduleHelpHtml:
      'By default the post is visible immediately to signed-in users. In scheduled mode, the time follows this browser’s <strong class="text-slate-600 dark:text-zinc-400">time zone</strong> (stored as UTC on the server). Bounds: at least ~30&nbsp;s in the future, max ~12 months — like scheduled email, unrelated to the 30-day legal notice.',
  },
  es: {
    toastMediaError: 'No se pudo subir el medio.',
    toastSublimeOk: '¡Contenido pulido por IA!',
    toastSublimeError: 'Error al generar con IA.',
    toastTitleOrNotes: 'Indica al menos un título o notas.',
    toastTitleRequired: 'El título es obligatorio.',
    toastContentRequired:
      'El contenido es obligatorio: usa «Pulir con IA» o redáctalo a mano.',
    toastSchedulePick: 'Elige fecha y hora de publicación.',
    toastScheduleInvalid: 'Fecha u hora no válida.',
    toastScheduledFor: 'Actualización programada para {when} (zona horaria del navegador).',
    toastPublished: '¡Actualización publicada!',
    heading: 'Crear una actualización manual',
    fieldTitle: 'Título de la actualización',
    titlePlaceholder: 'Ej.: Nueva función de informe semanal…',
    rawNotesPlaceholder:
      'Ideas en bruto, viñetas, notas técnicas… La IA las convertirá en un changelog elegante.',
    aiHint:
      'El servidor cruza tu título y notas con un extracto del repositorio (commits, archivos, CHANGELOG) para un texto más preciso; no sustituye tu revisión.',
    labelSublimed: 'Pulido',
    contentPlaceholder: 'El contenido refinado aparece aquí; edítalo antes de publicar.',
    charCount: '{count} caracteres',
    mediaHeading: 'Imágenes o vídeos',
    mediaHint: 'Solo uso admin.',
    addMedia: 'Añadir medios',
    addMediaUploading: 'Subiendo…',
    video: 'Vídeo',
    removeMediaAria: 'Quitar medio',
    scheduleHelp:
      'Por defecto el comunicado es visible al instante. En modo programado, la fecha/hora es la del navegador (UTC en servidor). Límites: ≥ ~30 s en el futuro, máx. ~12 meses.',
    publishNow: 'Publicar ahora',
    publishScheduled: 'Programar',
    ctaSchedule: 'Programar actualización',
    ctaPublish: 'Publicar actualización',
    subtitle: 'Solo tú lo ves · IA disponible',
    adminBadge: 'Admin',
    fieldRawNotes: 'Notas en bruto',
    optional: '(opcional)',
    sublimeRunning: 'Pulido en curso…',
    sublimeCta: 'Pulir con IA',
    contentLabel: 'Contenido final del changelog',
    filesCount: '{count} archivo(s)',
    scheduleTitle: 'Calendario de publicación',
    scheduleRadioLater: 'Programar fecha y hora',
    publishSending: 'Enviando…',
    toastPublishError: 'Error al publicar.',
    scheduleHelpHtml:
      'Por defecto el comunicado es visible al instante. Programado: la hora sigue la <strong class="text-slate-600 dark:text-zinc-400">zona horaria de este navegador</strong> (UTC en servidor). Límites: ≥ ~30&nbsp;s, máx. ~12 meses.',
  },
  de: {
    toastMediaError: 'Medien konnten nicht hochgeladen werden.',
    toastSublimeOk: 'Inhalt von KI verfeinert!',
    toastSublimeError: 'KI-Generierung fehlgeschlagen.',
    toastTitleOrNotes: 'Bitte mindestens einen Titel oder Notizen angeben.',
    toastTitleRequired: 'Der Titel ist erforderlich.',
    toastContentRequired:
      'Inhalt erforderlich — „Mit KI verfeinern“ nutzen oder manuell schreiben.',
    toastSchedulePick: 'Bitte Datum und Uhrzeit wählen.',
    toastScheduleInvalid: 'Ungültiges Datum oder Uhrzeit.',
    toastScheduledFor: 'Update geplant für {when} (Zeitzone des Browsers).',
    toastPublished: 'Update veröffentlicht!',
    heading: 'Manuelles Update erstellen',
    fieldTitle: 'Titel des Updates',
    titlePlaceholder: 'z. B. Neue Wochenbericht-Funktion…',
    rawNotesPlaceholder:
      'Stichpunkte, technische Notizen … Die KI formuliert daraus ein Changelog.',
    aiHint:
      'Der Server kombiniert Titel und Notizen mit einem Repo-Ausschnitt (Commits, Dateien, CHANGELOG) — ersetzt keine manuelle Prüfung.',
    labelSublimed: 'Verfeinert',
    contentPlaceholder: 'Verfeinerter Text erscheint hier — vor dem Veröffentlichen bearbeiten.',
    charCount: '{count} Zeichen',
    mediaHeading: 'Bilder oder Videos',
    mediaHint: 'Nur für Admins.',
    addMedia: 'Medien hinzufügen',
    addMediaUploading: 'Wird hochgeladen…',
    video: 'Video',
    removeMediaAria: 'Medium entfernen',
    scheduleHelp:
      'Standard: sofort sichtbar. Geplant: Browser-Zeitzone, Server speichert UTC. Grenzen: ≥ ~30 s, max. ~12 Monate.',
    publishNow: 'Sofort veröffentlichen',
    publishScheduled: 'Später planen',
    ctaSchedule: 'Update planen',
    ctaPublish: 'Update veröffentlichen',
    subtitle: 'Nur für Sie sichtbar · KI-Verfeinerung',
    adminBadge: 'Admin',
    fieldRawNotes: 'Rohe Notizen',
    optional: '(optional)',
    sublimeRunning: 'Wird verfeinert…',
    sublimeCta: 'Mit KI verfeinern',
    contentLabel: 'Finales Changelog',
    filesCount: '{count} Datei(en)',
    scheduleTitle: 'Veröffentlichungsplan',
    scheduleRadioLater: 'Datum & Uhrzeit planen',
    publishSending: 'Wird gesendet…',
    toastPublishError: 'Veröffentlichung fehlgeschlagen.',
    scheduleHelpHtml:
      'Standard: sofort sichtbar. Geplant: <strong class="text-slate-600 dark:text-zinc-400">Zeitzone dieses Browsers</strong>, UTC auf dem Server. Grenzen: ≥ ~30&nbsp;s, max. ~12 Monate.',
  },
  it: {
    toastMediaError: 'Impossibile caricare il media.',
    toastSublimeOk: 'Contenuto rifinito dall’IA!',
    toastSublimeError: 'Generazione IA non riuscita.',
    toastTitleOrNotes: 'Inserisci almeno un titolo o delle note.',
    toastTitleRequired: 'Il titolo è obbligatorio.',
    toastContentRequired:
      'Il contenuto è obbligatorio — usa «Rifinisci con IA» o scrivi manualmente.',
    toastSchedulePick: 'Scegli data e ora di pubblicazione.',
    toastScheduleInvalid: 'Data o ora non valida.',
    toastScheduledFor: 'Aggiornamento programmato per {when} (fuso del browser).',
    toastPublished: 'Aggiornamento pubblicato!',
    heading: 'Crea un aggiornamento manuale',
    fieldTitle: 'Titolo dell’aggiornamento',
    titlePlaceholder: 'Es.: Nuova funzione di report settimanale…',
    rawNotesPlaceholder:
      'Appunti grezzi, elenco punti, dettagli tecnici… L’IA li trasformerà in changelog.',
    aiHint:
      'Il server incrocia titolo e note con un estratto del repo (commit, file, CHANGELOG) — non sostituisce la tua revisione.',
    labelSublimed: 'Rifinito',
    contentPlaceholder: 'Il testo rifinito compare qui — modifica prima di pubblicare.',
    charCount: '{count} caratteri',
    mediaHeading: 'Immagini o video',
    mediaHint: 'Solo per admin.',
    addMedia: 'Aggiungi media',
    addMediaUploading: 'Caricamento…',
    video: 'Video',
    removeMediaAria: 'Rimuovi media',
    scheduleHelp:
      'Predefinito: subito visibile. Programmato: fuso del browser, UTC sul server. Limiti: ≥ ~30 s, max ~12 mesi.',
    publishNow: 'Pubblica ora',
    publishScheduled: 'Programma',
    ctaSchedule: 'Programma aggiornamento',
    ctaPublish: 'Pubblica aggiornamento',
    subtitle: 'Visibile solo a te · IA disponibile',
    adminBadge: 'Admin',
    fieldRawNotes: 'Note grezze',
    optional: '(opzionale)',
    sublimeRunning: 'Rifinitura…',
    sublimeCta: 'Rifinisci con IA',
    contentLabel: 'Contenuto finale del changelog',
    filesCount: '{count} file',
    scheduleTitle: 'Calendario di pubblicazione',
    scheduleRadioLater: 'Programma data e ora',
    publishSending: 'Invio…',
    toastPublishError: 'Pubblicazione non riuscita.',
    scheduleHelpHtml:
      'Predefinito: subito visibile. Programmato: <strong class="text-slate-600 dark:text-zinc-400">fuso orario del browser</strong>, UTC sul server. Limiti: ≥ ~30&nbsp;s, max ~12 mesi.',
  },
  pt: {
    toastMediaError: 'Não foi possível enviar o média.',
    toastSublimeOk: 'Conteúdo refinado pela IA!',
    toastSublimeError: 'Falha na geração por IA.',
    toastTitleOrNotes: 'Indique pelo menos um título ou notas.',
    toastTitleRequired: 'O título é obrigatório.',
    toastContentRequired:
      'O conteúdo é obrigatório — use «Refinar com IA» ou escreva manualmente.',
    toastSchedulePick: 'Escolha data e hora de publicação.',
    toastScheduleInvalid: 'Data ou hora inválida.',
    toastScheduledFor: 'Atualização agendada para {when} (fuso do navegador).',
    toastPublished: 'Atualização publicada!',
    heading: 'Criar uma atualização manual',
    fieldTitle: 'Título da atualização',
    titlePlaceholder: 'Ex.: Nova funcionalidade de relatório semanal…',
    rawNotesPlaceholder:
      'Notas brutas, tópicos, detalhes técnicos… A IA transformará em changelog.',
    aiHint:
      'O servidor cruza título e notas com um excerto do repositório — não substitui a sua revisão.',
    labelSublimed: 'Refinado',
    contentPlaceholder: 'O texto refinado aparece aqui — edite antes de publicar.',
    charCount: '{count} caracteres',
    mediaHeading: 'Imagens ou vídeos',
    mediaHint: 'Apenas admin.',
    addMedia: 'Adicionar média',
    addMediaUploading: 'A enviar…',
    video: 'Vídeo',
    removeMediaAria: 'Remover média',
    scheduleHelp:
      'Por defeito visível de imediato. Agendado: fuso do navegador, UTC no servidor. Limites: ≥ ~30 s, máx. ~12 meses.',
    publishNow: 'Publicar agora',
    publishScheduled: 'Agendar',
    ctaSchedule: 'Agendar atualização',
    ctaPublish: 'Publicar atualização',
    subtitle: 'Só você vê · IA disponível',
    adminBadge: 'Admin',
    fieldRawNotes: 'Notas brutas',
    optional: '(opcional)',
    sublimeRunning: 'A refinar…',
    sublimeCta: 'Refinar com IA',
    contentLabel: 'Conteúdo final do changelog',
    filesCount: '{count} ficheiro(s)',
    scheduleTitle: 'Calendário de publicação',
    scheduleRadioLater: 'Agendar data e hora',
    publishSending: 'A enviar…',
    toastPublishError: 'Falha ao publicar.',
    scheduleHelpHtml:
      'Por defeito visível de imediato. Agendado: <strong class="text-slate-600 dark:text-zinc-400">fuso deste navegador</strong>, UTC no servidor. Limites: ≥ ~30&nbsp;s, máx. ~12 meses.',
  },
  ja: {
    toastMediaError: 'メディアをアップロードできませんでした。',
    toastSublimeOk: 'AI が文章を整えました！',
    toastSublimeError: 'AI の生成に失敗しました。',
    toastTitleOrNotes: 'タイトルまたはメモのどちらかを入力してください。',
    toastTitleRequired: 'タイトルは必須です。',
    toastContentRequired:
      '本文は必須です。「AI で整える」か手入力してください。',
    toastSchedulePick: '公開日時を選んでください。',
    toastScheduleInvalid: '日時が無効です。',
    toastScheduledFor: '{when} に公開予約しました（ブラウザのタイムゾーン）。',
    toastPublished: '公開しました！',
    heading: '手動でアップデートを作成',
    fieldTitle: 'アップデートのタイトル',
    titlePlaceholder: '例：週次レポートの新機能…',
    rawNotesPlaceholder:
      '箇条書きや技術メモなど。AI がチェンジログ風に整えます。',
    aiHint:
      'サーバーがタイトル・メモとリポジトリ情報（コミット等）を照合します。最終確認はあなたが行ってください。',
    labelSublimed: '整形済み',
    contentPlaceholder: '整形された本文がここに表示されます。公開前に編集できます。',
    charCount: '{count} 文字',
    mediaHeading: '画像または動画',
    mediaHint: '管理者向け。',
    addMedia: 'メディアを追加',
    addMediaUploading: '送信中…',
    video: '動画',
    removeMediaAria: 'メディアを削除',
    scheduleHelp:
      '既定は即時公開。予約はブラウザのタイムゾーン（サーバーでは UTC）。約30秒〜約12か月以内。',
    publishNow: '今すぐ公開',
    publishScheduled: '日時を指定',
    ctaSchedule: '予約する',
    ctaPublish: '公開する',
    subtitle: '自分だけが表示 · AI で整形可能',
    adminBadge: '管理者',
    fieldRawNotes: '下書きメモ',
    optional: '（任意）',
    sublimeRunning: '整形中…',
    sublimeCta: 'AI で整える',
    contentLabel: '最終的なチェンジログ本文',
    filesCount: '{count} 件のファイル',
    scheduleTitle: '公開スケジュール',
    scheduleRadioLater: '日付と時刻を指定',
    publishSending: '送信中…',
    toastPublishError: '公開に失敗しました。',
    scheduleHelpHtml:
      '既定は即時公開。予約はこのブラウザの<strong class="text-slate-600 dark:text-zinc-400">タイムゾーン</strong>（サーバーでは UTC）。約30&nbsp;秒〜約12か月以内。',
  },
  zh: {
    toastMediaError: '无法上传媒体。',
    toastSublimeOk: '已由 AI 润色内容！',
    toastSublimeError: 'AI 生成失败。',
    toastTitleOrNotes: '请至少填写标题或草稿要点。',
    toastTitleRequired: '标题为必填项。',
    toastContentRequired: '正文为必填项 — 请使用「AI 润色」或手动撰写。',
    toastSchedulePick: '请选择发布日期和时间。',
    toastScheduleInvalid: '日期或时间无效。',
    toastScheduledFor: '已计划在 {when} 发布（浏览器时区）。',
    toastPublished: '已发布！',
    heading: '创建手动更新',
    fieldTitle: '更新标题',
    titlePlaceholder: '例如：新的周报功能…',
    rawNotesPlaceholder: '草稿要点、项目符号、技术说明… AI 将润色为更新公告。',
    aiHint: '服务器会将标题与草稿同仓库摘要（提交、文件、CHANGELOG）交叉核对 — 仍需您亲自审阅。',
    labelSublimed: '已润色',
    contentPlaceholder: '润色后的正文显示在此 — 发布前可编辑。',
    charCount: '{count} 个字符',
    mediaHeading: '图片或视频',
    mediaHint: '仅供管理员使用。',
    addMedia: '添加媒体',
    addMediaUploading: '上传中…',
    video: '视频',
    removeMediaAria: '移除媒体',
    scheduleHelp:
      '默认立即对所有登录用户可见。计划发布使用浏览器时区（服务器存 UTC）。约 30 秒至约 12 个月内。',
    publishNow: '立即发布',
    publishScheduled: '稍后计划',
    ctaSchedule: '计划更新',
    ctaPublish: '发布更新',
    subtitle: '仅您可见 · 支持 AI 润色',
    adminBadge: '管理员',
    fieldRawNotes: '草稿要点',
    optional: '（可选）',
    sublimeRunning: '润色中…',
    sublimeCta: '用 AI 润色',
    contentLabel: '最终更新公告正文',
    filesCount: '{count} 个文件',
    scheduleTitle: '发布时间',
    scheduleRadioLater: '计划日期与时间',
    publishSending: '发送中…',
    toastPublishError: '发布失败。',
    scheduleHelpHtml:
      '默认立即可见。计划模式使用此浏览器的<strong class="text-slate-600 dark:text-zinc-400">时区</strong>（服务器为 UTC）。约 30&nbsp;秒至约 12 个月。',
  },
};

for (const loc of LOCALES) {
  const p = path.join(dir, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.ApiAdminManualUpdate = { ...(j.ApiAdminManualUpdate ?? {}), ...API_MANUAL[loc] };
  if (loc !== 'fr' && ADMIN_FORM[loc]) {
    j.Dashboard = j.Dashboard ?? {};
    j.Dashboard.adminUpdatesForm = {
      ...(j.Dashboard.adminUpdatesForm ?? {}),
      ...ADMIN_FORM[loc],
    };
  }
  fs.writeFileSync(p, JSON.stringify(j));
}

// ApiAdmin clés critiques pour les locales non-FR (évite toasts API en français)
const API_ADMIN_FIX = {
  en: {
    unauthorized: 'Unauthorized.',
    forbidden: 'Access denied.',
    titleOrNotesRequired: 'Title or notes required.',
    aiGenerationError: 'AI error. Check ANTHROPIC_API_KEY.',
  },
  es: {
    unauthorized: 'No autorizado.',
    forbidden: 'Acceso denegado.',
    titleOrNotesRequired: 'Se requiere título o notas.',
    aiGenerationError: 'Error de IA. Compruebe ANTHROPIC_API_KEY.',
  },
  de: {
    unauthorized: 'Nicht angemeldet.',
    forbidden: 'Zugriff verweigert.',
    titleOrNotesRequired: 'Titel oder Notizen erforderlich.',
    aiGenerationError: 'KI-Fehler. Prüfen Sie ANTHROPIC_API_KEY.',
  },
  it: {
    unauthorized: 'Non autorizzato.',
    forbidden: 'Accesso negato.',
    titleOrNotesRequired: 'Titolo o note obbligatori.',
    aiGenerationError: 'Errore IA. Verificare ANTHROPIC_API_KEY.',
  },
  pt: {
    unauthorized: 'Não autorizado.',
    forbidden: 'Acesso negado.',
    titleOrNotesRequired: 'Título ou notas obrigatórios.',
    aiGenerationError: 'Erro de IA. Verifique ANTHROPIC_API_KEY.',
  },
  ja: {
    unauthorized: '未認証です。',
    forbidden: 'アクセスが拒否されました。',
    titleOrNotesRequired: 'タイトルまたはメモが必要です。',
    aiGenerationError: 'AI エラー。ANTHROPIC_API_KEY を確認してください。',
  },
  zh: {
    unauthorized: '未授权。',
    forbidden: '拒绝访问。',
    titleOrNotesRequired: '需要标题或草稿要点。',
    aiGenerationError: 'AI 错误。请检查 ANTHROPIC_API_KEY。',
  },
};

for (const loc of Object.keys(API_ADMIN_FIX)) {
  const p = path.join(dir, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.ApiAdmin = { ...(j.ApiAdmin ?? {}), ...API_ADMIN_FIX[loc] };
  fs.writeFileSync(p, JSON.stringify(j));
}

console.log('Patched ApiAdminManualUpdate, adminUpdatesForm, ApiAdmin (critical keys).');
