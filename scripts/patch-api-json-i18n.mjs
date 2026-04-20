/**
 * Remplace les chaînes d'erreur API connues par apiJsonError(request, key, status).
 * Prérequis : le handler doit déclarer `request` (ajouter manuellement si besoin).
 */
import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'app', 'api');

/** [literal, apiKey, status] — clés plates Api.* ou errors.* (nested) */
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

const IMPORT_LINE = "import { apiJsonError, apiJsonMessage } from '@/lib/api/api-error-response';";

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) walk(p, out);
    else if (n.name.endsWith('.ts') && !n.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes('NextResponse.json({ error:') && !s.includes("NextResponse.json({ error:") && !s.includes('message:')) continue;
  const orig = s;
  for (const [from, to] of RULES) {
    if (from.includes('Nothing to sweep')) continue;
    s = s.split(from).join(to);
  }
  if (s !== orig) {
    if (!s.includes("apiJsonError") && !s.includes('apiJsonMessage')) {
      /* noop */
    } else if (!s.includes('@/lib/api/api-error-response')) {
      const nl = s.indexOf('\n');
      const firstLine = s.slice(0, nl);
      if (firstLine.startsWith('import ')) {
        s = IMPORT_LINE + '\n' + s;
      } else {
        s = IMPORT_LINE + '\n\n' + s;
      }
    }
    fs.writeFileSync(file, s);
    changed++;
    console.log('patched', path.relative(process.cwd(), file));
  }
}

console.log('files changed', changed);
