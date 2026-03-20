/**
 * lib/github/auto-heal-pr.ts
 *
 * Bibliothèque GitHub partagée — Auto-Heal PR Module
 *
 * Utilisée par :
 *   - app/api/admin/auto-heal/route.ts  (incidents support_design_bug → PR)
 *   - lib/support/agent-tools.ts        (outil create_github_pr de l'agent)
 *
 * Sécurité : JAMAIS de push direct sur main.
 * Toute correction passe obligatoirement par une Pull Request.
 *
 * Variables d'environnement requises :
 *   GITHUB_TOKEN   — Personal Access Token (scopes: Contents: Read & Write, Pull Requests: Read & Write)
 *   GITHUB_REPO    — "owner/repo" (ex: "dubut/aaaempire-reputation-ai")
 *   GITHUB_BRANCH  — branche de base (défaut: "main")
 */

const GITHUB_TOKEN    = process.env.GITHUB_TOKEN?.trim()   ?? '';
const GITHUB_REPO     = process.env.GITHUB_REPO?.trim()    ?? '';
const GITHUB_BASE     = process.env.GITHUB_BRANCH?.trim()  ?? 'main';

export type GithubFileInfo = { content: string; sha: string };

export type PRResult = {
  pr_url:    string;
  pr_number: number;
  branch:    string;
};

// ── Helpers internes ──────────────────────────────────────────────────────────

function ghHeaders(): Record<string, string> {
  return {
    Authorization:  `Bearer ${GITHUB_TOKEN}`,
    Accept:         'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

/** Récupère le contenu + SHA d'un fichier depuis la branche de base */
export async function fetchGitHubFile(filePath: string): Promise<GithubFileInfo | null> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BASE}`,
      { headers: ghHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json() as { content: string; sha: string };
    const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    return { content, sha: data.sha };
  } catch {
    return null;
  }
}

/** Récupère le SHA du dernier commit de la branche de base */
async function getBaseBranchSha(): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/git/ref/heads/${GITHUB_BASE}`,
    { headers: ghHeaders() }
  );
  if (!res.ok) throw new Error(`getBaseBranchSha failed: ${res.status}`);
  const data = await res.json() as { object: { sha: string } };
  return data.object.sha;
}

/** Crée une nouvelle branche depuis le SHA de base */
async function createBranch(branchName: string, baseSha: string): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/git/refs`,
    {
      method: 'POST',
      headers: ghHeaders(),
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    // Ignorer si la branche existe déjà (422)
    if (res.status !== 422) throw new Error(`createBranch failed: ${res.status} — ${body}`);
  }
}

/** Commit un fichier sur une branche existante */
async function commitFileToBranch(
  filePath:      string,
  newContent:    string,
  fileSha:       string,
  branchName:    string,
  commitMessage: string
): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: ghHeaders(),
      body: JSON.stringify({
        message: commitMessage,
        content: Buffer.from(newContent).toString('base64'),
        sha:     fileSha,
        branch:  branchName,
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`commitFileToBranch failed: ${res.status} — ${body}`);
  }
}

/** Crée une Pull Request depuis une branche vers la branche de base */
async function openPullRequest(params: {
  branchName: string;
  title:      string;
  body:       string;
}): Promise<PRResult> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/pulls`,
    {
      method: 'POST',
      headers: ghHeaders(),
      body: JSON.stringify({
        title: params.title,
        body:  params.body,
        head:  params.branchName,
        base:  GITHUB_BASE,
        draft: false,
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`openPullRequest failed: ${res.status} — ${body}`);
  }
  const data = await res.json() as { html_url: string; number: number };
  return { pr_url: data.html_url, pr_number: data.number, branch: params.branchName };
}

// ── Orchestrateur principal ───────────────────────────────────────────────────

/**
 * createHealingPR — Orchestre branche + commit + PR en une seule opération.
 *
 * @param branchName  Nom de la branche (ex: "fix/auto-heal-validate-phone-1748000000")
 * @param filePath    Chemin depuis la racine du repo (ex: "lib/support/agent-tools.ts")
 * @param newContent  Contenu complet du fichier corrigé
 * @param prTitle     Titre de la PR (ex: "fix(auto-heal): corriger validate_phone_format")
 * @param prBody      Corps de la PR (markdown, diagnostic + prévention)
 */
export async function createHealingPR(params: {
  branchName: string;
  filePath:   string;
  newContent: string;
  prTitle:    string;
  prBody:     string;
}): Promise<PRResult> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    throw new Error('GITHUB_TOKEN ou GITHUB_REPO non configurés — PR impossible.');
  }

  const { branchName, filePath, newContent, prTitle, prBody } = params;

  // 1. Récupérer le fichier courant (SHA obligatoire pour le commit)
  const fileInfo = await fetchGitHubFile(filePath);
  if (!fileInfo) throw new Error(`Fichier introuvable sur GitHub : ${filePath}`);

  // 2. Récupérer le SHA de la branche de base
  const baseSha = await getBaseBranchSha();

  // 3. Créer la branche de correctif
  await createBranch(branchName, baseSha);

  // 4. Committer le fichier corrigé sur la nouvelle branche
  await commitFileToBranch(
    filePath,
    newContent,
    fileInfo.sha,
    branchName,
    `fix(auto-heal): ${prTitle}`
  );

  // 5. Ouvrir la Pull Request
  return openPullRequest({ branchName, title: prTitle, body: prBody });
}

/** Vérifie si les variables GitHub sont configurées */
export function isGitHubConfigured(): boolean {
  return Boolean(GITHUB_TOKEN && GITHUB_REPO);
}
