import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { transcribeAudioFromBuffer } from '@/lib/whisper';
import { checkContactRateLimit } from '@/lib/rate-limit';

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/mp3'];

export async function POST(request: Request) {
  try {
    const { ok: rateOk } = checkContactRateLimit(request);
    if (!rateOk) {
      return apiJsonError(request, 'errors.contactRateLimited', 429);
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return apiJsonError(request, 'errors.multipartRequired', 400);
    }

    const form = await request.formData().catch(() => null);
    if (!form) {
      return apiJsonError(request, 'errors.invalidForm', 400);
    }

    const audio = form.get('audio');
    if (!(audio instanceof File) || audio.size === 0) {
      return apiJsonError(request, 'errors.audioRequired', 400);
    }

    if (audio.size > MAX_SIZE) {
      return apiJsonError(request, 'errors.audioTooLarge', 400);
    }

    const mime = audio.type.toLowerCase();
    if (!ALLOWED_TYPES.some((t) => mime.includes(t.split('/')[1]))) {
      return apiJsonError(request, 'errors.audioFormatUnsupported', 400);
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
    return apiJsonError(request, 'errors.transcriptionFailed', 500);
  }
}
