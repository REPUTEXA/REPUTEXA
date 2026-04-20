import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertFilesystemWriteAllowed } from '@/lib/babel/babel-filesystem-policy';
import { applyMessagesJsonToDisk, applyWizardBundleToDisk } from '@/lib/babel/apply-wizard-bundle';
import { probeLocaleHomepage } from '@/lib/babel/babel-probe-locale';
import type { BabelWizardState } from '@/lib/babel/babel-wizard-types';
import { smartMergeFromTmp } from '@/lib/babel/babel-smart-merge';
import { runBabelGitCommit, toRepoRelative } from '@/lib/babel/babel-git-commit';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: ta('forbidden') }, { status: 403 }) };
  return { user };
}

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('apply_wizard_state'),
    state: z.custom<BabelWizardState>((v) => v != null && typeof v === 'object'),
    probeLocale: z.boolean().optional(),
    mergeSnippets: z.boolean().optional(),
    gitCommit: z.boolean().optional(),
    commitMessage: z.string().max(240).optional(),
  }),
  z.object({
    action: z.literal('apply_messages'),
    localeCode: z.string().min(2).max(12),
    messagesJson: z.record(z.string(), z.any()),
    probeLocale: z.boolean().optional(),
    gitCommit: z.boolean().optional(),
    commitMessage: z.string().max(240).optional(),
  }),
  z.object({
    action: z.literal('smart_merge'),
    localeCode: z.string().min(2).max(12),
    targetLabel: z.string().max(120).optional(),
    gitCommit: z.boolean().optional(),
    commitMessage: z.string().max(240).optional(),
    skipEmailStubs: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('apply_full_native'),
    state: z.custom<BabelWizardState>((v) => v != null && typeof v === 'object'),
    gitCommit: z.boolean().optional(),
    commitMessage: z.string().max(240).optional(),
    probeLocale: z.boolean().optional(),
  }),
]);

