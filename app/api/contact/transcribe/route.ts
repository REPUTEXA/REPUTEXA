import { NextResponse } from 'next/server';
import { transcribeAudioFromBuffer } from '@/lib/whisper';
import { checkContactRateLimit } from '@/lib/rate-limit';

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/mp3'];

export async function POST(request: Request) {
  try {
    const { ok: rateOk } = checkContactRateLimit(request);
    if (!rateOk) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans une minute.' },
        { status: 429 }
      );
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: 'Formulaire invalide' }, { status: 400 });
    }

    const audio = form.get('audio');
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json(
        { error: 'Fichier audio requis (champ "audio")' },
        { status: 400 }
      );
    }

    if (audio.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Fichier audio trop volumineux (max 25 Mo)' },
        { status: 400 }
      );
    }

    const mime = audio.type.toLowerCase();
    if (!ALLOWED_TYPES.some((t) => mime.includes(t.split('/')[1]))) {
      return NextResponse.json(
        { error: 'Format audio non supporté (webm, ogg, mp3, wav, m4a)' },
        { status: 400 }
      );
    }

    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const text = await transcribeAudioFromBuffer(buffer, {
      filename: audio.name,
      language: 'fr',
    });

    return NextResponse.json({ text: text.trim() });
  } catch (err) {
    console.error('[contact/transcribe]', err);
    return NextResponse.json(
      { error: 'Erreur lors de la transcription. Réessayez.' },
      { status: 500 }
    );
  }
}
