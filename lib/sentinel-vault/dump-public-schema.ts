import { createWriteStream, promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { finished } from 'stream/promises';
import { Client } from 'pg';
import { to as copyTo } from 'pg-copy-streams';
import { getSentinelDatabaseUrl, getSentinelVaultExcludeTables } from './config';

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

async function listPublicTables(client: Client): Promise<string[]> {
  const r = await client.query<{ name: string }>(
    `SELECT c.relname AS name
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
     ORDER BY c.relname`
  );
  const exclude = getSentinelVaultExcludeTables();
  return r.rows.map((x) => x.name).filter((name) => !exclude.has(name.toLowerCase()));
}

export async function dumpPublicSchemaToFile(outFile: string): Promise<{ bytes: number; tables: number }> {
  const connectionString = getSentinelDatabaseUrl();
  if (!connectionString) throw new Error('SENTINEL_DATABASE_URL ou DATABASE_URL manquant');

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
    statement_timeout: 0,
    query_timeout: 0,
  });
  await client.connect();

  const ws = createWriteStream(outFile, { flags: 'w' });
  const tables = await listPublicTables(client);

  ws.write(
    `-- Sentinel Vault — sauvegarde logique (schéma public, COPY CSV)\n-- UTC: ${new Date().toISOString()}\n-- Restauration : appliquer d'abord les migrations ; puis psql ce fichier. Si erreurs FK, SET session_replication_role = replica; ou réordonner les tables.\n\nBEGIN;\n\n`
  );

  try {
    for (const table of tables) {
      const qualified = `public.${quoteIdent(table)}`;
      ws.write(`\n-- ${qualified}\nCOPY ${qualified} FROM stdin WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');\n`);
      const sql = `COPY ${qualified} TO STDOUT WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')`;
      const stream = client.query(copyTo(sql));
      stream.pipe(ws, { end: false });
      await finished(stream);
      ws.write('\n\\.\n');
    }
    ws.write('\nCOMMIT;\n');
  } finally {
    await new Promise<void>((resolve, reject) => {
      ws.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
    await client.end().catch(() => undefined);
  }

  const st = await fs.stat(outFile);
  return { bytes: st.size, tables: tables.length };
}

export function newTempDumpPath(): string {
  return path.join(os.tmpdir(), `sentinel-vault-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.sql`);
}
