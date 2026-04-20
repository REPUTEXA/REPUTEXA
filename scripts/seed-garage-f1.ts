/**
 * Garage F1 — seed de charge (tickets support + avis) pour stresser le dashboard marchand
 * et les flux liés aux avis. Destiné au staging / bench local uniquement.
 *
 * Prérequis : DATABASE_URL (connexion Postgres avec schémas auth + public, ex. string Prisma Supabase).
 *
 *   npm run seed:garage-f1 -- --confirm --user-id=<uuid-auth.users>
 *
 * Variables optionnelles :
 *   SEED_MERCHANT_USER_ID — UUID par défaut si --user-id omis
 *
 * Options :
 *   --tickets=N   (défaut 10000)
 *   --reviews=N   (défaut 5000)
 *   --establishment-id=<uuid> — rattache les avis à un établissement (doit appartenir au user)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TAG = 'GF1-SEED';

function parseArgs(argv: string[]) {
  const flags = new Map<string, string | boolean>();
  for (const a of argv) {
    if (a === '--confirm') flags.set('confirm', true);
    else if (a === '--help' || a === '-h') flags.set('help', true);
    else {
      const m = a.match(/^--([^=]+)=(.*)$/);
      if (m) flags.set(m[1], m[2]);
    }
  }
  return flags;
}

function intFlag(flags: Map<string, string | boolean>, key: string, fallback: number): number {
  const v = flags.get(key);
  if (v === undefined || v === true || v === false) return fallback;
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid --${key}=${v}`);
  return n;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.get('help')) {
    console.log(`
Garage F1 — seed tickets + avis (staging)

  npm run seed:garage-f1 -- --confirm --user-id=<uuid>

  --tickets=10000  --reviews=5000
  --establishment-id=<uuid>  (optionnel, sinon profil principal / establishment_id NULL)

  Env : DATABASE_URL | DIRECT_URL, SEED_MERCHANT_USER_ID (optionnel)
`);
    process.exit(0);
  }

  if (!flags.get('confirm')) {
    console.error('Refusé : ajoutez --confirm (données fictives en base).');
    process.exit(1);
  }

  const ticketCount = intFlag(flags, 'tickets', 10_000);
  const reviewCount = intFlag(flags, 'reviews', 5000);

  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL ou DIRECT_URL manquant.');
    process.exit(1);
  }

  const userId = String(flags.get('user-id') ?? process.env.SEED_MERCHANT_USER_ID ?? '').trim();
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    console.error('UUID marchand requis : --user-id=<uuid> ou SEED_MERCHANT_USER_ID.');
    process.exit(1);
  }

  const establishmentRaw = flags.get('establishment-id');
  const establishmentId =
    establishmentRaw === undefined || establishmentRaw === true || establishmentRaw === false
      ? null
      : String(establishmentRaw).trim() || null;
  if (establishmentId && !/^[0-9a-f-]{36}$/i.test(establishmentId)) {
    console.error('--establishment-id doit être un UUID valide.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const userCheck = await client.query<{ ok: number }>(
      'SELECT 1 AS ok FROM auth.users WHERE id = $1::uuid LIMIT 1',
      [userId]
    );
    if (!userCheck.rowCount) {
      console.error(`Aucun auth.users pour id=${userId}`);
      process.exit(1);
    }

    if (establishmentId) {
      const est = await client.query<{ ok: number }>(
        'SELECT 1 AS ok FROM public.establishments WHERE id = $1::uuid AND user_id = $2::uuid LIMIT 1',
        [establishmentId, userId]
      );
      if (!est.rowCount) {
        console.error("establishment_id invalide ou ne correspond pas au user_id.");
        process.exit(1);
      }
    }

    console.log(`Garage F1 : ${ticketCount} tickets, ${reviewCount} avis → user ${userId}${establishmentId ? `, établissement ${establishmentId}` : ' (profil principal)'}…`);

    await client.query('BEGIN');

    await client.query(
      `
      INSERT INTO public.tickets (user_id, status, title, created_at, updated_at, gravity_score)
      SELECT
        $1::uuid,
        CASE WHEN random() < 0.72 THEN 'open' ELSE 'archived' END,
        '${TAG} ticket #' || gs.n::text,
        c_at,
        c_at + (random() * interval '30 days'),
        (floor(random() * 101))::smallint
      FROM generate_series(1, $2::int) AS gs(n)
      CROSS JOIN LATERAL (
        SELECT (now() - (random() * interval '200 days')) AS c_at
      ) t
      `,
      [userId, ticketCount]
    );

    await client.query(
      `
      INSERT INTO public.reviews (
        user_id,
        reviewer_name,
        rating,
        comment,
        source,
        created_at,
        response_text,
        status,
        establishment_id
      )
      SELECT
        $1::uuid,
        '${TAG} client ' || gs.n::text,
        (1 + floor(random() * 5))::int,
        '${TAG} #' || gs.n::text || E'\\n' || repeat('Benchmark dashboard & réponses IA. ', (3 + floor(random() * 8))::integer),
        (ARRAY['google', 'facebook', 'trustpilot']::text[])[1 + floor(random() * 3)],
        c_at,
        CASE
          WHEN random() < 0.38 THEN 'Merci pour votre retour, nous prenons note avec attention.'
          ELSE NULL
        END,
        (ARRAY['pending', 'generating', 'scheduled', 'published', 'pending_publication']::text[])[
          1 + floor(random() * 5)
        ],
        $3::uuid
      FROM generate_series(1, $2::int) AS gs(n)
      CROSS JOIN LATERAL (
        SELECT (now() - (random() * interval '150 days')) AS c_at
      ) t
      `,
      [userId, reviewCount, establishmentId]
    );

    await client.query('COMMIT');
    console.log('Terminé — commit OK.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
