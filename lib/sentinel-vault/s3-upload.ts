import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { CopyObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { SentinelVaultS3Config } from './config';

export function createVaultS3Client(cfg: SentinelVaultS3Config): S3Client {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
}

export async function putEncryptedObject(
  client: S3Client,
  cfg: SentinelVaultS3Config,
  key: string,
  body: Buffer,
  storageClass?: 'STANDARD' | 'INTELLIGENT_TIERING' | 'GLACIER_IR'
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      StorageClass: storageClass,
      ContentType: 'application/octet-stream',
    })
  );
}

/** Upload depuis disque (flux lecture) pour ne pas charger l’objet chiffré en RAM. */
export async function putEncryptedObjectFromFile(
  client: S3Client,
  cfg: SentinelVaultS3Config,
  key: string,
  filePath: string,
  storageClass?: 'STANDARD' | 'INTELLIGENT_TIERING' | 'GLACIER_IR'
): Promise<{ contentLength: number }> {
  const st = await stat(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentLength: st.size,
      StorageClass: storageClass,
      ContentType: 'application/octet-stream',
    })
  );
  return { contentLength: st.size };
}

export async function copyToMonthlyIntelligentTier(
  client: S3Client,
  cfg: SentinelVaultS3Config,
  sourceKey: string,
  destKey: string
): Promise<void> {
  await client.send(
    new CopyObjectCommand({
      Bucket: cfg.bucket,
      Key: destKey,
      CopySource: `${cfg.bucket}/${sourceKey}`,
      StorageClass: 'INTELLIGENT_TIERING',
      MetadataDirective: 'COPY',
    })
  );
}
