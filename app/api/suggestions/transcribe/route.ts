import { NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * POST /api/suggestions/transcribe
 * Transcrit un audio avec Whisper. Body: FormData avec champ "audio" (fichier).
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const audio = form.get('audio');
    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: 'Fichier audio requis' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Whisper non configuré' }, { status: 503 });
    }

    const ext = audio.type?.includes('webm') ? 'webm' : audio.type?.includes('mp4') ? 'mp4' : 'ogg';
    const file = new File([audio], `audio.${ext}`, { type: audio.type || `audio/${ext}` });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'fr',
    });

    const text = typeof transcription === 'string' ? transcription : transcription.text;
    return NextResponse.json({ transcript: text ?? '' });
  } catch (e) {
    console.error('[suggestions/transcribe]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur transcription' },
      { status: 500 }
    );
  }
}
