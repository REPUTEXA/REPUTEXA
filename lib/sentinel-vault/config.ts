/**
 * Variables d’environnement (isolées du bucket applicatif) :
 * - SENTINEL_DATABASE_URL ou DIRECT_URL ou DATABASE_URL : Postgres **direct** Supabase port 5432 (pas le pooler transactionnel).
 * - BACKUP_S3_BUCKET, BACKUP_S3_REGION, BACKUP_S3_ACCESS_KEY_ID + BACKUP_S3_SECRET_ACCESS_KEY
 *   (aliases SENTINEL_VAULT_S3_* ; clé « dédiée backup » : BACKUP_S3_KEY + BACKUP_S3_SECRET_ACCESS_KEY si vous préférez).
 * - BACKUP_S3_ENDPOINT pour Cloudflare R2 (path-style activé automatiquement si endpoint défini ; sinon BACKUP_S3_FORCE_PATH_STYLE=1).
 * - SENTINEL_VAULT_AES_KEY : 64 caractères hex ou base64 de 32 octets.
 * - Option : SENTINEL_VAULT_EXCLUDE_TABLES=table1,table2
 * - Option : SENTINEL_VAULT_FORCE_MONTHLY=1 pour forcer la copie mensuelle (tests).
 * Rétention 30j / archives : règles de cycle de vie sur le bucket (vault/daily/* vs vault/monthly/*).
 */

export type SentinelVaultS3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** R2 ou endpoint compatible S3 (optionnel). */
  endpoint?: string;
  forcePathStyle?: boolean;
};

export function getSentinelVaultS3Config(): SentinelVaultS3Config | null {
  const bucket =
    process.env.BACKUP_S3_BUCKET?.trim() ||
    process.env.SENTINEL_VAULT_S3_BUCKET?.trim();
  const region =
    (process.env.BACKUP_S3_REGION ?? process.env.SENTINEL_VAULT_S3_REGION ?? 'auto').trim();
  const accessKeyId =
    process.env.BACKUP_S3_ACCESS_KEY_ID?.trim() ||
    process.env.BACKUP_S3_KEY?.trim() ||
    process.env.SENTINEL_VAULT_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey =
    process.env.BACKUP_S3_SECRET_ACCESS_KEY?.trim() ||
    process.env.SENTINEL_VAULT_S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) return null;

  const endpoint =
    process.env.BACKUP_S3_ENDPOINT?.trim() || process.env.SENTINEL_VAULT_S3_ENDPOINT?.trim() || undefined;

  const forcePathStyleExplicit =
    process.env.BACKUP_S3_FORCE_PATH_STYLE === '1' ||
    process.env.SENTINEL_VAULT_S3_FORCE_PATH_STYLE === '1';
  const forcePathStyleOff =
    process.env.BACKUP_S3_FORCE_PATH_STYLE === '0' ||
    process.env.SENTINEL_VAULT_S3_FORCE_PATH_STYLE === '0';
  /** R2 / MinIO : endpoint personnalisé → path-style par défaut (évite l’oubli de FORCE_PATH_STYLE=1). */
  const forcePathStyle = forcePathStyleOff
    ? false
    : forcePathStyleExplicit || (!!endpoint && endpoint.length > 0);

  return { bucket, region, accessKeyId, secretAccessKey, endpoint, forcePathStyle };
}

export function getSentinelDatabaseUrl(): string | null {
  const u =
    process.env.SENTINEL_DATABASE_URL?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  return u || null;
}

/** 32 octets : hex 64 ou base64. */
export function parseSentinelVaultAesKey(): Buffer | null {
  const raw = process.env.SENTINEL_VAULT_AES_KEY?.trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  try {
    const b = Buffer.from(raw, 'base64');
    return b.length === 32 ? b : null;
  } catch {
    return null;
  }
}

export function getSentinelVaultExcludeTables(): Set<string> {
  const s = process.env.SENTINEL_VAULT_EXCLUDE_TABLES?.trim();
  if (!s) return new Set();
  return new Set(
    s
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  );
}
