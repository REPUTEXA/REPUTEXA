/**
 * Dashboard.bananoGhostTokens
 * Run: node scripts/merge-banano-ghost-tokens-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function pack(fr, en) {
  return { fr, en };
}

const bananoGhostTokens = {
  ...pack(
    {
      title: 'Terminal & Agents — Sentinel Ghost',
      intro:
        'Chaque PC caisse Windows reçoit un jeton secret (Bearer). Collez-le dans l’Agent Ghost pour résoudre les scans REP-… (clients et collaborateurs avec crédit staff), les bons VCHR-… et les transacts. Le secret n’est montré qu’une seule fois.',
      testMacroBold: 'Test macro caisse :',
      testMacroRest:
        'uniquement sur le PC Windows — dans l’Agent Ghost, renseignez un montant fictif puis « Tester SendInput » pour voir comment votre logiciel réagit aux touches injectées (sans toucher à la fidélité en base).',
      ctaAdd: 'Ajouter un Agent Ghost',
      loading: 'Chargement…',
      empty: 'Aucun agent. Créez un jeton pour connecter le poste caisse Windows.',
      thAgent: 'Agent',
      thCreated: 'Création',
      thLastUsed: 'Dernière utilisation',
      thAction: 'Action',
      agentFallback: 'Agent Windows',
      revoke: 'Révoquer',
      revokedList: 'Agents révoqués ({count})',
      revokedLine: '{label} — révoqué le {date}',
      close: 'Fermer',
      dialogNewTitle: 'Nouvel accès Agent Ghost',
      labelPostName: 'Nom du poste (optionnel)',
      placeholderPostName: 'ex. Caisse 1 — Accueil',
      dialogHint:
        'Après validation, un jeton secret s’affichera une seule fois. Copiez-le dans l’application Reputexa Ghost (champ jeton Bearer).',
      cancel: 'Annuler',
      creating: 'Création…',
      generateToken: 'Générer le jeton',
      secretTitle: 'Copiez ce jeton maintenant',
      secretBody:
        'Pour votre sécurité, il ne sera plus jamais affiché. Seul un hash est conservé en base ; en cas de perte, révoquez l’accès et créez un nouvel agent.',
      copy: 'Copier',
      savedClose: 'J’ai sauvegardé — Fermer',
      dash: '—',
      toastLoadFail: 'Impossible de charger les agents',
      toastCreateFail: 'Création impossible',
      toastCreateOk: 'Agent créé — copiez le jeton maintenant',
      toastCopyOk: 'Jeton copié',
      toastCopyFail: 'Copie impossible (navigateur)',
      confirmRevoke:
        'Révoquer l’accès « {label} » ? L’application Windows ne pourra plus appeler l’API avec ce jeton.',
      toastRevokeFail: 'Révocation impossible',
      toastRevokedOk: 'Accès révoqué',
      errGeneric: 'Erreur',
    },
    {
      title: 'Terminal & agents — Sentinel Ghost',
      intro:
        'Each Windows POS PC gets a secret Bearer token. Paste it into the Ghost Agent to resolve REP-… scans (customers and staff-credit collaborators), VCHR-… vouchers and transactions. The secret is shown only once.',
      testMacroBold: 'POS macro test:',
      testMacroRest:
        'Windows PC only — in Ghost Agent, enter a dummy amount then “Test SendInput” to see how your software reacts to injected keystrokes (without touching loyalty data in the database).',
      ctaAdd: 'Add Ghost agent',
      loading: 'Loading…',
      empty: 'No agents yet. Create a token to connect the Windows till.',
      thAgent: 'Agent',
      thCreated: 'Created',
      thLastUsed: 'Last used',
      thAction: 'Action',
      agentFallback: 'Windows agent',
      revoke: 'Revoke',
      revokedList: 'Revoked agents ({count})',
      revokedLine: '{label} — revoked on {date}',
      close: 'Close',
      dialogNewTitle: 'New Ghost agent access',
      labelPostName: 'Workstation name (optional)',
      placeholderPostName: 'e.g. Till 1 — Front desk',
      dialogHint:
        'After confirmation, a secret token will be shown once. Copy it into the Reputexa Ghost app (Bearer token field).',
      cancel: 'Cancel',
      creating: 'Creating…',
      generateToken: 'Generate token',
      secretTitle: 'Copy this token now',
      secretBody:
        'For your security it will never be shown again. Only a hash is stored; if lost, revoke access and create a new agent.',
      copy: 'Copy',
      savedClose: 'Saved — close',
      dash: '—',
      toastLoadFail: 'Could not load agents',
      toastCreateFail: 'Could not create',
      toastCreateOk: 'Agent created — copy the token now',
      toastCopyOk: 'Token copied',
      toastCopyFail: 'Could not copy (browser)',
      confirmRevoke:
        'Revoke access for “{label}”? The Windows app will no longer be able to call the API with this token.',
      toastRevokeFail: 'Could not revoke',
      toastRevokedOk: 'Access revoked',
      errGeneric: 'Error',
    },
  ),
};

for (const loc of ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh']) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Dashboard = j.Dashboard || {};
  const payload = loc === 'fr' ? bananoGhostTokens.fr : loc === 'en' ? bananoGhostTokens.en : { ...bananoGhostTokens.en };
  j.Dashboard.bananoGhostTokens = payload;
  fs.writeFileSync(p, JSON.stringify(j));
}

console.log('Merged Dashboard.bananoGhostTokens');
