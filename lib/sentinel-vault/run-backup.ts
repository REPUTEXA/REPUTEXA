import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appendActivity, loadSecurityPerfectionState, saveSecurityPerfectionState } from '@/lib/admin/security-perfection-state';
import { getSentinelVaultS3Config, parseSentinelVaultAesKey } from './config';
import { dumpPublicSchemaToFile, newTempDumpPath } from './dump-public-schema';
import { gzipAndEncryptSqlFileToEncFile } from './gzip-encrypt-stream-file';
import { notifySentinelVaultFailure } from './notify-failure';
import { copyToMonthlyIntelligentTier, createVaultS3Client, putEncryptedObjectFromFile } from './s3-upload';

function newTempEncPath(): string {
  return path.join(os.tmpdir(), `sentinel-vault-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.enc`);
}

export type RunSentinelVaultResult =
  | { ok: true; skipped: true; reason: string; durationMs: number }
  | { ok: true; skipped?: false; s3Key: string; monthlyMirror: boolean; bytesEncrypted: number; durationMs: number }
  | { ok: false; error: string; durationMs: number };

function utcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function runSentinelVaultBackup(admin: SupabaseClient): Promise<RunSentinelVaultResult> {
  const t0 = Date.now();
  const s3cfg = getSentinelVaultS3Config();
  const aesKey = parseSentinelVaultAesKey();

  if (!s3cfg || !aesKey) {
    return {
      ok: true,
      skipped: true,
      reason: 'Sentinel Vault désactivé (BACKUP_S3_* + SENTINEL_VAULT_AES_KEY requis).',
      durationMs: Date.now() - t0,
    };
  }

  const sqlPath = newTempDumpPath();
  const encPath = newTempEncPath();
  let runId: string | null = null;

  try {
    const { error: insErr, data: ins } = await admin
      .from('sentinel_vault_runs')
      .insert({
        status: 'running',
        s3_bucket: s3cfg.bucket,
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('[sentinel-vault] insert run', insErr);
    } else if (ins?.id) {
      runId = ins.id as string;
    }

    const { bytes: plainBytes, tables } = await dumpPublicSchemaToFile(sqlPath);
    const { bytesPlain: _bytesPlain, bytesGzip, bytesEncrypted } = await gzipAndEncryptSqlFileToEncFile(
      sqlPath,
      encPath,
      aesKey
    );

    const now = new Date();
    const day = utcDayKey(now);
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const s3Key = `vault/daily/${day}/reputexa-${stamp}.enc`;

    const client = createVaultS3Client(s3cfg);
    await putEncryptedObjectFromFile(client, s3cfg, s3Key, encPath, 'STANDARD');

    let monthlyMirror = false;
    let monthlyKey: string | null = null;
    const forceMonthly = process.env.SENTINEL_VAULT_FORCE_MONTHLY === '1';
    if (now.getUTCDate() === 1 || forceMonthly) {
      monthlyKey = `vault/monthly/${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}.enc`;
      try {
        await copyToMonthlyIntelligentTier(client, s3cfg, s3Key, monthlyKey);
        monthlyMirror = true;
      } catch (e) {
        console.error('[sentinel-vault] monthly copy', e);
      }
    }

    const durationMs = Date.now() - t0;

    if (runId) {
      await admin
        .from('sentinel_vault_runs')
        .update({
          status: 'ok',
          s3_key_daily: s3Key,
          s3_key_monthly: monthlyKey,
          bytes_plain: plainBytes,
          bytes_gzip: bytesGzip,
          bytes_encrypted: bytesEncrypted,
          duration_ms: durationMs,
          error_message: null,
        })
        .eq('id', runId);
    }

    let state = await loadSecurityPerfectionState(admin);
    state = appendActivity(state, [
      {
        at: new Date().toISOString(),
        kind: 'vault_ok',
        message: `Sentinel Vault — sauvegarde chiffrée OK (${tables} tables, gzip ${bytesGzip} o → chiffré ${bytesEncrypted} o) → ${s3Key}${monthlyMirror ? ' · miroir mensuel Intelligent-Tiering' : ''}`,
      },
    ]);
    await saveSecurityPerfectionState(admin, state);

    return {
      ok: true,
      s3Key,
      monthlyMirror,
      bytesEncrypted,
      durationMs,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const durationMs = Date.now() - t0;
    const at = new Date().toISOString();

    if (runId) {
      await admin
        .from('sentinel_vault_runs')
        .update({
          status: 'failed',
          duration_ms: durationMs,
          error_message: msg.slice(0, 4000),
        })
        .eq('id', runId);
    } else {
      await admin.from('sentinel_vault_runs').insert({
        status: 'failed',
        s3_bucket: s3cfg.bucket,
        duration_ms: durationMs,
        error_message: msg.slice(0, 4000),
      });
    }

    try {
      let state = await loadSecurityPerfectionState(admin);
      state = appendActivity(state, [
        {
          at,
          kind: 'vault_fail',
          message: `Sentinel Vault — ÉCHEC : ${msg}`,
        },
      ]);
      await saveSecurityPerfectionState(admin, state);
    } catch (stateErr) {
      console.error('[sentinel-vault] activity', stateErr);
    }

    await admin.from('system_incidents').insert({
      service: 'sentinel_vault',
      status: 'critical',
      message: `Sauvegarde hors-site : ${msg}`,
      latency_ms: durationMs,
      auto_fixed: false,
      alert_sent: false,
    });

    await notifySentinelVaultFailure(msg, at);

    return { ok: false, error: msg, durationMs };
  } finally {
    await Promise.all([fs.unlink(sqlPath).catch(() => undefined), fs.unlink(encPath).catch(() => undefined)]);
  }
}
