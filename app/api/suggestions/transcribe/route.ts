import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { apiIaJsonError, apiJsonError } from '@/lib/api/api-error-response';
import { classifyOpenAiIaFailure } from '@/lib/api/classify-openai-ia-error';

/**
 * POST /api/suggestions/transcribe
 * Transcrit un audio avec Whisper. Body: FormData avec champ "audio" (fichier).
 */
function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const audio = form.get('audio');
  if (!audio || !(audio instanceof Blob)) {
    return apiJsonError(request, 'errors.audioRequired', 400);
  }

  const openai = getOpenAI();
  if (!openai) {
    return apiIaJsonError(request, 'openAiNotConfigured', 503);
  }

  const ext = audio.type?.includes('webm') ? 'webm' : audio.type?.includes('mp4') ? 'mp4' : 'ogg';
  const file = new File([audio], `audio.${ext}`, { type: audio.type || `audio/${ext}` });

  try {
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'fr',
    });

    const text = typeof transcription === 'string' ? transcription : transcription.text;
    return NextResponse.json({ transcript: text ?? '' });
  } catch (e) {
    console.error('[suggestions/transcribe]', e);
    const key = classifyOpenAiIaFailure(e);
    return apiIaJsonError(request, key, 503);
  }
}
