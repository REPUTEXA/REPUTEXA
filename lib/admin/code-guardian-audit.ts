/**
 * Code Guardian — audits statiques « chirurgicaux » : zéro écriture disque automatique.
 * Heuristiques limitées (pas de TypeScript compiler full) pour rester rapides en CI / Vercel.
 */

import { createTranslator } from 'next-intl';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';

export type CodeGuardianCategory = 'cleanup' | 'performance' | 'structure';

export type CodeGuardianSeverity = 'info' | 'watch' | 'urgent';

/** Clés stables → libellés dans `Admin.codeGuardian.staticFindings.*` */
export type CodeGuardianFindingKey =
  | 'consoleNoise'
  | 'importHeavy'
  | 'todoMarkers'
  | 'selectNoLimit'
  | 'hugeComponent'
  | 'sampleClean';

export type CodeGuardianFinding = {
  id: string;
  category: CodeGuardianCategory;
  severity: CodeGuardianSeverity;
  findingKey: CodeGuardianFindingKey;
  params: Record<string, string | number>;
  title: string;
  detail: string;
  /** Texte pour le « Laboratoire » (copier dans Cursor). */
  suggestedFix: string;
  file?: string;
  lineApprox?: number;
};

export type CodeGuardianScanResult = {
  scannedAt: string;
  technicalDebtScore: number;
  findings: CodeGuardianFinding[];
  summary: {
    cleanupHints: number;
    performanceHints: number;
    structureHints: number;
  };
};

const SKIP_DIR = new Set([
  'node_modules',
  '.next',
  'dist',
  '.git',
  'coverage',
  '.turbo',
  'out',
  'build',
]);

const MAX_FILES = 700;
const LARGE_COMPONENT_LINES = 380;
const MANY_IMPORTS_THRESHOLD = 22;

