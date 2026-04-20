import OpenAI, { toFile } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcrit un fichier audio depuis une URL (ex: Twilio MediaUrl).
 * Supporte .ogg, .mp4, .mpeg, .wav, etc.
 *
 * Pour Twilio: l'URL nécessite une auth Basic (AccountSid:AuthToken).
 */
export async function transcribeAudioFromUrl(
  mediaUrl: string,
  options?: {
    twilioAuth?: { accountSid: string; authToken: string };
    language?: string;
  }
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const headers: Record<string, string> = {};
  if (options?.twilioAuth) {
    const { accountSid, authToken } = options.twilioAuth;
    const encoded = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    headers['Authorization'] = `Basic ${encoded}`;
  }

  console.log('[Transcription] Envoi à Whisper...');
  const res = await fetch(mediaUrl, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch audio: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') ?? 'audio/ogg';
  const ext = contentType.includes('ogg') ? 'ogg' : contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'ogg';

  const file = await toFile(res, `audio.${ext}`);

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: options?.language ?? 'fr',
  });

  return typeof transcription === 'string' ? transcription : transcription.text;
}

/**
 * Transcrit un buffer audio (ex: enregistrement vocal du formulaire contact).
 * Supporte .webm, .ogg, .mp3, .wav, .m4a, etc.
 */
export async function transcribeAudioFromBuffer(
  buffer: Buffer | Uint8Array,
  options?: { filename?: string; language?: string }
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const ext = options?.filename?.split('.').pop()?.toLowerCase() || 'webm';
  const safeExt = ['webm', 'ogg', 'mp3', 'wav', 'm4a', 'mp4', 'mpeg'].includes(ext) ? ext : 'webm';
  const file = await toFile(buf, `audio.${safeExt}`);

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: options?.language ?? 'fr',
  });

  return typeof transcription === 'string' ? transcription : transcription.text;
}
