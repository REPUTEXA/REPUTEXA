/**
 * Applique les remplacements apiJsonError / apiJsonMessage + déballage NextResponse.json,
 * puis corrige les doubles parenthèses `401));` → `401);`.
 */
import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'app', 'api');

const RULES = [
  ["{ error: 'Unauthorized' }, { status: 401 }", "apiJsonError(request, 'unauthorized', 401)"],
  ['{ error: "Unauthorized" }, { status: 401 }', "apiJsonError(request, 'unauthorized', 401)"],
  ["{ error: 'Forbidden' }, { status: 403 }", "apiJsonError(request, 'forbidden', 403)"],
  ['{ error: "Forbidden" }, { status: 403 }', "apiJsonError(request, 'forbidden', 403)"],
  ["{ error: 'Invalid JSON' }, { status: 400 }", "apiJsonError(request, 'invalidJson', 400)"],
  ['{ error: "Invalid JSON" }, { status: 400 }', "apiJsonError(request, 'invalidJson', 400)"],
  ["{ error: 'Review not found' }, { status: 404 }", "apiJsonError(request, 'errors.reviewNotFound', 404)"],
  ['{ error: "Review not found" }, { status: 404 }', "apiJsonError(request, 'errors.reviewNotFound', 404)"],
  ["{ error: 'Supabase admin not configured' }, { status: 500 }", "apiJsonError(request, 'supabaseAdminNotConfigured', 500)"],
  ['{ error: "Supabase admin not configured" }, { status: 500 }', "apiJsonError(request, 'supabaseAdminNotConfigured', 500)"],
  ["{ error: 'Admin client not configured' }, { status: 500 }", "apiJsonError(request, 'supabaseAdminNotConfigured', 500)"],
  ['{ error: "Admin client not configured" }, { status: 500 }', "apiJsonError(request, 'supabaseAdminNotConfigured', 500)"],
  ["{ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 }", "apiJsonError(request, 'stripeSecretNotConfigured', 500)"],
  ['{ error: "STRIPE_SECRET_KEY not configured" }, { status: 500 }', "apiJsonError(request, 'stripeSecretNotConfigured', 500)"],
  ["{ error: 'Missing id' }, { status: 400 }", "apiJsonError(request, 'missingId', 400)"],
  ['{ error: "Missing id" }, { status: 400 }', "apiJsonError(request, 'missingId', 400)"],
  ["{ error: 'Invalid messages' }, { status: 400 }", "apiJsonError(request, 'errors.invalidMessages', 400)"],
  ['{ error: "Invalid messages" }, { status: 400 }', "apiJsonError(request, 'errors.invalidMessages', 400)"],
  ["{ error: 'Non authentifié.' }, { status: 401 }", "apiJsonError(request, 'unauthorized', 401)"],
  ["{ error: 'JSON invalide.' }, { status: 400 }", "apiJsonError(request, 'invalidJson', 400)"],
  ["{ error: 'Accès réservé aux administrateurs.' }, { status: 403 }", "apiJsonError(request, 'errors.adminAccessOnly', 403)"],
  ["{ error: 'Client admin non configuré.' }, { status: 500 }", "apiJsonError(request, 'supabaseAdminNotConfigured', 500)"],
  ["{ error: 'Admin non configuré' }, { status: 500 }", "apiJsonError(request, 'errors.adminNotConfiguredShort', 500)"],
  ["{ error: 'Service indisponible' }, { status: 503 }", "apiJsonError(request, 'serviceUnavailable', 503)"],
  ["{ error: 'Service indisponible.' }, { status: 503 }", "apiJsonError(request, 'errors.serviceUnavailableDot', 503)"],
  ["{ error: 'Introuvable' }, { status: 404 }", "apiJsonError(request, 'errors.resourceNotFoundShort', 404)"],
  ["{ error: 'Supabase admin non configuré' }, { status: 500 }", "apiJsonError(request, 'supabaseAdminNotConfigured', 500)"],
  ["{ error: 'Admin client non configuré' }, { status: 500 }", "apiJsonError(request, 'supabaseAdminNotConfigured', 500)"],
  ["{ error: 'Admin client unavailable' }, { status: 500 }", "apiJsonError(request, 'supabaseAdminNotConfigured', 500)"],
  ["{ error: 'Invalid locale' }, { status: 400 }", "apiJsonError(request, 'errors.invalidLocale', 400)"],
  ["{ ok: true, message: 'Resend not configured, skip emails' }, { status: 200 }", "apiJsonMessage(request, 'trialEmails_resendSkip', 200)"],
  ["{ ok: true, message: 'Resend not configured' }, { status: 200 }", "apiJsonMessage(request, 'trialEmails_resendSkip', 200)"],
];

const IMPORT = "import { apiJsonError, apiJsonMessage } from '@/lib/api/api-error-response';\n";

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) walk(p, out);
    else if (n.name.endsWith('.ts') && !n.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

for (const file of walk(root)) {
  let s = fs.readFileSync(file, 'utf8');
  const orig = s;
  for (const [a, b] of RULES) {
    s = s.split(a).join(b);
  }
  s = s.split('NextResponse.json(apiJsonError(').join('apiJsonError(');
  s = s.split('NextResponse.json(apiJsonMessage(').join('apiJsonMessage(');
  s = s.replace(/, (\d{3})\)\) as const/g, ', $1) as const');
  if (s !== orig) {
    if ((s.includes('apiJsonError') || s.includes('apiJsonMessage')) && !s.includes('@/lib/api/api-error-response')) {
      s = IMPORT + s;
    }
    fs.writeFileSync(file, s);
  }
}
