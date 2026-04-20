/**
 * Browser Web Speech API (Chrome / Edge: full support; Safari: partial).
 * Used for live captions while recording — server-side Whisper remains the fallback after upload.
 *
 * Main class is not always declared in TypeScript’s `lib.dom` (prefix vendor variants vary).
 */
type SpeechRecognitionConstructor = new () => EventTarget;

/**
 * Returns the `SpeechRecognition` constructor if the runtime exposes it (including webkit-prefixed).
 */
export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Map next-intl locale (e.g. fr, en-gb) to BCP 47 for recognition. */
export function appLocaleToSpeechLang(appLocale: string): string {
  const l = appLocale.toLowerCase();
  if (l.startsWith('fr')) return 'fr-FR';
  if (l.startsWith('de')) return 'de-DE';
  if (l.startsWith('es')) return 'es-ES';
  if (l.startsWith('it')) return 'it-IT';
  if (l.startsWith('pt')) return 'pt-PT';
  if (l.startsWith('ja')) return 'ja-JP';
  if (l.startsWith('zh')) return 'zh-CN';
  if (l === 'en-gb' || l.startsWith('en-gb')) return 'en-GB';
  if (l.startsWith('en')) return 'en-US';
  return 'fr-FR';
}
