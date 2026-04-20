/**
 * Dashboard.bananoLoyaltyAi — absence buckets, consigne langue OpenAI, welcome-back WhatsApp.
 * node scripts/merge-banano-loyalty-ai-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES = path.join(__dirname, '..', 'messages');

const PACK = {
  fr: {
    ai_output_language_instruction:
      'You MUST write your entire response in French. Use informal "tu", "ton", "ta" as in everyday WhatsApp between a neighbourhood shop and a regular.',
    absence_d120: 'plusieurs mois',
    absence_d60: 'un bon moment',
    absence_d35: 'plus d’un mois',
    absence_d21: 'quelques semaines',
    absence_d14: 'une quinzaine de jours',
    absence_d0: 'quelques jours',
    welcome_back_fallback_middle:
      'on est vraiment contents de vous revoir parmi nous après une pause, votre fidélité, ça compte pour toute l’équipe.',
    welcome_back_greeting_named: 'Bonjour {prenom}, c’est {commerceName}.',
    welcome_back_greeting_anon: 'Bonjour, c’est {commerceName}.',
    welcome_back_closing: 'Merci d’être là, à très vite !',
  },
  en: {
    ai_output_language_instruction:
      'You MUST write your entire response in English. Warm, natural "you"; like a friendly local shop texting a regular.',
    absence_d120: 'several months',
    absence_d60: 'a good while',
    absence_d35: 'over a month',
    absence_d21: 'a few weeks',
    absence_d14: 'a couple of weeks',
    absence_d0: 'a few days',
    welcome_back_fallback_middle:
      "we're really glad to see you back after some time away, your loyalty means a lot to the whole team.",
    welcome_back_greeting_named: 'Hi {prenom}, it’s {commerceName}.',
    welcome_back_greeting_anon: 'Hi, it’s {commerceName}.',
    welcome_back_closing: 'Thanks for stopping by, see you soon!',
  },
  it: {
    ai_output_language_instruction:
      'You MUST write your entire response in Italian. Use informal "tu", "tuo", "tua" as in WhatsApp between a local shop and a regular customer.',
    absence_d120: 'diversi mesi',
    absence_d60: 'un bel po’ di tempo',
    absence_d35: 'più di un mese',
    absence_d21: 'qualche settimana',
    absence_d14: 'circa due settimane',
    absence_d0: 'qualche giorno',
    welcome_back_fallback_middle:
      'siamo davvero contenti di rivederti dopo una pausa, la tua fedeltà conta per tutta la squadra.',
    welcome_back_greeting_named: 'Ciao {prenom}, siamo {commerceName}.',
    welcome_back_greeting_anon: 'Ciao, siamo {commerceName}.',
    welcome_back_closing: 'Grazie di essere passato, a presto!',
  },
  es: {
    ai_output_language_instruction:
      'You MUST write your entire response in Spanish. Use informal "tú" as in WhatsApp between a local shop and a regular customer (Spain/LatAm neutral).',
    absence_d120: 'varios meses',
    absence_d60: 'un buen tiempo',
    absence_d35: 'más de un mes',
    absence_d21: 'unas semanas',
    absence_d14: 'unas dos semanas',
    absence_d0: 'unos días',
    welcome_back_fallback_middle:
      'nos alegra mucho verte de nuevo tras un tiempo sin venir, tu fidelidad importa a todo el equipo.',
    welcome_back_greeting_named: 'Hola {prenom}, somos {commerceName}.',
    welcome_back_greeting_anon: 'Hola, somos {commerceName}.',
    welcome_back_closing: 'Gracias por pasar, ¡hasta pronto!',
  },
  de: {
    ai_output_language_instruction:
      'You MUST write your entire response in German. Use informal "du" / "dein" as in WhatsApp between a local shop and a regular customer.',
    absence_d120: 'mehrere Monate',
    absence_d60: 'eine ganze Weile',
    absence_d35: 'über einen Monat',
    absence_d21: 'ein paar Wochen',
    absence_d14: 'so zwei Wochen',
    absence_d0: 'ein paar Tage',
    welcome_back_fallback_middle:
      'wir freuen uns wirklich, dich nach einer Pause wiederzusehen, deine Treue bedeutet dem ganzen Team viel.',
    welcome_back_greeting_named: 'Hallo {prenom}, hier ist {commerceName}.',
    welcome_back_greeting_anon: 'Hallo, hier ist {commerceName}.',
    welcome_back_closing: 'Schön, dass du da warst, bis bald!',
  },
  pt: {
    ai_output_language_instruction:
      'You MUST write your entire response in Portuguese. Use informal "tu" / "teu" as in WhatsApp between a local shop and a regular (European Portuguese tone).',
    absence_d120: 'vários meses',
    absence_d60: 'um bom tempo',
    absence_d35: 'mais de um mês',
    absence_d21: 'algumas semanas',
    absence_d14: 'cerca de duas semanas',
    absence_d0: 'alguns dias',
    welcome_back_fallback_middle:
      'ficamos muito contentes por te ver de novo depois de uma pausa, a tua fidelidade conta para toda a equipa.',
    welcome_back_greeting_named: 'Olá {prenom}, aqui é o {commerceName}.',
    welcome_back_greeting_anon: 'Olá, aqui é o {commerceName}.',
    welcome_back_closing: 'Obrigado por apareceres, até breve!',
  },
  ja: {
    ai_output_language_instruction:
      'You MUST write your entire response in Japanese. Polite but warm plain style (です/ます) suitable for a shop LINE/WhatsApp to a regular.',
    absence_d120: '数か月ぶり',
    absence_d60: 'しばらく',
    absence_d35: '1か月以上',
    absence_d21: '数週間',
    absence_d14: '約2週間',
    absence_d0: '数日',
    welcome_back_fallback_middle:
      'しばらくぶりのご来店、本当にうれしいです。いつもありがとうございます。',
    welcome_back_greeting_named: '{prenom}さん、{commerceName}です。',
    welcome_back_greeting_anon: 'お客様、{commerceName}です。',
    welcome_back_closing: 'またお待ちしています。',
  },
  zh: {
    ai_output_language_instruction:
      'You MUST write your entire response in Simplified Chinese. Warm, concise tone like a neighbourhood shop messaging a regular on WeChat/WhatsApp.',
    absence_d120: '好几个月',
    absence_d60: '好一阵子',
    absence_d35: '一个多月',
    absence_d21: '几周',
    absence_d14: '大约两周',
    absence_d0: '几天',
    welcome_back_fallback_middle:
      '隔了这么久又见到你真高兴，你一直支持我们，团队都很感激。',
    welcome_back_greeting_named: '你好{prenom}，这里是{commerceName}。',
    welcome_back_greeting_anon: '你好，这里是{commerceName}。',
    welcome_back_closing: '感谢光临，回头见！',
  },
};

for (const loc of ['fr', 'en', 'de', 'es', 'it', 'pt', 'ja', 'zh']) {
  const p = path.join(MESSAGES, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Dashboard = j.Dashboard || {};
  j.Dashboard.bananoLoyaltyAi = PACK[loc];
  fs.writeFileSync(p, JSON.stringify(j) + '\n');
  console.log('merged bananoLoyaltyAi', loc);
}
