import { createReadStream, createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import { createCipheriv, randomBytes } from 'crypto';
import { Transform } from 'stream';
import { finished, pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

/**
 * Format objet identique à `encryptBufferAes256Gcm` : IV (12) || tag auth (16) || ciphertext.
 * Pipeline fichier : lecture SQL → gzip (flux) → AES-256-GCM (flux) → fichier ciphertext temporaire,
 * puis assemblage iv+tag+corpus sans charger le dump ni le gzip entier en RAM.
 */
export type GzipEncryptFileStats = {
  bytesPlain: number;
  bytesGzip: number;
  bytesEncrypted: number;
};

export async function gzipAndEncryptSqlFileToEncFile(
  sqlFilePath: string,
  encOutPath: string,
  key32: Buffer
): Promise<GzipEncryptFileStats> {
  if (key32.length !== 32) throw new Error('SENTINEL_VAULT_AES_KEY doit dériver en 32 octets');

  const plainStat = await fs.stat(sqlFilePath);
  const bytesPlain = plainStat.size;

  const ctPath = `${encOutPath}.cipher.tmp`;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key32, iv);

  let bytesGzip = 0;
  const gzipByteCounter = new Transform({
    transform(chunk, _enc, cb) {
      bytesGzip += chunk.length;
      cb(null, chunk);
    },
  });

  const rs = createReadStream(sqlFilePath);
  const gzip = createGzip({ level: 6 });

  try {
    await pipeline(rs, gzip, gzipByteCounter, cipher, createWriteStream(ctPath));
    const tag = cipher.getAuthTag();

    const out = createWriteStream(encOutPath);
    await new Promise<void>((resolve, reject) => {
      out.once('error', reject);
      out.write(iv, (e1) => {
        if (e1) {
          reject(e1);
          return;
        }
        out.write(tag, (e2) => (e2 ? reject(e2) : resolve()));
      });
    });

    await pipeline(createReadStream(ctPath), out);
    await finished(out);
  } finally {
    await fs.unlink(ctPath).catch(() => undefined);
  }

  const encStat = await fs.stat(encOutPath);
  return {
    bytesPlain,
    bytesGzip,
    bytesEncrypted: encStat.size,
  };
}
