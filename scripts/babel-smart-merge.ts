/**
 * Fusionne tmp/babel-wizard-apply/{locale}/*.md dans les fichiers maîtres (hors navigateur).
 *
 * Prérequis : BABEL_FILESYSTEM_WRITE_ENABLED=true
 *
 * Usage : npx tsx scripts/babel-smart-merge.ts nl
 */

import 'dotenv/config';
import { assertFilesystemWriteAllowed } from '../lib/babel/babel-filesystem-policy';
import { smartMergeFromTmp } from '../lib/babel/babel-smart-merge';
import { assertGitCommitAllowed, runBabelGitCommit, toRepoRelative } from '../lib/babel/babel-git-commit';

async function main() {
  assertFilesystemWriteAllowed();
  const locale = process.argv[2]?.trim().toLowerCase();
  if (!locale) {
    console.error('Usage: npx tsx scripts/babel-smart-merge.ts <locale> [--git]');
    process.exit(1);
  }
  const doGit = process.argv.includes('--git');
  const root = process.cwd();
  const merge = await smartMergeFromTmp({ projectRoot: root, locale });
  console.log(JSON.stringify(merge, null, 2));

  if (doGit && merge.gitPaths.length > 0) {
    assertGitCommitAllowed();
    const git = runBabelGitCommit({
      projectRoot: root,
      message: `Babel smart-merge: ${locale}`,
      relativePaths: merge.gitPaths.map((p) => toRepoRelative(root, p)),
    });
    console.log('git:', git);
  }

  process.exit(merge.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
