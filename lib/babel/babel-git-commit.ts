import { spawnSync } from 'child_process';
import path from 'path';

export function getGitCommitBlockReason(): string | null {
  if (process.env.VERCEL === '1') {
    return 'Commit git désactivé sur Vercel.';
  }
  if (process.env.BABEL_GIT_COMMIT_ENABLED !== 'true') {
    return 'Définissez BABEL_GIT_COMMIT_ENABLED=true (local uniquement, dépôt git propre).';
  }
  return null;
}

export function assertGitCommitAllowed(): void {
  const r = getGitCommitBlockReason();
  if (r) throw new Error(r);
}

export type GitCommitResult = { ok: boolean; stdout?: string; stderr?: string };

/**
 * `git add` sur chemins relatifs au repo puis `git commit`.
 */
export function runBabelGitCommit(params: {
  projectRoot: string;
  message: string;
  relativePaths: string[];
}): GitCommitResult {
  assertGitCommitAllowed();
  const { projectRoot, message, relativePaths } = params;
  if (relativePaths.length === 0) {
    return { ok: false, stderr: 'Aucun fichier à committer' };
  }

  const add = spawnSync('git', ['add', '--', ...relativePaths], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  if (add.status !== 0) {
    return { ok: false, stdout: add.stdout, stderr: add.stderr || 'git add a échoué' };
  }

  const commit = spawnSync('git', ['commit', '-m', message], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  if (commit.status !== 0) {
    return {
      ok: false,
      stdout: commit.stdout,
      stderr: commit.stderr || 'git commit a échoué (rien à committer ?)',
    };
  }
  return { ok: true, stdout: commit.stdout };
}

/** Normalise un chemin pour git add (relatif, slash). */
export function toRepoRelative(projectRoot: string, absOrRel: string): string {
  const n = absOrRel.split(path.sep).join('/');
  if (path.isAbsolute(absOrRel)) {
    return path.relative(projectRoot, absOrRel).split(path.sep).join('/');
  }
  return n;
}
