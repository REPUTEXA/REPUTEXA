export const BABEL_WIZARD_STEP_IDS = [
  'checkpoint',
  'catalog',
  'messages',
  'serverPack',
  'authEmail',
  'signup',
  'seo',
  'warRoom',
  'emailsProduct',
  'done',
] as const;

export type BabelWizardStepId = (typeof BABEL_WIZARD_STEP_IDS)[number];

export type WizardStepOutput = {
  content: string;
  kind: 'snippet' | 'json' | 'text';
  approved: boolean;
  generatedAt?: string;
  error?: string;
};

export type BabelWizardState = {
  v: 1;
  localeCode: string;
  targetLabel: string;
  stepIndex: number;
  outputs: Partial<Record<BabelWizardStepId, WizardStepOutput>>;
  messagesDraftId?: string;
  messagesProgressDone?: number;
  messagesProgressTotal?: number;
};

export function emptyWizardState(localeCode: string, targetLabel: string): BabelWizardState {
  return {
    v: 1,
    localeCode: localeCode.trim().toLowerCase(),
    targetLabel: targetLabel.trim(),
    stepIndex: 0,
    outputs: {},
  };
}

export function wizardStepMeta(id: BabelWizardStepId): {
  title: string;
  short: string;
  usesAi: boolean;
} {
  const M: Record<BabelWizardStepId, { title: string; short: string; usesAi: boolean }> = {
    checkpoint: {
      title: 'Sauvegarde & départ',
      short: 'Point de restauration avant de commencer, puis saisie de la langue.',
      usesAi: false,
    },
    catalog: {
      title: 'Catalogue URL',
      short: 'SITE_LOCALE_CODES + SITE_LOCALE_META (lib/i18n/site-locales-catalog.ts).',
      usesAi: true,
    },
    messages: {
      title: 'messages/*.json',
      short: 'Fichier next-intl complet (transcréation par lots, même moteur que Expansion).',
      usesAi: true,
    },
    serverPack: {
      title: 'Pack e-mail serveur',
      short: 'Import + rawByLocale dans lib/emails/server-locale-message-pack.ts.',
      usesAi: true,
    },
    authEmail: {
      title: 'E-mails auth',
      short: 'Vérification normalizeEmailLocale + messages AuthEmails.',
      usesAi: false,
    },
    signup: {
      title: 'Inscription culturelle',
      short: 'Bloc BY.{locale} dans lib/i18n/signup-ui-by-locale.ts.',
      usesAi: true,
    },
    seo: {
      title: 'SEO layout',
      short: 'Entrée dans SEO_CONFIG (app/[locale]/layout.tsx).',
      usesAi: true,
    },
    warRoom: {
      title: 'Site public par marché',
      short: 'Growth War Room si gateCountryCode.',
      usesAi: false,
    },
    emailsProduct: {
      title: 'E-mails produit & broadcasts',
      short: 'Auditer lib/emails/templates.ts et info-broadcast-email.ts.',
      usesAi: false,
    },
    done: {
      title: 'Terminé',
      short: 'Télécharger le pack, déployer, tester.',
      usesAi: false,
    },
  };
  return M[id];
}

export function buildWizardBackupJson(params: {
  state: BabelWizardState;
  serverSessionId?: string | null;
  note?: string;
}): string {
  return JSON.stringify(
    {
      babelWizardBackup: true,
      v: 1,
      exportedAt: new Date().toISOString(),
      note: params.note ?? null,
      serverSessionId: params.serverSessionId ?? null,
      state: params.state,
    },
    null,
    2
  );
}

export function parseWizardBackupJson(raw: string): {
  state: BabelWizardState;
  serverSessionId?: string | null;
} | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (j.babelWizardBackup !== true || j.state == null || typeof j.state !== 'object') return null;
    const st = j.state as BabelWizardState;
    if (st.v !== 1 || typeof st.localeCode !== 'string') return null;
    return {
      state: st,
      serverSessionId: typeof j.serverSessionId === 'string' ? j.serverSessionId : null,
    };
  } catch {
    return null;
  }
}
