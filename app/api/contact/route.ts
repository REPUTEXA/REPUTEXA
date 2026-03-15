import { NextResponse } from 'next/server';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkContactRateLimit } from '@/lib/rate-limit';

const CONTACT_EMAIL = 'contact@reputexa.fr';
const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_TOTAL_SIZE = 35 * 1024 * 1024; // 35MB (Resend max 40MB after base64)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100);
}

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

    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const subject = String(form.get('subject') ?? '').trim();
    const message = String(form.get('message') ?? '').trim();

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Tous les champs sont obligatoires.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Adresse email invalide.' },
        { status: 400 }
      );
    }

    // Récupérer les pièces jointes
    const rawFiles = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
    if (rawFiles.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} fichiers autorisés.` },
        { status: 400 }
      );
    }

    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    let totalSize = 0;
    const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

    for (const file of rawFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Le fichier "${file.name}" dépasse 25 Mo.` },
          { status: 400 }
        );
      }
      totalSize += file.size;
      if (totalSize > MAX_TOTAL_SIZE) {
        return NextResponse.json(
          { error: 'Taille totale des pièces jointes trop volumineuse.' },
          { status: 400 }
        );
      }
      const mime = (file.type || '').toLowerCase();
      if (!allowedTypes.some((t) => mime.includes(t.split('/')[1]))) {
        return NextResponse.json(
          { error: `Type non supporté pour "${file.name}" (photos: jpg, png, webp, gif ; vidéos: mp4, webm).` },
          { status: 400 }
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      attachments.push({
        filename: sanitizeFilename(file.name),
        content: buf,
        contentType: file.type || 'application/octet-stream',
      });
    }

    if (!canSendEmail()) {
      return NextResponse.json(
        {
          error:
            'Le formulaire de contact est temporairement indisponible. Envoyez-nous un email à contact@reputexa.fr.',
        },
        { status: 503 }
      );
    }

    const contactId = crypto.randomUUID();
    const supabase = createAdminClient();
    const storagePaths: string[] = [];

    if (supabase && attachments.length > 0) {
      for (let i = 0; i < attachments.length; i++) {
        const a = attachments[i];
        const ext = a.filename.split('.').pop() || 'bin';
        const path = `${contactId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('contact-attachments')
          .upload(path, a.content, {
            contentType: a.contentType,
            upsert: false,
          });
        if (!uploadErr) {
          storagePaths.push(path);
        }
      }
    }

    if (supabase) {
      const { error: insertErr } = await supabase.from('contact_messages').insert({
        id: contactId,
        name,
        email,
        subject,
        message,
        attachment_paths: storagePaths,
      });
      if (insertErr) {
        console.error('[contact] DB insert error:', insertErr);
      }
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Nouveau message depuis le formulaire REPUTEXA</h2>
        <p><strong>Nom :</strong> ${escapeHtml(name)}</p>
        <p><strong>Email :</strong> ${escapeHtml(email)}</p>
        <p><strong>Sujet :</strong> ${escapeHtml(subject)}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;" />
        <p><strong>Message :</strong></p>
        <p style="white-space: pre-wrap; background: #f8fafc; padding: 1rem; border-radius: 8px;">${escapeHtml(message)}</p>
        ${attachments.length > 0 ? `<p style="margin-top: 1rem; color: #64748b;"><strong>Pièces jointes :</strong> ${attachments.map((a) => escapeHtml(a.filename)).join(', ')}</p>` : ''}
      </div>
    `;

    const { success, error } = await sendEmail({
      from: DEFAULT_FROM,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[REPUTEXA Contact] ${subject}`,
      html,
      attachments:
        attachments.length > 0
          ? attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              contentType: a.contentType,
            }))
          : undefined,
    });

    if (!success) {
      console.error('[contact] Envoi échoué:', error);
      return NextResponse.json(
        {
          error:
            "Une erreur est survenue lors de l'envoi. Réessayez ou contactez-nous à contact@reputexa.fr.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[contact]', err);
    return NextResponse.json(
      { error: "Une erreur est survenue. Veuillez réessayer." },
      { status: 500 }
    );
  }
}
