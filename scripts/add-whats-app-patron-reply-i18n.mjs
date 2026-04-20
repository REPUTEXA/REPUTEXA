import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'messages');

const pack = {
  fr: {
    publishedSuccess: "🚀 C'est publié avec succès !",
    listenWhatToChange: 'Je vous écoute, que voulez-vous changer ?',
    twilioMissingVocal: 'Configuration Twilio manquante pour le vocal. Contactez le support.',
    transcribeFailed:
      "Désolé, je n'ai pas pu transcrire le vocal. Réessayez ou envoyez un message texte.",
    messageUnclear:
      "Je n'ai pas pu comprendre votre message. Envoyez du texte ou un vocal pour modifier la réponse, ou tapez OK pour valider.",
    fallbackNoReview:
      'Désolé, je n\'ai pas retrouvé l\'avis original, mais voici une suggestion basée sur votre message :\n\n{suggestion}',
    nothingToValidate:
      'Aucune réponse à valider. Envoyez une instruction pour générer une modification.',
    responseValidatedScheduled: '✅ Réponse validée ! Elle sera publiée prochainement.',
    replyUnavailable: 'Réponse non disponible.',
    noComment: '(Aucun commentaire)',
    clientFallback: 'Client',
  },
  en: {
    publishedSuccess: '🚀 Published successfully!',
    listenWhatToChange: "I'm listening — what would you like to change?",
    twilioMissingVocal: 'Twilio is not configured for voice. Please contact support.',
    transcribeFailed:
      "Sorry, I couldn't transcribe the voice note. Try again or send a text message.",
    messageUnclear:
      "I couldn't understand your message. Send text or a voice note to edit the reply, or type OK to confirm.",
    fallbackNoReview:
      "Sorry, I couldn't find the original review, but here's a suggestion based on your message:\n\n{suggestion}",
    nothingToValidate: 'Nothing to validate. Send an instruction to generate an edit.',
    responseValidatedScheduled: '✅ Reply validated! It will be published shortly.',
    replyUnavailable: 'Reply unavailable.',
    noComment: '(No comment)',
    clientFallback: 'Customer',
  },
  de: {
    publishedSuccess: '🚀 Erfolgreich veröffentlicht!',
    listenWhatToChange: 'Ich höre zu — was möchten Sie ändern?',
    twilioMissingVocal: 'Twilio ist für Sprache nicht konfiguriert. Bitte Support kontaktieren.',
    transcribeFailed:
      'Die Sprachnachricht konnte nicht transkribiert werden. Bitte erneut versuchen oder Text senden.',
    messageUnclear:
      'Ich konnte Ihre Nachricht nicht verstehen. Senden Sie Text oder eine Sprachnachricht, um die Antwort zu ändern, oder OK zur Bestätigung.',
    fallbackNoReview:
      'Die Originalbewertung wurde nicht gefunden; hier ein Vorschlag basierend auf Ihrer Nachricht:\n\n{suggestion}',
    nothingToValidate: 'Nichts zu bestätigen. Senden Sie eine Anweisung, um eine Änderung zu erzeugen.',
    responseValidatedScheduled: '✅ Antwort bestätigt! Sie wird in Kürze veröffentlicht.',
    replyUnavailable: 'Antwort nicht verfügbar.',
    noComment: '(Kein Kommentar)',
    clientFallback: 'Kunde',
  },
  es: {
    publishedSuccess: '🚀 ¡Publicado correctamente!',
    listenWhatToChange: 'Le escucho: ¿qué desea cambiar?',
    twilioMissingVocal: 'Falta la configuración de Twilio para voz. Contacte con soporte.',
    transcribeFailed:
      'No pude transcribir el audio. Inténtelo de nuevo o envíe un mensaje de texto.',
    messageUnclear:
      'No entendí su mensaje. Envíe texto o un audio para modificar la respuesta, o escriba OK para validar.',
    fallbackNoReview:
      'No encontré la reseña original; aquí tiene una sugerencia según su mensaje:\n\n{suggestion}',
    nothingToValidate: 'Nada que validar. Envíe una instrucción para generar una modificación.',
    responseValidatedScheduled: '✅ ¡Respuesta validada! Se publicará en breve.',
    replyUnavailable: 'Respuesta no disponible.',
    noComment: '(Sin comentario)',
    clientFallback: 'Cliente',
  },
  it: {
    publishedSuccess: '🚀 Pubblicato con successo!',
    listenWhatToChange: 'La ascolto: cosa vuole modificare?',
    twilioMissingVocal: "Twilio non è configurato per la voce. Contatti l'assistenza.",
    transcribeFailed:
      'Non è stato possibile trascrivere il messaggio vocale. Riprovare o inviare un testo.',
    messageUnclear:
      'Non ho capito il messaggio. Invii testo o un vocale per modificare la risposta, o scriva OK per confermare.',
    fallbackNoReview:
      'Non ho trovato la recensione originale; ecco un suggerimento in base al suo messaggio:\n\n{suggestion}',
    nothingToValidate: "Niente da convalidare. Invii un'istruzione per generare una modifica.",
    responseValidatedScheduled: '✅ Risposta convalidata! Sarà pubblicata a breve.',
    replyUnavailable: 'Risposta non disponibile.',
    noComment: '(Nessun commento)',
    clientFallback: 'Cliente',
  },
  pt: {
    publishedSuccess: '🚀 Publicado com sucesso!',
    listenWhatToChange: 'Estou a ouvir — o que pretende alterar?',
    twilioMissingVocal: 'Configuração Twilio em falta para voz. Contacte o suporte.',
    transcribeFailed:
      'Não consegui transcrever o áudio. Tente novamente ou envie uma mensagem de texto.',
    messageUnclear:
      'Não percebi a sua mensagem. Envie texto ou áudio para alterar a resposta, ou escreva OK para validar.',
    fallbackNoReview:
      'Não encontrei a avaliação original; aqui está uma sugestão com base na sua mensagem:\n\n{suggestion}',
    nothingToValidate: 'Nada a validar. Envie uma instrução para gerar uma alteração.',
    responseValidatedScheduled: '✅ Resposta validada! Será publicada em breve.',
    replyUnavailable: 'Resposta indisponível.',
    noComment: '(Sem comentário)',
    clientFallback: 'Cliente',
  },
  ja: {
    publishedSuccess: '🚀 公開しました。',
    listenWhatToChange: 'どのように変更しますか？',
    twilioMissingVocal: '音声用のTwilio設定がありません。サポートへご連絡ください。',
    transcribeFailed:
      '音声を文字に起こせませんでした。再度お試しいただくか、テキストで送信してください。',
    messageUnclear:
      'メッセージを理解できませんでした。返信を編集するにはテキストまたは音声を送るか、OKと入力して確定してください。',
    fallbackNoReview:
      '元のレビューが見つかりませんでした。メッセージに基づく案です：\n\n{suggestion}',
    nothingToValidate:
      '確定する返信がありません。編集案を出すには指示を送ってください。',
    responseValidatedScheduled: '✅ 返信を確定しました。まもなく公開されます。',
    replyUnavailable: '返信がありません。',
    noComment: '（コメントなし）',
    clientFallback: 'お客様',
  },
  zh: {
    publishedSuccess: '🚀 已成功发布。',
    listenWhatToChange: '请说，您想修改什么？',
    twilioMissingVocal: '缺少语音所需的 Twilio 配置，请联系支持。',
    transcribeFailed: '无法转写语音，请重试或发送文字消息。',
    messageUnclear:
      '无法理解您的消息。请发送文字或语音以修改回复，或输入 OK 确认。',
    fallbackNoReview:
      '未找到原始评价，以下是根据您消息的建议：\n\n{suggestion}',
    nothingToValidate: '没有可确认的回复。请发送指令以生成修改。',
    responseValidatedScheduled: '✅ 回复已确认！将很快发布。',
    replyUnavailable: '暂无回复。',
    noComment: '（无评论）',
    clientFallback: '客户',
  },
};

for (const loc of Object.keys(pack)) {
  const p = path.join(dir, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.Dashboard) j.Dashboard = {};
  j.Dashboard.whatsAppPatronReply = pack[loc];
  fs.writeFileSync(p, JSON.stringify(j));
}
console.log('whatsAppPatronReply added to 8 locales');