function uniqueStrings(paths: string[]): string[] {
  return Array.from(new Set(paths.filter(Boolean)));
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();

  try {
    assertFilesystemWriteAllowed();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('babelFilesystemWriteDisabled') },
      { status: 403 }
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: ta('payloadInvalid'), details: parsed.error.flatten() }, { status: 400 });
  }

  const projectRoot = process.cwd();

  try {
    if (parsed.data.action === 'smart_merge') {
      const { localeCode, targetLabel, gitCommit, commitMessage, skipEmailStubs } = parsed.data;
      const merge = await smartMergeFromTmp({
        projectRoot,
        locale: localeCode.trim().toLowerCase(),
        targetLabel,
        skipEmailStubs,
      });

      let git: ReturnType<typeof runBabelGitCommit> | undefined;
      if (gitCommit && merge.gitPaths.length > 0) {
        try {
          git = runBabelGitCommit({
            projectRoot,
            message: commitMessage ?? `Babel smart-merge: ${localeCode}`,
            relativePaths: merge.gitPaths.map((p) => toRepoRelative(projectRoot, p)),
          });
        } catch (ge) {
          merge.errors.push(ge instanceof Error ? ge.message : String(ge));
        }
      }

      return NextResponse.json({ ok: merge.ok, merge, git });
    }

    if (parsed.data.action === 'apply_full_native') {
      const { state, gitCommit, commitMessage, probeLocale } = parsed.data;
      const disk = await applyWizardBundleToDisk({ projectRoot, state });
      const merge = await smartMergeFromTmp({
        projectRoot,
        locale: state.localeCode.trim().toLowerCase(),
        targetLabel: state.targetLabel,
      });

      let probe: Awaited<ReturnType<typeof probeLocaleHomepage>> | undefined;
      if (probeLocale) {
        probe = await probeLocaleHomepage(state.localeCode);
      }

      const allGitPaths = uniqueStrings([...disk.written, ...merge.gitPaths]);

      let git: ReturnType<typeof runBabelGitCommit> | undefined;
      if (gitCommit && allGitPaths.length > 0) {
        try {
          git = runBabelGitCommit({
            projectRoot,
            message: commitMessage ?? `Babel: add ${state.localeCode} native support`,
            relativePaths: allGitPaths.map((p) => toRepoRelative(projectRoot, p)),
          });
        } catch (ge) {
          const msg = ge instanceof Error ? ge.message : String(ge);
          merge.errors.push(msg);
          disk.errors.push(msg);
        }
      }

      const ok = disk.success && merge.ok;
      const restartHint = ta('babelNativeRestartHint');

      if (ok) {
        try {
          await mkdir(path.join(projectRoot, 'tmp'), { recursive: true });
          await writeFile(
            path.join(projectRoot, 'tmp', 'babel-wizard-dev-restart-requested.txt'),
            `requestedAt=${new Date().toISOString()}\nlocale=${state.localeCode.trim().toLowerCase()}\n`,
            'utf8'
          );
        } catch {
          /* best-effort : dossier ignoré par git ou FS en lecture seule */
        }
      }

      return NextResponse.json({
        ok,
        disk,
        merge,
        probe,
        git,
        restartRequired: ok,
        restartHint: ok ? restartHint : undefined,
      });
    }

    if (parsed.data.action === 'apply_wizard_state') {
      const { state, probeLocale, mergeSnippets, gitCommit, commitMessage } = parsed.data;
      const disk = await applyWizardBundleToDisk({ projectRoot, state });
      let merge: Awaited<ReturnType<typeof smartMergeFromTmp>> | undefined;
      let git: ReturnType<typeof runBabelGitCommit> | undefined;

      if (mergeSnippets) {
        merge = await smartMergeFromTmp({
          projectRoot,
          locale: state.localeCode.trim().toLowerCase(),
          targetLabel: state.targetLabel,
        });
      }

      let probe: Awaited<ReturnType<typeof probeLocaleHomepage>> | undefined;
      if (probeLocale) {
        probe = await probeLocaleHomepage(state.localeCode);
      }

      const allGitPaths = uniqueStrings([
        ...disk.written,
        ...(merge?.gitPaths ?? []),
      ]);

      if (gitCommit && allGitPaths.length > 0) {
        try {
          git = runBabelGitCommit({
            projectRoot,
            message: commitMessage ?? `Babel: ${state.localeCode} bundle`,
            relativePaths: allGitPaths.map((p) => toRepoRelative(projectRoot, p)),
          });
        } catch (ge) {
          const msg = ge instanceof Error ? ge.message : String(ge);
          if (merge) merge.errors.push(msg);
          else disk.errors.push(msg);
        }
      }

      return NextResponse.json({
        ok: disk.success && (merge ? merge.ok : true),
        ...disk,
        merge,
        probe,
        git,
        hint: ta('babelApplyWizardHint'),
      });
    }

    const { localeCode, messagesJson, probeLocale, gitCommit, commitMessage } = parsed.data;
    const r = await applyMessagesJsonToDisk({
      projectRoot,
      localeCode,
      messages: messagesJson,
    });
    let probe: Awaited<ReturnType<typeof probeLocaleHomepage>> | undefined;
    if (probeLocale) {
      probe = await probeLocaleHomepage(localeCode);
    }

    let git: ReturnType<typeof runBabelGitCommit> | undefined;
    if (gitCommit && r.written.length > 0) {
      try {
        git = runBabelGitCommit({
          projectRoot,
          message: commitMessage ?? `Babel: messages ${localeCode}`,
          relativePaths: r.written.map((p) => toRepoRelative(projectRoot, p)),
        });
      } catch (ge) {
        r.errors.push(ge instanceof Error ? ge.message : String(ge));
      }
    }

    return NextResponse.json({
      ok: r.errors.length === 0,
      written: r.written,
      errors: r.errors,
      probe,
      git,
    });
  } catch (e) {
    console.error('[babel-apply-changes]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('babelWriteFailed') },
      { status: 500 }
    );
  }
}
