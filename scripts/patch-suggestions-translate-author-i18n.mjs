/**
 * Clés Suggestions.list (traduction + auteur) + ApiAppSuggestions (erreurs translate)
 * node scripts/patch-suggestions-translate-author-i18n.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(path.resolve(__dirname, '..'), 'messages');
const LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];

const LIST = {
  fr: {
    translateCta: 'Traduire',
    translateLoading: 'Traduction…',
    showOriginal: 'Voir l’original',
    showTranslation: 'Voir la traduction',
    translateError: 'Traduction impossible. Réessayez.',
    authorAnonymous: 'Membre de la communauté',
    translateAria: 'Traduire cette suggestion dans ma langue',
  },
  en: {
    translateCta: 'Translate',
    translateLoading: 'Translating…',
    showOriginal: 'Show original',
    showTranslation: 'Show translation',
    translateError: 'Could not translate. Please try again.',
    authorAnonymous: 'Community member',
    translateAria: 'Translate this suggestion into my language',
  },
  es: {
    translateCta: 'Traducir',
    translateLoading: 'Traduciendo…',
    showOriginal: 'Ver original',
    showTranslation: 'Ver traducción',
    translateError: 'No se pudo traducir. Inténtalo de nuevo.',
    authorAnonymous: 'Miembro de la comunidad',
    translateAria: 'Traducir esta sugerencia a mi idioma',
  },
  de: {
    translateCta: 'Übersetzen',
    translateLoading: 'Wird übersetzt…',
    showOriginal: 'Original anzeigen',
    showTranslation: 'Übersetzung anzeigen',
    translateError: 'Übersetzung fehlgeschlagen. Bitte erneut versuchen.',
    authorAnonymous: 'Community-Mitglied',
    translateAria: 'Diesen Vorschlag in meine Sprache übersetzen',
  },
  it: {
    translateCta: 'Traduci',
    translateLoading: 'Traduzione…',
    showOriginal: 'Vedi originale',
    showTranslation: 'Vedi traduzione',
    translateError: 'Traduzione non riuscita. Riprova.',
    authorAnonymous: 'Membro della community',
    translateAria: 'Traduci questo suggerimento nella mia lingua',
  },
  pt: {
    translateCta: 'Traduzir',
    translateLoading: 'A traduzir…',
    showOriginal: 'Ver original',
    showTranslation: 'Ver tradução',
    translateError: 'Não foi possível traduzir. Tente novamente.',
    authorAnonymous: 'Membro da comunidade',
    translateAria: 'Traduzir esta sugestão para o meu idioma',
  },
  ja: {
    translateCta: '翻訳',
    translateLoading: '翻訳中…',
    showOriginal: '原文を表示',
    showTranslation: '翻訳を表示',
    translateError: '翻訳できませんでした。もう一度お試しください。',
    authorAnonymous: 'コミュニティメンバー',
    translateAria: 'この提案を自分の言語に翻訳',
  },
  zh: {
    translateCta: '翻译',
    translateLoading: '翻译中…',
    showOriginal: '查看原文',
    showTranslation: '查看译文',
    translateError: '翻译失败，请重试。',
    authorAnonymous: '社区成员',
    translateAria: '将此建议翻译成我的语言',
  },
};

const API = {
  fr: {
    translateNotFound: 'Suggestion introuvable.',
    translateSameLocale: 'Déjà dans votre langue.',
    translateEmpty: 'Rien à traduire.',
    translateParseError: 'Réponse de traduction invalide.',
    translateAiError: 'Erreur de traduction IA. Vérifiez la clé API.',
  },
  en: {
    translateNotFound: 'Suggestion not found.',
    translateSameLocale: 'Already in your language.',
    translateEmpty: 'Nothing to translate.',
    translateParseError: 'Invalid translation response.',
    translateAiError: 'AI translation failed. Check your API key.',
  },
  es: {
    translateNotFound: 'Sugerencia no encontrada.',
    translateSameLocale: 'Ya está en tu idioma.',
    translateEmpty: 'No hay nada que traducir.',
    translateParseError: 'Respuesta de traducción no válida.',
    translateAiError: 'Error de traducción por IA. Compruebe la clave API.',
  },
  de: {
    translateNotFound: 'Vorschlag nicht gefunden.',
    translateSameLocale: 'Bereits in Ihrer Sprache.',
    translateEmpty: 'Nichts zu übersetzen.',
    translateParseError: 'Ungültige Übersetzungsantwort.',
    translateAiError: 'KI-Übersetzung fehlgeschlagen. API-Schlüssel prüfen.',
  },
  it: {
    translateNotFound: 'Suggerimento non trovato.',
    translateSameLocale: 'Già nella tua lingua.',
    translateEmpty: 'Niente da tradurre.',
    translateParseError: 'Risposta di traduzione non valida.',
    translateAiError: 'Traduzione IA non riuscita. Controlla la chiave API.',
  },
  pt: {
    translateNotFound: 'Sugestão não encontrada.',
    translateSameLocale: 'Já está no seu idioma.',
    translateEmpty: 'Nada para traduzir.',
    translateParseError: 'Resposta de tradução inválida.',
    translateAiError: 'Falha na tradução por IA. Verifique a chave API.',
  },
  ja: {
    translateNotFound: '提案が見つかりません。',
    translateSameLocale: 'すでに表示言語と同じです。',
    translateEmpty: '翻訳する内容がありません。',
    translateParseError: '翻訳の応答が無効です。',
    translateAiError: 'AI 翻訳に失敗しました。API キーを確認してください。',
  },
  zh: {
    translateNotFound: '未找到该建议。',
    translateSameLocale: '已是您使用的语言。',
    translateEmpty: '没有可翻译的内容。',
    translateParseError: '翻译响应无效。',
    translateAiError: 'AI 翻译失败，请检查 API 密钥。',
  },
};

for (const loc of LOCALES) {
  const p = path.join(dir, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Suggestions = j.Suggestions ?? {};
  j.Suggestions.list = { ...(j.Suggestions.list ?? {}), ...LIST[loc] };
  j.ApiAppSuggestions = { ...(j.ApiAppSuggestions ?? {}), ...API[loc] };
  delete j.Suggestions.list.originalLanguageHint;
  fs.writeFileSync(p, JSON.stringify(j));
}

console.log('Patched Suggestions.list + ApiAppSuggestions (translate/author).');