function collectSourceFiles(roots: string[], exts: Set<string>): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (out.length >= MAX_FILES || depth > 8) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (SKIP_DIR.has(e.name)) continue;
      const p = join(dir, e.name);
      try {
        if (e.isDirectory()) walk(p, depth + 1);
        else {
          const ext = e.name.includes('.') ? e.name.slice(e.name.lastIndexOf('.')) : '';
          if (exts.has(ext)) {
            const st = statSync(p);
            if (st.size < 1_200_000) out.push(p);
          }
        }
      } catch {
        /* ignore */
      }
    }
  };
  for (const r of roots) {
    try {
      walk(r, 0);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function countLines(path: string): number {
  try {
    return readFileSync(path, 'utf-8').split(/\r\n|\r|\n/).length;
  } catch {
    return 0;
  }
}

function scoreFromFindings(findings: CodeGuardianFinding[]): number {
  let s = 100;
  for (const f of findings) {
    if (f.severity === 'urgent') s -= 10;
    else if (f.severity === 'watch') s -= 5;
    else s -= 2;
  }
  return Math.max(0, Math.min(100, s));
}

const CONSOLE_RE = /console\.(log|debug|info|trace)\s*\(/g;
const SELECT_STAR_RE = /\.from\([^)]+\)\s*\.\s*select\s*\(\s*['"`]\s*\*?\s*['"`]\s*\)/;

function resolveFindingCopy(
  t: ReturnType<typeof createTranslator>,
  findingKey: CodeGuardianFindingKey,
  params: Record<string, string | number>
): { title: string; detail: string; suggestedFix: string } {
  const base = `staticFindings.${findingKey}`;
  return {
    title: t(`${base}.title`, params),
    detail: t(`${base}.detail`, params),
    suggestedFix: t(`${base}.suggestedFix`, params),
  };
}

export function runCodeGuardianScan(): CodeGuardianScanResult {
  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const t = createTranslator({ locale, messages, namespace: 'Admin.codeGuardian' });

  const scannedAt = new Date().toISOString();
  const cwd = process.cwd();
  const roots = [join(cwd, 'app'), join(cwd, 'components'), join(cwd, 'lib')].filter((r) => {
    try {
      return statSync(r).isDirectory();
    } catch {
      return false;
    }
  });

  const files = collectSourceFiles(roots, new Set(['.ts', '.tsx']));
  const findings: CodeGuardianFinding[] = [];
  let fid = 0;
  const nextId = (prefix: string) => `${prefix}-${++fid}`;

  const consoleHits: { file: string; count: number }[] = [];
  const importHeavy: { file: string; n: number }[] = [];
  const perfWide: { file: string }[] = [];
  const hugeComponents: { file: string; lines: number }[] = [];
  let todoFileCount = 0;

  for (const abs of files) {
    const rel = relative(cwd, abs).replace(/\\/g, '/');
    let content: string;
    try {
      content = readFileSync(abs, 'utf-8');
    } catch {
      continue;
    }

    const consoleMatches = content.match(CONSOLE_RE);
    if (consoleMatches && consoleMatches.length > 0) {
      consoleHits.push({ file: rel, count: consoleMatches.length });
    }

    const importLines = content.split('\n').filter((l) => /^\s*import\s+/.test(l)).length;
    if (importLines >= MANY_IMPORTS_THRESHOLD && (abs.endsWith('.tsx') || abs.endsWith('.ts'))) {
      importHeavy.push({ file: rel, n: importLines });
    }

    if (/\/\/\s*TODO|\/\/\s*FIXME|\/\*\s*TODO/.test(content)) {
      todoFileCount += 1;
    }

    if (rel.startsWith('app/api/') && SELECT_STAR_RE.test(content) && !content.includes('.limit(')) {
      perfWide.push({ file: rel });
    }

    if (rel.startsWith('components/') && abs.endsWith('.tsx')) {
      const lines = countLines(abs);
      if (lines >= LARGE_COMPONENT_LINES) {
        hugeComponents.push({ file: rel, lines });
      }
    }
  }

  const consoleTotal = consoleHits.reduce((a, h) => a + h.count, 0);
  if (consoleTotal > 0) {
    const top = consoleHits.sort((a, b) => b.count - a.count).slice(0, 8);
    const params = {
      total: consoleTotal,
      topFiles: top.map((x) => `${x.file} (${x.count})`).join(' ; ') || '—',
    };
    const copy = resolveFindingCopy(t, 'consoleNoise', params);
    findings.push({
      id: nextId('cl'),
      category: 'cleanup',
      severity: consoleTotal > 40 ? 'watch' : 'info',
      findingKey: 'consoleNoise',
      params,
      title: copy.title,
      detail: copy.detail,
      suggestedFix: copy.suggestedFix,
    });
  }

  if (importHeavy.length > 0) {
    const sample = importHeavy.sort((a, b) => b.n - a.n).slice(0, 6);
    const params = {
      fileCount: importHeavy.length,
      threshold: MANY_IMPORTS_THRESHOLD,
      sample: sample.map((s) => `${s.file} (${s.n} imports)`).join('\n'),
    };
    const copy = resolveFindingCopy(t, 'importHeavy', params);
    findings.push({
      id: nextId('cl'),
      category: 'cleanup',
      severity: 'info',
      findingKey: 'importHeavy',
      params,
      title: copy.title,
      detail: copy.detail,
      suggestedFix: copy.suggestedFix,
    });
  }

  if (todoFileCount > 15) {
    const params = { fileCount: todoFileCount };
    const copy = resolveFindingCopy(t, 'todoMarkers', params);
    findings.push({
      id: nextId('cl'),
      category: 'cleanup',
      severity: 'info',
      findingKey: 'todoMarkers',
      params,
      title: copy.title,
      detail: copy.detail,
      suggestedFix: copy.suggestedFix,
    });
  }

  for (const p of perfWide.slice(0, 12)) {
    const params = { file: p.file };
    const copy = resolveFindingCopy(t, 'selectNoLimit', params);
    findings.push({
      id: nextId('perf'),
      category: 'performance',
      severity: 'watch',
      findingKey: 'selectNoLimit',
      params,
      title: copy.title,
      detail: copy.detail,
      suggestedFix: copy.suggestedFix,
      file: p.file,
    });
  }

  for (const h of hugeComponents.sort((a, b) => b.lines - a.lines).slice(0, 10)) {
    const params = { file: h.file, lines: h.lines };
    const copy = resolveFindingCopy(t, 'hugeComponent', params);
    findings.push({
      id: nextId('str'),
      category: 'structure',
      severity: h.lines > 520 ? 'urgent' : 'watch',
      findingKey: 'hugeComponent',
      params,
      title: copy.title,
      detail: copy.detail,
      suggestedFix: copy.suggestedFix,
      file: h.file,
      lineApprox: h.lines,
    });
  }

  if (findings.length === 0) {
    const params = { filesScanned: files.length };
    const copy = resolveFindingCopy(t, 'sampleClean', params);
    findings.push({
      id: nextId('ok'),
      category: 'cleanup',
      severity: 'info',
      findingKey: 'sampleClean',
      params,
      title: copy.title,
      detail: copy.detail,
      suggestedFix: copy.suggestedFix,
    });
  }

  const technicalDebtScore = scoreFromFindings(findings);

  return {
    scannedAt,
    technicalDebtScore,
    findings,
    summary: {
      cleanupHints: findings.filter((f) => f.category === 'cleanup').length,
      performanceHints: findings.filter((f) => f.category === 'performance').length,
      structureHints: findings.filter((f) => f.category === 'structure').length,
    },
  };
}

export function buildCleanlistExport(findings: CodeGuardianFinding[], scannedAt: string): string {
  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const t = createTranslator({ locale, messages, namespace: 'Admin.codeGuardian' });

  const lines = [
    t('cleanExportHeaderTitle'),
    t('cleanExportHeaderGenerated', { scannedAt }),
    t('cleanExportHeaderDisclaimer'),
    '',
    ...findings.flatMap((f, i) => [
      `## ${i + 1}. [${f.category.toUpperCase()}] ${f.title}`,
      f.detail,
      '',
      t('cleanExportFixHeading'),
      f.suggestedFix,
      '',
      '---',
      '',
    ]),
  ];
  return lines.join('\n');
}
