/**
 * One-shot merge: adds Dashboard.alertsPage to messages/*.json
 * Run: node scripts/merge-dashboard-alerts-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const legal = {
  fr: `Objet : Demande de suppression d'avis non conforme

Madame, Monsieur,

Nous avons constaté la présence sur votre plateforme d'un avis publié par {reviewerName}, qui ne respecte pas vos conditions d'utilisation en vigueur.

Cet avis contient des propos haineux, diffamatoires et/ou manifestement faux, portant gravement atteinte à notre réputation professionnelle et à l'intégrité de notre établissement.

En vertu de votre politique de contenu et du droit applicable, nous vous demandons de procéder à la suppression immédiate de cet avis dans les meilleurs délais.

Nous restons à votre disposition pour tout renseignement complémentaire.

Cordialement,
L'équipe REPUTEXA Shield`,
  en: `Subject: Request to remove a non-compliant review

Dear Sir or Madam,

We have found on your platform a review published by {reviewerName} that does not comply with your current terms of use.

This review contains hateful, defamatory and/or manifestly false statements that seriously harm our professional reputation and the integrity of our business.

Under your content policy and applicable law, we ask you to remove this review immediately at your earliest convenience.

We remain available for any further information.

Kind regards,
The REPUTEXA Shield team`,
  es: `Asunto: Solicitud de eliminación de una reseña no conforme

Estimados señores,

Hemos constatado en su plataforma una reseña publicada por {reviewerName} que no cumple sus condiciones de uso vigentes.

Esta reseña contiene expresiones de odio, difamatorias y/o manifiestamente falsas que perjudican gravemente nuestra reputación profesional y la integridad de nuestro establecimiento.

De conformidad con su política de contenidos y la legislación aplicable, le solicitamos proceder a la eliminación inmediata de esta reseña a la mayor brevedad.

Quedamos a su disposición para cualquier información adicional.

Atentamente,
El equipo REPUTEXA Shield`,
  de: `Betreff: Antrag auf Entfernung einer nicht konformen Bewertung

Sehr geehrte Damen und Herren,

auf Ihrer Plattform ist eine Bewertung von {reviewerName} veröffentlicht worden, die Ihren geltenden Nutzungsbedingungen nicht entspricht.

Diese Bewertung enthält hasserfüllende, diffamierende und/oder offensichtlich unwahre Aussagen, die unserem beruflichen Ansehen und der Integrität unseres Betriebs erheblich schaden.

Gemäß Ihrer Inhaltsrichtlinie und dem anwendbaren Recht bitten wir Sie, diese Bewertung unverzüglich zu entfernen.

Für Rückfragen stehen wir gerne zur Verfügung.

Mit freundlichen Grüßen,
Das REPUTEXA-Shield-Team`,
  it: `Oggetto: Richiesta di rimozione di una recensione non conforme

Gentile team,

abbiamo rilevato sulla vostra piattaforma una recensione pubblicata da {reviewerName} che non rispetta le condizioni d'uso vigenti.

Questa recensione contiene contenuti d'odio, diffamatori e/o manifestamente falsi che ledono gravemente la nostra reputazione professionale e l'integrità della nostra attività.

In base alla vostra policy sui contenuti e alla normativa applicabile, vi chiediamo di procedere alla rimozione immediata di questa recensione nel più breve tempo possibile.

Restiamo a disposizione per ogni chiarimento.

Cordiali saluti,
Il team REPUTEXA Shield`,
  pt: `Assunto: Pedido de remoção de avaliação não conforme

Exmos. Senhores,

Detetámos na vossa plataforma uma avaliação publicada por {reviewerName} que não cumpre as vossas condições de utilização em vigor.

Esta avaliação contém discurso de ódio, difamatório e/ou manifestamente falso, prejudicando gravemente a nossa reputação profissional e a integridade do nosso estabelecimento.

Ao abrigo da vossa política de conteúdos e da legislação aplicável, solicitamos a remoção imediata desta avaliação com a maior brevidade possível.

Colocamo-nos à disposição para qualquer esclarecimento adicional.

Com os melhores cumprimentos,
A equipa REPUTEXA Shield`,
  ja: `件名：規約に違反する口コミの削除依頼

拝啓

貴社プラットフォーム上に、{reviewerName} により投稿された、現行の利用規約に適合しない口コミがあることを確認いたしました。

当該口コミには、ヘイト、誹謗中傷、明らかな虚偽の内容が含まれており、当社の業務上の評判および事業の信頼性に重大な損害を与えています。

貴社のコンテンツポリシーおよび適用法に基づき、速やかに当該口コミの削除をお願い申し上げます。

ご不明点がございましたらお知らせください。

敬具
REPUTEXA Shield チーム`,
  zh: `主题：请求删除不符合规定的评价

尊敬的团队：

我们在贵平台上发现由 {reviewerName} 发布的一条评价，不符合贵方现行使用条款。

该评价包含仇恨性、诽谤性和/或明显虚假的内容，严重损害我们的专业声誉与机构诚信。

依据贵方内容政策及适用法律，请尽快删除该评价。

如需补充信息，我们愿随时配合。

此致
REPUTEXA Shield 团队`,
};

function base(locale) {
  const L = legal[locale];
  return {
    pageTitle: locale === 'fr' ? 'Shield Center' : 'Shield Center',
    badgeActive:
      locale === 'fr'
        ? 'Surveillance active'
        : locale === 'en'
          ? 'Active monitoring'
          : locale === 'es'
            ? 'Vigilancia activa'
            : locale === 'de'
              ? 'Überwachung aktiv'
              : locale === 'it'
                ? 'Sorveglianza attiva'
                : locale === 'pt'
                  ? 'Vigilância ativa'
                  : locale === 'ja'
                    ? '監視中'
                    : '主动监控',
    pageSubtitle:
      locale === 'fr'
        ? 'Avis négatifs (réponse IA à valider) et bouclier toxique Pulse/Zenith — Vision : pas d’alerte WhatsApp sur les mauvais avis, tout passe par cet espace.'
        : locale === 'en'
          ? 'Negative reviews (AI reply to validate) and Pulse/Zenith toxic shield — Vision: no WhatsApp alerts for bad reviews; everything is handled here.'
          : locale === 'es'
            ? 'Reseñas negativas (respuesta IA por validar) y escudo tóxico Pulse/Zenith — Visión: sin alertas de WhatsApp por malas reseñas; todo pasa por aquí.'
            : locale === 'de'
              ? 'Negative Bewertungen (KI-Antwort zu prüfen) und Pulse/Zenith-Toxik-Schild — Vision: keine WhatsApp-Alerts bei schlechten Bewertungen; alles läuft hier.'
              : locale === 'it'
                ? 'Recensioni negative (risposta IA da convalidare) e scudo tossico Pulse/Zenith — Visione: niente alert WhatsApp per recensioni negative; tutto passa da qui.'
                : locale === 'pt'
                  ? 'Avaliações negativas (resposta IA a validar) e escudo tóxico Pulse/Zenith — Visão: sem alertas WhatsApp para más avaliações; tudo passa por aqui.'
                  : locale === 'ja'
                    ? '低評価（AI返信の確認）と Pulse/Zenith のトキシックシールド — ビジョン: 悪い口コミの WhatsApp 通知はなく、すべてこの画面で処理します。'
                    : '待处理的差评（需确认 AI 回复）与 Pulse/Zenith 有害评价防护 — 愿景：差评不走 WhatsApp 提醒，统一在此处理。',
    statThreatsDetected:
      locale === 'fr'
        ? 'Menaces détectées'
        : locale === 'en'
          ? 'Threats detected'
          : locale === 'es'
            ? 'Amenazas detectadas'
            : locale === 'de'
              ? 'Erkannte Bedrohungen'
              : locale === 'it'
                ? 'Minacce rilevate'
                : locale === 'pt'
                  ? 'Ameaças detetadas'
                  : locale === 'ja'
                    ? '検出された脅威'
                    : '已检测威胁',
    statInProgress:
      locale === 'fr'
        ? 'En cours'
        : locale === 'en'
          ? 'In progress'
          : locale === 'es'
            ? 'En curso'
            : locale === 'de'
              ? 'In Bearbeitung'
              : locale === 'it'
                ? 'In corso'
                : locale === 'pt'
                  ? 'Em curso'
                  : locale === 'ja'
                    ? '進行中'
                    : '进行中',
    statResolved:
      locale === 'fr'
        ? 'Neutralisées'
        : locale === 'en'
          ? 'Resolved'
          : locale === 'es'
            ? 'Neutralizadas'
            : locale === 'de'
              ? 'Erledigt'
              : locale === 'it'
                ? 'Risolte'
                : locale === 'pt'
                  ? 'Neutralizadas'
                  : locale === 'ja'
                    ? '処理済み'
                    : '已处理',
    loading:
      locale === 'fr'
        ? 'Chargement des alertes…'
        : locale === 'en'
          ? 'Loading alerts…'
          : locale === 'es'
            ? 'Cargando alertas…'
            : locale === 'de'
              ? 'Alerts werden geladen…'
              : locale === 'it'
                ? 'Caricamento avvisi…'
                : locale === 'pt'
                  ? 'A carregar alertas…'
                  : locale === 'ja'
                    ? 'アラートを読み込み中…'
                    : '正在加载提醒…',
    sectionNegativeTitle:
      locale === 'fr'
        ? 'Avis négatifs — réponse IA'
        : locale === 'en'
          ? 'Negative reviews — AI reply'
          : locale === 'es'
            ? 'Reseñas negativas — respuesta IA'
            : locale === 'de'
              ? 'Negative Bewertungen — KI-Antwort'
              : locale === 'it'
                ? 'Recensioni negative — risposta IA'
                : locale === 'pt'
                  ? 'Avaliações negativas — resposta IA'
                  : locale === 'ja'
                    ? '低評価 — AI 返信'
                    : '差评 — AI 回复',
    sectionNegativeDesc:
      locale === 'fr'
        ? 'Modifiez si besoin, puis mettez en file : publication automatique après un délai de quelques heures (effet « humain »), comme pour les avis positifs.'
        : locale === 'en'
          ? 'Edit if needed, then queue: automatic publishing after a few hours (a “human” delay), like for positive reviews.'
          : locale === 'es'
            ? 'Edite si hace falta y encole: publicación automática tras unas horas (efecto «humano»), como en reseñas positivas.'
            : locale === 'de'
              ? 'Bei Bedarf anpassen und einreihen: automatische Veröffentlichung nach einigen Stunden («menschlicher» Effekt), wie bei positiven Bewertungen.'
              : locale === 'it'
                ? 'Modifica se serve, poi metti in coda: pubblicazione automatica dopo alcune ore (effetto «umano»), come per le recensioni positive.'
                : locale === 'pt'
                  ? 'Edite se necessário e coloque na fila: publicação automática após algumas horas (efeito «humano»), como nas avaliações positivas.'
                  : locale === 'ja'
                    ? '必要なら編集し、キューに入れます。数時間後に自動公開（ポジティブと同様の「人間らしい」遅延）。'
                    : '如需可编辑，再入队：数小时后自动发布（与好评类似的「人性化」延迟）。',
    pendingBadge:
      locale === 'fr'
        ? 'En attente'
        : locale === 'en'
          ? 'Pending'
          : locale === 'es'
            ? 'Pendiente'
            : locale === 'de'
              ? 'Ausstehend'
              : locale === 'it'
                ? 'In attesa'
                : locale === 'pt'
                  ? 'Pendente'
                  : locale === 'ja'
                    ? '保留中'
                    : '待处理',
    save:
      locale === 'fr'
        ? 'Enregistrer'
        : locale === 'en'
          ? 'Save'
          : locale === 'es'
            ? 'Guardar'
            : locale === 'de'
              ? 'Speichern'
              : locale === 'it'
                ? 'Salva'
                : locale === 'pt'
                  ? 'Guardar'
                  : locale === 'ja'
                    ? '保存'
                    : '保存',
    cancel:
      locale === 'fr'
        ? 'Annuler'
        : locale === 'en'
          ? 'Cancel'
          : locale === 'es'
            ? 'Cancelar'
            : locale === 'de'
              ? 'Abbrechen'
              : locale === 'it'
                ? 'Annulla'
                : locale === 'pt'
                  ? 'Cancelar'
                  : locale === 'ja'
                    ? 'キャンセル'
                    : '取消',
    edit:
      locale === 'fr'
        ? 'Modifier'
        : locale === 'en'
          ? 'Edit'
          : locale === 'es'
            ? 'Editar'
            : locale === 'de'
              ? 'Bearbeiten'
              : locale === 'it'
                ? 'Modifica'
                : locale === 'pt'
                  ? 'Editar'
                  : locale === 'ja'
                    ? '編集'
                    : '编辑',
    queuePublication:
      locale === 'fr'
        ? 'Mettre en file de publication'
        : locale === 'en'
          ? 'Add to publication queue'
          : locale === 'es'
            ? 'Poner en cola de publicación'
            : locale === 'de'
              ? 'In Veröffentlichungs-Warteschlange'
              : locale === 'it'
                ? 'Metti in coda di pubblicazione'
                : locale === 'pt'
                  ? 'Colocar na fila de publicação'
                  : locale === 'ja'
                    ? '公開キューに入れる'
                    : '加入发布队列',
    sectionToxicTitle:
      locale === 'fr'
        ? 'Bouclier — avis toxiques'
        : locale === 'en'
          ? 'Shield — toxic reviews'
          : locale === 'es'
            ? 'Escudo — reseñas tóxicas'
            : locale === 'de'
              ? 'Schild — toxische Bewertungen'
              : locale === 'it'
                ? 'Scudo — recensioni tossiche'
                : locale === 'pt'
                  ? 'Escudo — avaliações tóxicas'
                  : locale === 'ja'
                    ? 'シールド — 有害な口コミ'
                    : '防护 — 有害评价',
    badgeToxic:
      locale === 'fr'
        ? 'Toxique'
        : locale === 'en'
          ? 'Toxic'
          : locale === 'es'
            ? 'Tóxico'
            : locale === 'de'
              ? 'Toxisch'
              : locale === 'it'
                ? 'Tossico'
                : locale === 'pt'
                  ? 'Tóxico'
                  : locale === 'ja'
                    ? '有害'
                    : '有害',
    badgeCritical:
      locale === 'fr'
        ? 'Critique'
        : locale === 'en'
          ? 'Critical'
          : locale === 'es'
            ? 'Crítico'
            : locale === 'de'
              ? 'Kritisch'
              : locale === 'it'
                ? 'Critico'
                : locale === 'pt'
                  ? 'Crítico'
                  : locale === 'ja'
                    ? '要対応'
                    : '紧急',
    emptyTitle:
      locale === 'fr'
        ? 'Rien à signaler.'
        : locale === 'en'
          ? 'All clear.'
          : locale === 'es'
            ? 'Nada que destacar.'
            : locale === 'de'
              ? 'Keine Meldungen.'
              : locale === 'it'
                ? 'Niente da segnalare.'
                : locale === 'pt'
                  ? 'Nada a reportar.'
                  : locale === 'ja'
                    ? '問題ありません。'
                    : '暂无事项。',
    emptyDesc:
      locale === 'fr'
        ? 'Aucun avis négatif en attente ni menace toxique active.'
        : locale === 'en'
          ? 'No pending negative reviews or active toxic threats.'
          : locale === 'es'
            ? 'Sin reseñas negativas pendientes ni amenazas tóxicas activas.'
            : locale === 'de'
              ? 'Keine ausstehenden negativen Bewertungen oder aktiven toxischen Bedrohungen.'
              : locale === 'it'
                ? 'Nessuna recensione negativa in sospeso né minaccia tossica attiva.'
                : locale === 'pt'
                  ? 'Sem avaliações negativas pendentes nem ameaças tóxicas ativas.'
                  : locale === 'ja'
                    ? '保留中の低評価も、アクティブな有害脅威もありません。'
                    : '没有待处理的差评或活跃的有害威胁。',
    emptyResolved:
      locale === 'fr'
        ? '{count, plural, one {# dossier bouclier déjà traité.} other {# dossiers bouclier déjà traités.}}'
        : locale === 'en'
          ? '{count, plural, one {# shield case already handled.} other {# shield cases already handled.}}'
          : locale === 'es'
            ? '{count, plural, one {# expediente del escudo ya gestionado.} other {# expedientes del escudo ya gestionados.}}'
            : locale === 'de'
              ? '{count, plural, one {# Schild-Fall bereits bearbeitet.} other {# Schild-Fälle bereits bearbeitet.}}'
              : locale === 'it'
                ? '{count, plural, one {# fascicolo scudo già gestito.} other {# fascicoli scudo già gestiti.}}'
                : locale === 'pt'
                  ? '{count, plural, one {# processo escudo já tratado.} other {# processos escudo já tratados.}}'
                  : locale === 'ja'
                    ? '{count, plural, other {シールド案件 # 件は既に処理済み。}}'
                    : '{count, plural, other {已有 # 个防护案件处理完毕。}}',
    analyzingTitle:
      locale === 'fr'
        ? 'L’IA REPUTEXA analyse l’avis…'
        : locale === 'en'
          ? 'REPUTEXA AI is analyzing the review…'
          : locale === 'es'
            ? 'La IA de REPUTEXA analiza la reseña…'
            : locale === 'de'
              ? 'Die REPUTEXA-KI analysiert die Bewertung…'
              : locale === 'it'
                ? 'L’IA REPUTEXA sta analizzando la recensione…'
                : locale === 'pt'
                  ? 'A IA REPUTEXA está a analisar a avaliação…'
                  : locale === 'ja'
                    ? 'REPUTEXA AI が口コミを分析しています…'
                    : 'REPUTEXA AI 正在分析该评价…',
    analyzingSubtitle:
      locale === 'fr'
        ? 'Vérification des 3 critères : haine · faux compte · menace'
        : locale === 'en'
          ? 'Checking 3 criteria: hate · fake account · threat'
          : locale === 'es'
            ? 'Comprobación de 3 criterios: odio · cuenta falsa · amenaza'
            : locale === 'de'
              ? 'Prüfung von 3 Kriterien: Hass · Fake-Account · Bedrohung'
              : locale === 'it'
                ? 'Verifica di 3 criteri: odio · account falso · minaccia'
                : locale === 'pt'
                  ? 'Verificação de 3 critérios: ódio · conta falsa · ameaça'
                  : locale === 'ja'
                    ? '3 つの基準を確認：ヘイト · 偽アカウント · 脅威'
                    : '正在核对三项：仇恨 · 虚假账号 · 威胁',
    flagHatred:
      locale === 'fr'
        ? 'Haine'
        : locale === 'en'
          ? 'Hate'
          : locale === 'es'
            ? 'Odio'
            : locale === 'de'
              ? 'Hass'
              : locale === 'it'
                ? 'Odio'
                : locale === 'pt'
                  ? 'Ódio'
                  : locale === 'ja'
                    ? 'ヘイト'
                    : '仇恨',
    flagFake:
      locale === 'fr'
        ? 'Faux compte'
        : locale === 'en'
          ? 'Fake account'
          : locale === 'es'
            ? 'Cuenta falsa'
            : locale === 'de'
              ? 'Fake-Account'
              : locale === 'it'
                ? 'Account falso'
                : locale === 'pt'
                  ? 'Conta falsa'
                  : locale === 'ja'
                    ? '偽アカウント'
                    : '虚假账号',
    flagThreat:
      locale === 'fr'
        ? 'Menace'
        : locale === 'en'
          ? 'Threat'
          : locale === 'es'
            ? 'Amenaza'
            : locale === 'de'
              ? 'Bedrohung'
              : locale === 'it'
                ? 'Minaccia'
                : locale === 'pt'
                  ? 'Ameaça'
                  : locale === 'ja'
                    ? '脅威'
                    : '威胁',
    confidenceLabel:
      locale === 'fr'
        ? 'Confiance : {percent}%'
        : locale === 'en'
          ? 'Confidence: {percent}%'
          : locale === 'es'
            ? 'Confianza: {percent} %'
            : locale === 'de'
              ? 'Vertrauen: {percent} %'
              : locale === 'it'
                ? 'Confidenza: {percent}%'
                : locale === 'pt'
                  ? 'Confiança: {percent}%'
                  : locale === 'ja'
                    ? '信頼度: {percent}%'
                    : '置信度：{percent}%',
    whatsappBrand: 'REPUTEXA Shield',
    whatsappSecurityAlert:
      locale === 'fr'
        ? 'Alerte de sécurité'
        : locale === 'en'
          ? 'Security alert'
          : locale === 'es'
            ? 'Alerta de seguridad'
            : locale === 'de'
              ? 'Sicherheitswarnung'
              : locale === 'it'
                ? 'Avviso di sicurezza'
                : locale === 'pt'
                  ? 'Alerta de segurança'
                  : locale === 'ja'
                    ? 'セキュリティ通知'
                    : '安全提醒',
    whatsappOnline:
      locale === 'fr'
        ? 'En ligne'
        : locale === 'en'
          ? 'Online'
          : locale === 'es'
            ? 'En línea'
            : locale === 'de'
              ? 'Online'
              : locale === 'it'
                ? 'Online'
                : locale === 'pt'
                  ? 'Online'
                  : locale === 'ja'
                    ? 'オンライン'
                    : '在线',
    whatsappToxicDetected:
      locale === 'fr'
        ? 'Avis toxique détecté'
        : locale === 'en'
          ? 'Toxic review detected'
          : locale === 'es'
            ? 'Reseña tóxica detectada'
            : locale === 'de'
              ? 'Toxische Bewertung erkannt'
              : locale === 'it'
                ? 'Recensione tossica rilevata'
                : locale === 'pt'
                  ? 'Avaliação tóxica detetada'
                  : locale === 'ja'
                    ? '有害な口コミを検出'
                    : '检测到有害评价',
    whatsappAuthorLabel:
      locale === 'fr'
        ? 'Auteur :'
        : locale === 'en'
          ? 'Author:'
          : locale === 'es'
            ? 'Autor:'
            : locale === 'de'
              ? 'Autor:'
              : locale === 'it'
                ? 'Autore:'
                : locale === 'pt'
                  ? 'Autor:'
                  : locale === 'ja'
                    ? '投稿者:'
                    : '作者：',
    whatsappPlatformLabel:
      locale === 'fr'
        ? 'Plateforme :'
        : locale === 'en'
          ? 'Platform:'
          : locale === 'es'
            ? 'Plataforma:'
            : locale === 'de'
              ? 'Plattform:'
              : locale === 'it'
                ? 'Piattaforma:'
                : locale === 'pt'
                  ? 'Plataforma:'
                  : locale === 'ja'
                    ? 'プラットフォーム:'
                    : '平台：',
    whatsappTapToManage:
      locale === 'fr'
        ? '→ Appuyer pour gérer cette alerte'
        : locale === 'en'
          ? '→ Tap to manage this alert'
          : locale === 'es'
            ? '→ Toca para gestionar esta alerta'
            : locale === 'de'
              ? '→ Tippen, um diese Warnung zu verwalten'
              : locale === 'it'
                ? '→ Tocca per gestire questo avviso'
                : locale === 'pt'
                  ? '→ Toque para gerir este alerta'
                  : locale === 'ja'
                    ? '→ タップしてこの通知を管理'
                    : '→ 点按管理此提醒',
    progressDetection:
      locale === 'fr'
        ? 'Détection'
        : locale === 'en'
          ? 'Detection'
          : locale === 'es'
            ? 'Detección'
            : locale === 'de'
              ? 'Erkennung'
              : locale === 'it'
                ? 'Rilevamento'
                : locale === 'pt'
                  ? 'Deteção'
                  : locale === 'ja'
                    ? '検出'
                    : '检测',
    progressValidation:
      locale === 'fr'
        ? 'Validation client'
        : locale === 'en'
          ? 'Client validation'
          : locale === 'es'
            ? 'Validación del cliente'
            : locale === 'de'
              ? 'Kundenfreigabe'
              : locale === 'it'
                ? 'Validazione cliente'
                : locale === 'pt'
                  ? 'Validação do cliente'
                  : locale === 'ja'
                    ? '顧客の確認'
                    : '客户确认',
    progressSendGoogle:
      locale === 'fr'
        ? 'Envoi plateforme'
        : locale === 'en'
          ? 'Submit to platform'
          : locale === 'es'
            ? 'Envío a la plataforma'
            : locale === 'de'
              ? 'Senden an Plattform'
              : locale === 'it'
                ? 'Invio alla piattaforma'
                : locale === 'pt'
                  ? 'Envio à plataforma'
                  : locale === 'ja'
                    ? 'プラットフォームへ送信'
                    : '提交至平台',
    progressVerdict:
      locale === 'fr'
        ? 'Verdict'
        : locale === 'en'
          ? 'Outcome'
          : locale === 'es'
            ? 'Resultado'
            : locale === 'de'
              ? 'Ergebnis'
              : locale === 'it'
                ? 'Esito'
                : locale === 'pt'
                  ? 'Resultado'
                  : locale === 'ja'
                    ? '完了'
                    : '结果',
    modalTitle:
      locale === 'fr'
        ? 'Confirmer et envoyer'
        : locale === 'en'
          ? 'Confirm and send'
          : locale === 'es'
            ? 'Confirmar y enviar'
            : locale === 'de'
              ? 'Bestätigen und senden'
              : locale === 'it'
                ? 'Conferma e invia'
                : locale === 'pt'
                  ? 'Confirmar e enviar'
                  : locale === 'ja'
                    ? '確認して送信'
                    : '确认并发送',
    modalSubtitle:
      locale === 'fr'
        ? 'Dossier juridique IA — Plateforme : {platform}'
        : locale === 'en'
          ? 'AI legal brief — Platform: {platform}'
          : locale === 'es'
            ? 'Expediente legal IA — Plataforma: {platform}'
            : locale === 'de'
              ? 'KI-Rechtsdossier — Plattform: {platform}'
              : locale === 'it'
                ? 'Fascicolo legale IA — Piattaforma: {platform}'
                : locale === 'pt'
                  ? 'Processo legal IA — Plataforma: {platform}'
                  : locale === 'ja'
                    ? 'AI 法務ドキュメント — プラットフォーム: {platform}'
                    : 'AI 法务摘要 — 平台：{platform}',
    modalDetectedReview:
      locale === 'fr'
        ? 'Avis détecté'
        : locale === 'en'
          ? 'Review detected'
          : locale === 'es'
            ? 'Reseña detectada'
            : locale === 'de'
              ? 'Bewertung erkannt'
              : locale === 'it'
                ? 'Recensione rilevata'
                : locale === 'pt'
                  ? 'Avaliação detetada'
                  : locale === 'ja'
                    ? '検出された口コミ'
                    : '已检测评价',
    modalDiagnostic:
      locale === 'fr'
        ? 'Diagnostic IA'
        : locale === 'en'
          ? 'AI diagnostic'
          : locale === 'es'
            ? 'Diagnóstico IA'
            : locale === 'de'
              ? 'KI-Diagnose'
              : locale === 'it'
                ? 'Diagnosi IA'
                : locale === 'pt'
                  ? 'Diagnóstico IA'
                  : locale === 'ja'
                    ? 'AI 診断'
                    : 'AI 诊断',
    modalWhatsappSimulated:
      locale === 'fr'
        ? 'Notification WhatsApp simulée'
        : locale === 'en'
          ? 'Simulated WhatsApp notification'
          : locale === 'es'
            ? 'Notificación de WhatsApp simulada'
            : locale === 'de'
              ? 'Simulierte WhatsApp-Benachrichtigung'
              : locale === 'it'
                ? 'Notifica WhatsApp simulata'
                : locale === 'pt'
                  ? 'Notificação WhatsApp simulada'
                  : locale === 'ja'
                    ? 'WhatsApp 通知のプレビュー'
                    : '模拟 WhatsApp 通知',
    modalComplaintDraft:
      locale === 'fr'
        ? 'Plainte IA rédigée'
        : locale === 'en'
          ? 'AI-drafted complaint'
          : locale === 'es'
            ? 'Denuncia redactada por IA'
            : locale === 'de'
              ? 'KI-verfasste Beschwerde'
              : locale === 'it'
                ? 'Reclamo redatto dall’IA'
                : locale === 'pt'
                  ? 'Reclamação redigida por IA'
                  : locale === 'ja'
                    ? 'AI 作成の申立て文'
                    : 'AI 起草的投诉稿',
    modalEditable:
      locale === 'fr'
        ? 'Modifiable'
        : locale === 'en'
          ? 'Editable'
          : locale === 'es'
            ? 'Editable'
            : locale === 'de'
              ? 'Bearbeitbar'
              : locale === 'it'
                ? 'Modificabile'
                : locale === 'pt'
                  ? 'Editável'
                  : locale === 'ja'
                    ? '編集可'
                    : '可编辑',
    modalClipboardHint:
      locale === 'fr'
        ? 'Ce texte sera copié dans votre presse-papiers. La page de signalement ({platform}) s’ouvrira automatiquement. Collez-y le texte pour finaliser.'
        : locale === 'en'
          ? 'This text will be copied to your clipboard. The reporting page ({platform}) will open automatically. Paste the text there to finish.'
          : locale === 'es'
            ? 'Este texto se copiará al portapapeles. Se abrirá la página de denuncias ({platform}) automáticamente. Pégalo allí para finalizar.'
            : locale === 'de'
              ? 'Dieser Text wird in die Zwischenablage kopiert. Die Meldeseite ({platform}) öffnet sich automatisch. Fügen Sie den Text dort ein.'
              : locale === 'it'
                ? 'Questo testo verrà copiato negli appunti. Si aprirà la pagina di segnalazione ({platform}). Incolla il testo per completare.'
                : locale === 'pt'
                  ? 'Este texto será copiado para a área de transferência. A página de denúncia ({platform}) abrirá automaticamente. Cole o texto para concluir.'
                  : locale === 'ja'
                    ? 'テキストはクリップボードにコピーされます。通報ページ（{platform}）が自動で開きます。貼り付けて完了してください。'
                    : '文本将复制到剪贴板。举报页面（{platform}）将自动打开，粘贴后即可完成。',
    modalIrreversible:
      locale === 'fr'
        ? 'Action irréversible après validation.'
        : locale === 'en'
          ? 'This action cannot be undone after you confirm.'
          : locale === 'es'
            ? 'Acción irreversible tras la validación.'
            : locale === 'de'
              ? 'Nach Bestätigung nicht rückgängig zu machen.'
              : locale === 'it'
                ? 'Azione irreversibile dopo la conferma.'
                : locale === 'pt'
                  ? 'Ação irreversível após confirmação.'
                  : locale === 'ja'
                    ? '確定後は取り消せません。'
                    : '确认后无法撤销。',
    modalCancel:
      locale === 'fr'
        ? 'Annuler'
        : locale === 'en'
          ? 'Cancel'
          : locale === 'es'
            ? 'Cancelar'
            : locale === 'de'
              ? 'Abbrechen'
              : locale === 'it'
                ? 'Annulla'
                : locale === 'pt'
                  ? 'Cancelar'
                  : locale === 'ja'
                    ? 'キャンセル'
                    : '取消',
    modalProcessing:
      locale === 'fr'
        ? 'Traitement en cours…'
        : locale === 'en'
          ? 'Processing…'
          : locale === 'es'
            ? 'Procesando…'
            : locale === 'de'
              ? 'Wird verarbeitet…'
              : locale === 'it'
                ? 'Elaborazione…'
                : locale === 'pt'
                  ? 'A processar…'
                  : locale === 'ja'
                    ? '処理中…'
                    : '处理中…',
    modalApproveSend:
      locale === 'fr'
        ? 'Approuver et envoyer à {platform}'
        : locale === 'en'
          ? 'Approve and send to {platform}'
          : locale === 'es'
            ? 'Aprobar y enviar a {platform}'
            : locale === 'de'
              ? 'Freigeben und an {platform} senden'
              : locale === 'it'
                ? 'Approva e invia a {platform}'
                : locale === 'pt'
                  ? 'Aprovar e enviar para {platform}'
                  : locale === 'ja'
                    ? '{platform} に承認して送信'
                    : '批准并发送至 {platform}',
    toastAnalyzeFailed:
      locale === 'fr'
        ? 'Analyse échouée'
        : locale === 'en'
          ? 'Analysis failed'
          : locale === 'es'
            ? 'Análisis fallido'
            : locale === 'de'
              ? 'Analyse fehlgeschlagen'
              : locale === 'it'
                ? 'Analisi non riuscita'
                : locale === 'pt'
                  ? 'Análise falhou'
                  : locale === 'ja'
                    ? '分析に失敗しました'
                    : '分析失败',
    toastNoCriticalSignal:
      locale === 'fr'
        ? 'Aucun signal critique détecté — vous pouvez ignorer cet avis.'
        : locale === 'en'
          ? 'No critical signals detected — you can ignore this review.'
          : locale === 'es'
            ? 'No hay señales críticas: puede ignorar esta reseña.'
            : locale === 'de'
              ? 'Keine kritischen Signale — Sie können diese Bewertung ignorieren.'
              : locale === 'it'
                ? 'Nessun segnale critico: puoi ignorare questa recensione.'
                : locale === 'pt'
                  ? 'Sem sinais críticos — pode ignorar esta avaliação.'
                  : locale === 'ja'
                    ? '重大なシグナルはありません — この口コミは無視できます。'
                    : '未检测到关键信号 — 可忽略此评价。',
    toastSignalsDetected:
      locale === 'fr'
        ? '{count, plural, one {# signal détecté — vérifiez le diagnostic.} other {# signaux détectés — vérifiez le diagnostic.}}'
        : locale === 'en'
          ? '{count, plural, one {# signal detected — check the diagnostic.} other {# signals detected — check the diagnostic.}}'
          : locale === 'es'
            ? '{count, plural, one {# señal detectada — revise el diagnóstico.} other {# señales detectadas — revise el diagnóstico.}}'
            : locale === 'de'
              ? '{count, plural, one {# Signal erkannt — bitte Diagnose prüfen.} other {# Signale erkannt — bitte Diagnose prüfen.}}'
            : locale === 'it'
              ? '{count, plural, one {# segnale rilevato — controlla la diagnosi.} other {# segnali rilevati — controlla la diagnosi.}}'
            : locale === 'pt'
              ? '{count, plural, one {# sinal detetado — veja o diagnóstico.} other {# sinais detetados — veja o diagnóstico.}}'
            : locale === 'ja'
              ? '{count, plural, other {シグナル # 件を検出 — 診断を確認してください。}}'
            : '{count, plural, other {检测到 # 个信号 — 请查看诊断。}}',
    toastServerError:
      locale === 'fr'
        ? 'Erreur lors de la communication avec le serveur.'
        : locale === 'en'
          ? 'Could not reach the server.'
          : locale === 'es'
            ? 'Error al comunicarse con el servidor.'
            : locale === 'de'
              ? 'Fehler bei der Serverkommunikation.'
              : locale === 'it'
                ? 'Errore di comunicazione con il server.'
                : locale === 'pt'
                  ? 'Erro ao comunicar com o servidor.'
                  : locale === 'ja'
                    ? 'サーバーとの通信に失敗しました。'
                    : '无法连接服务器。',
    toastIgnored:
      locale === 'fr'
        ? 'Avis ignoré — retiré de la file d’alertes.'
        : locale === 'en'
          ? 'Review ignored — removed from the alert queue.'
          : locale === 'es'
            ? 'Reseña ignorada — quitada de la cola de alertas.'
            : locale === 'de'
              ? 'Bewertung ignoriert — aus der Alert-Warteschlange entfernt.'
              : locale === 'it'
                ? 'Recensione ignorata — rimossa dalla coda avvisi.'
                : locale === 'pt'
                  ? 'Avaliação ignorada — removida da fila de alertas.'
                  : locale === 'ja'
                    ? '口コミをスキップ — アラート一覧から外しました。'
                    : '已忽略评价 — 已从提醒队列移除。',
    toastIgnoreFailed:
      locale === 'fr'
        ? 'Impossible d’ignorer cet avis.'
        : locale === 'en'
          ? 'Could not ignore this review.'
          : locale === 'es'
            ? 'No se pudo ignorar esta reseña.'
            : locale === 'de'
              ? 'Diese Bewertung konnte nicht ignoriert werden.'
              : locale === 'it'
                ? 'Impossibile ignorare questa recensione.'
                : locale === 'pt'
                  ? 'Não foi possível ignorar esta avaliação.'
                  : locale === 'ja'
                    ? 'この口コミをスキップできませんでした。'
                    : '无法忽略该评价。',
    toastNetworkError:
      locale === 'fr'
        ? 'Erreur réseau.'
        : locale === 'en'
          ? 'Network error.'
          : locale === 'es'
            ? 'Error de red.'
            : locale === 'de'
              ? 'Netzwerkfehler.'
              : locale === 'it'
                ? 'Errore di rete.'
                : locale === 'pt'
                  ? 'Erro de rede.'
                  : locale === 'ja'
                    ? 'ネットワークエラー'
                    : '网络错误。',
    toastCopiedPaste:
      locale === 'fr'
        ? 'Texte copié ! Collez-le maintenant dans le formulaire qui vient de s’ouvrir.'
        : locale === 'en'
          ? 'Text copied! Paste it into the form that just opened.'
          : locale === 'es'
            ? '¡Texto copiado! Pégalo en el formulario que se acaba de abrir.'
            : locale === 'de'
              ? 'Text kopiert! Fügen Sie ihn in das geöffnete Formular ein.'
              : locale === 'it'
                ? 'Testo copiato! Incollalo nel modulo appena aperto.'
                : locale === 'pt'
                  ? 'Texto copiado! Cole no formulário que acabou de abrir.'
                  : locale === 'ja'
                    ? 'コピーしました。開いたフォームに貼り付けてください。'
                    : '已复制。请粘贴到刚打开的表单中。',
    toastFinalizeError:
      locale === 'fr'
        ? 'Erreur lors de la finalisation.'
        : locale === 'en'
          ? 'Could not finalize.'
          : locale === 'es'
            ? 'Error al finalizar.'
            : locale === 'de'
              ? 'Abschluss fehlgeschlagen.'
              : locale === 'it'
                ? 'Impossibile completare.'
                : locale === 'pt'
                  ? 'Erro ao concluir.'
                  : locale === 'ja'
                    ? '完了処理に失敗しました。'
                    : '无法完成。',
    toastPublishQueued:
      locale === 'fr'
        ? 'Réponse mise en file de publication. Consultez Réponses IA pour le compte à rebours.'
        : locale === 'en'
          ? 'Reply queued for publishing. Open AI Replies to see the countdown.'
          : locale === 'es'
            ? 'Respuesta en cola de publicación. Vea Respuestas IA para la cuenta atrás.'
            : locale === 'de'
              ? 'Antwort in die Veröffentlichungs-Warteschlange. Unter KI-Antworten den Countdown sehen.'
              : locale === 'it'
                ? 'Risposta in coda di pubblicazione. Vedi Risposte IA per il conto alla rovescia.'
                : locale === 'pt'
                  ? 'Resposta na fila de publicação. Veja Respostas IA para a contagem.'
                  : locale === 'ja'
                    ? '返信を公開キューに入れました。AI 返信でカウントダウンを確認してください。'
                    : '回复已加入发布队列。请在 AI 回复中查看倒计时。',
    toastReplyEdited:
      locale === 'fr'
        ? 'Réponse modifiée.'
        : locale === 'en'
          ? 'Reply updated.'
          : locale === 'es'
            ? 'Respuesta actualizada.'
            : locale === 'de'
              ? 'Antwort aktualisiert.'
              : locale === 'it'
                ? 'Risposta aggiornata.'
                : locale === 'pt'
                  ? 'Resposta atualizada.'
                  : locale === 'ja'
                    ? '返信を更新しました。'
                    : '回复已更新。',
    toastErrorGeneric:
      locale === 'fr'
        ? 'Erreur'
        : locale === 'en'
          ? 'Error'
          : locale === 'es'
            ? 'Error'
            : locale === 'de'
              ? 'Fehler'
              : locale === 'it'
                ? 'Errore'
                : locale === 'pt'
                  ? 'Erro'
                  : locale === 'ja'
                    ? 'エラー'
                    : '错误',
    cardLegalReady:
      locale === 'fr'
        ? 'Dossier juridique IA prêt.'
        : locale === 'en'
          ? 'AI legal brief is ready.'
          : locale === 'es'
            ? 'Expediente legal IA listo.'
            : locale === 'de'
              ? 'KI-Rechtsdossier ist bereit.'
              : locale === 'it'
                ? 'Fascicolo legale IA pronto.'
                : locale === 'pt'
                  ? 'Processo legal IA pronto.'
                  : locale === 'ja'
                    ? 'AI 法務ドキュメントの準備ができました。'
                    : 'AI 法务摘要已就绪。',
    cardRunAnalysis:
      locale === 'fr'
        ? 'Lancez l’analyse IA pour générer le dossier.'
        : locale === 'en'
          ? 'Run AI analysis to generate the brief.'
          : locale === 'es'
            ? 'Inicie el análisis IA para generar el expediente.'
            : locale === 'de'
              ? 'Starten Sie die KI-Analyse, um das Dossier zu erzeugen.'
              : locale === 'it'
                ? 'Avvia l’analisi IA per generare il fascicolo.'
                : locale === 'pt'
                  ? 'Execute a análise IA para gerar o processo.'
                  : locale === 'ja'
                    ? 'AI 分析を実行して資料を生成してください。'
                    : '运行 AI 分析以生成材料。',
    ignore:
      locale === 'fr'
        ? 'Ignorer'
        : locale === 'en'
          ? 'Ignore'
          : locale === 'es'
            ? 'Ignorar'
            : locale === 'de'
              ? 'Ignorieren'
              : locale === 'it'
                ? 'Ignora'
                : locale === 'pt'
                  ? 'Ignorar'
                  : locale === 'ja'
                    ? 'スキップ'
                    : '忽略',
    analyzeShort:
      locale === 'fr'
        ? 'Analyse…'
        : locale === 'en'
          ? 'Analyzing…'
          : locale === 'es'
            ? 'Analizando…'
            : locale === 'de'
              ? 'Analyse…'
              : locale === 'it'
                ? 'Analisi…'
                : locale === 'pt'
                  ? 'A analisar…'
                  : locale === 'ja'
                    ? '分析中…'
                    : '分析中…',
    analyzeWithAi:
      locale === 'fr'
        ? 'Analyser avec l’IA'
        : locale === 'en'
          ? 'Analyze with AI'
          : locale === 'es'
            ? 'Analizar con IA'
            : locale === 'de'
              ? 'Mit KI analysieren'
              : locale === 'it'
                ? 'Analizza con IA'
                : locale === 'pt'
                  ? 'Analisar com IA'
                  : locale === 'ja'
                    ? 'AI で分析'
                    : '使用 AI 分析',
    confirmThreat:
      locale === 'fr'
        ? 'Confirmer la menace'
        : locale === 'en'
          ? 'Confirm threat'
          : locale === 'es'
            ? 'Confirmar amenaza'
            : locale === 'de'
              ? 'Bedrohung bestätigen'
              : locale === 'it'
                ? 'Conferma minaccia'
                : locale === 'pt'
                  ? 'Confirmar ameaça'
                  : locale === 'ja'
                    ? '脅威を確認'
                    : '确认威胁',
    inProgress:
      locale === 'fr'
        ? 'En cours…'
        : locale === 'en'
          ? 'In progress…'
          : locale === 'es'
            ? 'En curso…'
            : locale === 'de'
              ? 'Läuft…'
              : locale === 'it'
                ? 'In corso…'
                : locale === 'pt'
                  ? 'Em curso…'
                  : locale === 'ja'
                    ? '処理中…'
                    : '进行中…',
    planRequired:
      locale === 'fr'
        ? 'Pulse / Zenith requis'
        : locale === 'en'
          ? 'Pulse / Zenith required'
          : locale === 'es'
            ? 'Pulse / Zenith requerido'
            : locale === 'de'
              ? 'Pulse / Zenith erforderlich'
              : locale === 'it'
                ? 'Pulse / Zenith richiesto'
                : locale === 'pt'
                  ? 'Pulse / Zenith necessário'
                  : locale === 'ja'
                    ? 'Pulse / Zenith が必要です'
                    : '需要 Pulse / Zenith',
    defaultReviewerName:
      locale === 'fr'
        ? 'Client'
        : locale === 'en'
          ? 'Customer'
          : locale === 'es'
            ? 'Cliente'
            : locale === 'de'
              ? 'Kunde'
              : locale === 'it'
                ? 'Cliente'
                : locale === 'pt'
                  ? 'Cliente'
                  : locale === 'ja'
                    ? '利用者'
                    : '顾客',
    platformGoogle: 'Google',
    platformFacebook: 'Facebook',
    platformTrustpilot: 'Trustpilot',
    platformGeneric:
      locale === 'fr'
        ? 'la plateforme'
        : locale === 'en'
          ? 'the platform'
          : locale === 'es'
            ? 'la plataforma'
            : locale === 'de'
              ? 'die Plattform'
              : locale === 'it'
                ? 'la piattaforma'
                : locale === 'pt'
                  ? 'a plataforma'
                  : locale === 'ja'
                    ? 'プラットフォーム'
                    : '平台',
    legalComplaintTemplate: legal[locale],
  };
}

const locales = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];
for (const loc of locales) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Dashboard = j.Dashboard || {};
  j.Dashboard.alertsPage = base(loc);
  fs.writeFileSync(p, JSON.stringify(j));
}
console.log('Merged Dashboard.alertsPage into', locales.length, 'files');
