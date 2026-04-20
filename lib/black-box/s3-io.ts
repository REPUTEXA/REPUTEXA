import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { SentinelVaultS3Config } from '@/lib/sentinel-vault/config';
import { getSentinelVaultS3Config } from '@/lib/sentinel-vault/config';
import { createVaultS3Client } from '@/lib/sentinel-vault/s3-upload';

export function getBlackBoxS3Config(): SentinelVaultS3Config | null {
  return getSentinelVaultS3Config();
}

export async function putGzipArchive(
  bucket: string,
  key: string,
  body: Buffer,
  storageClass: 'STANDARD' | 'INTELLIGENT_TIERING' = (
    process.env.BLACK_BOX_S3_STORAGE_CLASS === 'INTELLIGENT_TIERING' ? 'INTELLIGENT_TIERING' : 'STANDARD'
  )
): Promise<void> {
  const cfg = getBlackBoxS3Config();
  if (!cfg) throw new Error('Stockage S3/R2 non configuré (BACKUP_S3_*)');
  const client = createVaultS3Client(cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/gzip',
      StorageClass: storageClass,
    })
  );
}

export async function getGzipArchive(bucket: string, key: string): Promise<Buffer> {
  const cfg = getBlackBoxS3Config();
  if (!cfg) throw new Error('Stockage S3/R2 non configuré (BACKUP_S3_*)');
  if (cfg.bucket !== bucket) {
    throw new Error('Bucket incohérent avec la configuration');
  }
  const client = createVaultS3Client(cfg);
  const out = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  const stream = out.Body;
  if (!stream) throw new Error('Réponse S3 vide');
  if (typeof (stream as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    const bytes = await (stream as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}
