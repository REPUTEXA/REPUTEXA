export type DiscountKind = 'none' | 'percent' | 'fixed';

export type LostClientConfig = {
  enabled?: boolean;
  inactive_days?: number;
  min_lifetime_visits?: number;
  message_template?: string;
  discount_kind?: DiscountKind;
  /** 1–100 si discount_kind === 'percent' */
  discount_percent?: number;
  /** Centimes si discount_kind === 'fixed' */
  discount_fixed_cents?: number;
};

export type BirthdayConfig = {
  enabled?: boolean;
  message_template?: string;
  /** Rappel WhatsApp X jours avant le jour J (pièce d’identité, Wallet). */
  anticipation_enabled?: boolean;
  /** Entre 1 et 21, défaut 7. */
  anticipation_days?: number;
  discount_kind?: DiscountKind;
  discount_percent?: number;
  discount_fixed_cents?: number;
};

export type VipOfMonthConfig = {
  enabled?: boolean;
  message_template?: string;
  discount_kind?: DiscountKind;
  discount_percent?: number;
  discount_fixed_cents?: number;
};

/** Accueil J+N après création de la fiche fidélité (inscription Wallet). */
export type NewClientWelcomeConfig = {
  enabled?: boolean;
  /** Jours après l’inscription (1 = lendemain, fuseau Paris côté cron). */
  delay_days?: number;
  message_template?: string;
  discount_kind?: DiscountKind;
  discount_percent?: number;
  discount_fixed_cents?: number;
};

export type MergedLostClientConfig = Required<
  Omit<LostClientConfig, 'discount_kind' | 'discount_percent' | 'discount_fixed_cents'>
> & {
  discount_kind: DiscountKind;
  discount_percent: number;
  discount_fixed_cents: number;
};

export type MergedBirthdayConfig = Required<
  Omit<
    BirthdayConfig,
    'discount_kind' | 'discount_percent' | 'discount_fixed_cents' | 'anticipation_enabled' | 'anticipation_days'
  >
> & {
  anticipation_enabled: boolean;
  anticipation_days: number;
  discount_kind: DiscountKind;
  discount_percent: number;
  discount_fixed_cents: number;
};

export type MergedVipOfMonthConfig = Required<
  Omit<VipOfMonthConfig, 'discount_kind' | 'discount_percent' | 'discount_fixed_cents'>
> & {
  discount_kind: DiscountKind;
  discount_percent: number;
  discount_fixed_cents: number;
};

export type MergedNewClientWelcomeConfig = Required<
  Omit<
    NewClientWelcomeConfig,
    'discount_kind' | 'discount_percent' | 'discount_fixed_cents'
  >
> & {
  discount_kind: DiscountKind;
  discount_percent: number;
  discount_fixed_cents: number;
};

/** Texte FR de référence pour merge / legacies ; l’UI utilise `default_middle_lost` (i18n). */
export const DEFAULT_LOST_PERSONAL_MIDDLE =
  "Cela fait un moment que nous n'avons pas eu le plaisir de vous voir. Nous espérons que tout va bien de votre côté ? Nous nous demandions si votre dernière expérience chez nous vous avait donné entière satisfaction ou si nous pouvions améliorer quelque chose. Votre avis est notre priorité.";

/** Ancienne phrase par défaut (migration affichage / IA). */
const LEGACY_LOST_PERSONAL_MIDDLE_V1 =
  "vous nous manquez vraiment, et ce n'est pas pareil sans vous. Revenez quand vous voulez, on vous accueillera avec le sourire.";

const LEGACY_LOST_PERSONAL_MIDDLE_V2 =
  "Nous repensons à vous — comment allez-vous en ce moment ? Si quelque chose vous a éloigné de nous, nous serions vraiment attentifs à le comprendre, sans aucune obligation de votre part. Revenez quand vous le souhaiterez : nous serons ravis de vous accueillir.";

/** @deprecated Idem */
export const DEFAULT_BIRTHDAY_PERSONAL_MIDDLE =
  "on vous souhaite une journée lumineuse, entourée de ceux que vous aimez. Passez nous voir quand l'envie vous dira.";

export const DEFAULT_LOST_CLIENT: MergedLostClientConfig = {
  enabled: false,
  inactive_days: 15,
  min_lifetime_visits: 3,
  message_template: DEFAULT_LOST_PERSONAL_MIDDLE,
  discount_kind: 'percent',
  discount_percent: 15,
  discount_fixed_cents: 0,
};

export const DEFAULT_BIRTHDAY: MergedBirthdayConfig = {
  enabled: false,
  message_template: DEFAULT_BIRTHDAY_PERSONAL_MIDDLE,
  anticipation_enabled: true,
  anticipation_days: 7,
  discount_kind: 'percent',
  discount_percent: 15,
  discount_fixed_cents: 0,
};

/** @deprecated Idem */
export const DEFAULT_VIP_OF_MONTH_PERSONAL_MIDDLE =
  "Votre fidélité nous touche profondément. Pour vous remercier de votre attachement à notre maison, nous avons le plaisir de vous réserver une attention d'exception — faites-nous signe en boutique. Merci d'être l'un de nos piliers.";

export const DEFAULT_VIP_OF_MONTH: MergedVipOfMonthConfig = {
  enabled: false,
  message_template: DEFAULT_VIP_OF_MONTH_PERSONAL_MIDDLE,
  discount_kind: 'percent',
  discount_percent: 15,
  discount_fixed_cents: 0,
};

/** Phrase centrale (avant l’offre) — alignée sur `default_middle_welcome` i18n. */
export const DEFAULT_NEW_CLIENT_WELCOME_PERSONAL_MIDDLE =
  "Nous avons bien activé vos avantages sur votre Pass Wallet. Pour vous remercier de votre confiance, voici un petit cadeau de bienvenue :";

export const DEFAULT_NEW_CLIENT_WELCOME: MergedNewClientWelcomeConfig = {
  enabled: false,
  delay_days: 1,
  message_template: DEFAULT_NEW_CLIENT_WELCOME_PERSONAL_MIDDLE,
  discount_kind: 'percent',
  discount_percent: 10,
  discount_fixed_cents: 0,
};

/** Normalise apostrophes pour comparer d’anciennes chaînes FR en base. */
function normMiddle(s: string): string {
  return s.replace(/\u2019/g, "'").replace(/\u2018/g, "'").trim();
}

/**
 * Si le texte enregistré est encore l’ancienne phrase FR par défaut, le remplacer par la
 * version localisée (locale UI / profil). Évite d’afficher du FR sur un dashboard en anglais.
 */
export function replaceLegacyFrenchMiddle(
  stored: string,
  localizedDefault: string,
  kind: 'lost' | 'birth' | 'vip' | 'welcome'
): string {
  if (kind === 'lost') {
    const n = normMiddle(stored);
    if (n === normMiddle(DEFAULT_LOST_PERSONAL_MIDDLE)) return localizedDefault;
    if (n === normMiddle(LEGACY_LOST_PERSONAL_MIDDLE_V1)) return localizedDefault;
    if (n === normMiddle(LEGACY_LOST_PERSONAL_MIDDLE_V2)) return localizedDefault;
    return stored;
  }
  if (kind === 'welcome') {
    if (normMiddle(stored) === normMiddle(DEFAULT_NEW_CLIENT_WELCOME_PERSONAL_MIDDLE)) {
      return localizedDefault;
    }
    return stored;
  }
  const legacyVipOld =
    'merci infiniment pour votre fidélité ; toute l’équipe est très heureuse de vous compter parmi nos meilleurs ambassadeurs.';
  if (kind === 'vip') {
    const n = normMiddle(stored);
    if (n === normMiddle(DEFAULT_VIP_OF_MONTH_PERSONAL_MIDDLE)) return localizedDefault;
    if (n === normMiddle(legacyVipOld)) return localizedDefault;
    return stored;
  }
  if (normMiddle(stored) === normMiddle(DEFAULT_BIRTHDAY_PERSONAL_MIDDLE)) return localizedDefault;
  return stored;
}

function intlLocaleTag(locale: string): string {
  if (locale === 'zh') return 'zh-CN';
  return locale || 'fr';
}

function normalizeDiscountKind(raw: unknown): DiscountKind {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'percent' || s === 'fixed') return s;
  return 'none';
}

function mergeDiscount(
  r: Record<string, unknown>,
  defaults: { kind: DiscountKind; pct: number; cents: number }
): { discount_kind: DiscountKind; discount_percent: number; discount_fixed_cents: number } {
  const legacyCents = Math.min(
    500_00,
    Math.max(0, Math.floor(Number((r as { estimated_revenue_cents?: unknown }).estimated_revenue_cents ?? 0)))
  );
  const hasExplicitDiscount =
    r.discount_kind !== undefined ||
    r.discount_percent !== undefined ||
    r.discount_fixed_cents !== undefined;

  const effectiveDefaults =
    !hasExplicitDiscount && legacyCents > 0
      ? { kind: 'fixed' as DiscountKind, pct: 0, cents: legacyCents }
      : defaults;

  const discount_kind = normalizeDiscountKind(r.discount_kind ?? effectiveDefaults.kind);
  let discount_percent = Math.min(
    100,
    Math.max(0, Math.floor(Number(r.discount_percent ?? effectiveDefaults.pct)))
  );
  let discount_fixed_cents = Math.min(
    500_00,
    Math.max(0, Math.floor(Number(r.discount_fixed_cents ?? effectiveDefaults.cents)))
  );

  if (discount_kind === 'none') {
    discount_percent = 0;
    discount_fixed_cents = 0;
  } else if (discount_kind === 'percent') {
    discount_fixed_cents = 0;
    if (discount_percent < 1) discount_percent = Math.max(1, defaults.pct);
  } else {
    discount_percent = 0;
    discount_fixed_cents = Math.min(500_00, Math.max(0, discount_fixed_cents));
  }

  return { discount_kind, discount_percent, discount_fixed_cents };
}

/** Libellé remise pour le corps du message (%, €) selon la locale du marchand. */
export function formatReductionForMessage(
  discount_kind: DiscountKind,
  discount_percent: number,
  discount_fixed_cents: number,
  locale = 'fr'
): string {
  const tag = intlLocaleTag(locale);
  if (discount_kind === 'percent' && discount_percent > 0) {
    const p = Math.min(100, Math.max(1, Math.round(discount_percent)));
    return `${p} %`;
  }
  if (discount_kind === 'fixed' && discount_fixed_cents > 0) {
    const euros = discount_fixed_cents / 100;
    const s = new Intl.NumberFormat(tag, {
      minimumFractionDigits: euros % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(euros);
    return `${s} €`;
  }
  return '';
}

/** Remplace tirets longs / demi-cadratin (souvent générés par des IA) par un tiret ASCII classique. */
export function normalizeAutomationDashes(text: string): string {
  return text
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2212/g, '-');
}

/**
 * Un seul fil WhatsApp : les retours ligne isolés (souvent produits par l'IA) deviennent des espaces.
 * Les blocs séparés par une ligne vide sont conservés (ex. lien Wallet ajouté après).
 */
export function normalizeAutomationWhatsAppLineBreaks(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

/** Montant TTC cumulé (tickets) pour le message VIP, formaté selon la locale du destinataire. */
export function formatSpendCentsForMessage(cents: number, locale = 'fr'): string {
  const tag = intlLocaleTag(locale);
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

type AutomationTemplateFallbacks = {
  prenom: string;
  etablissement: string;
  periode: string;
  montant: string;
  dernier_produit: string;
};

export function applyAutomationMessageTemplate(
  template: string,
  vars: {
    prenom: string;
    reduction: string;
    reductionFallback: string;
    /** Nom commerce (profil REPUTEXA) ; si vide, etablissementFallback. */
    etablissement?: string;
    etablissementFallback?: string;
    /** Ex. période VIP */
    periode?: string;
    /** Montant TTC cumulé (tickets), libellé localisé */
    montant_ca?: string;
    /** Dernier libellé caisse / note événement fidélité */
    dernier_produit?: string;
  },
  fb: AutomationTemplateFallbacks
): string {
  const prenom = vars.prenom.trim() || fb.prenom;
  const red = vars.reduction.trim() || vars.reductionFallback;
  const etab =
    (vars.etablissement ?? '').trim() ||
    (vars.etablissementFallback ?? '').trim() ||
    fb.etablissement;
  const periode = (vars.periode ?? '').trim() || fb.periode;
  const montantCa = (vars.montant_ca ?? '').trim() || fb.montant;
  const dernier =
    (vars.dernier_produit ?? '').trim() || fb.dernier_produit;
  let s = template
    .replace(/\{\{\s*prenom\s*\}\}/gi, prenom)
    .replace(/\{\{\s*reduction\s*\}\}/gi, red)
    .replace(/\{\{\s*etablissement\s*\}\}/gi, etab)
    .replace(/\{\{\s*establishment\s*\}\}/gi, etab)
    .replace(/\{\{\s*periode\s*\}\}/gi, periode)
    .replace(/\{\{\s*montant_ca\s*\}\}/gi, montantCa)
    .replace(/\{\{\s*dernier_produit\s*\}\}/gi, dernier);
  s = s.replace(/\s{2,}/g, ' ').trim();
  return normalizeAutomationWhatsAppLineBreaks(normalizeAutomationDashes(s));
}

export type AutomationComposeExtras = {
  /** Renseigné à l’envoi si le gabarit contient {{dernier_produit}} (note dernière action caisse). */
  dernier_produit?: string;
};

const LEGACY_TEMPLATE_MARK = /\{\{/;

export type AutomationComposeTranslate = (
  key: string,
  values?: Record<string, string | number | boolean | null | undefined>
) => string;

/**
 * Si le texte enregistré contient encore des accolades (ancien éditeur), interpolation classique.
 * Sinon : texte = touche personnelle au centre ; le prénom, le nom commerce (profil) et l’offre sont assemblés.
 */
export function composeLostClientWhatsAppBody(
  cfg: Pick<
    MergedLostClientConfig,
    'message_template' | 'discount_kind' | 'discount_percent' | 'discount_fixed_cents'
  >,
  prenom: string,
  commerceName: string,
  reductionFallback: string,
  t: AutomationComposeTranslate,
  locale: string,
  extras?: AutomationComposeExtras
): string {
  const label = formatReductionForMessage(
    cfg.discount_kind,
    cfg.discount_percent,
    cfg.discount_fixed_cents,
    locale
  );
  const tpl = cfg.message_template;
  const fb = {
    prenom: t('fallback_prenom'),
    etablissement: t('fallback_commerce_lost'),
    periode: t('fallback_periode'),
    montant: t('em_dash'),
    dernier_produit: t('fallback_dernier_produit'),
  };
  if (LEGACY_TEMPLATE_MARK.test(tpl)) {
    return applyAutomationMessageTemplate(
      tpl,
      {
        prenom,
        reduction: label,
        reductionFallback,
        etablissement: commerceName,
        dernier_produit: extras?.dernier_produit,
      },
      fb
    );
  }
  const middle = tpl.trim() || t('default_middle_lost');
  const p = prenom.trim() || t('fallback_prenom');
  const c = commerceName.trim() || t('fallback_commerce_lost');
  const hasOffer = cfg.discount_kind !== 'none' && Boolean(label.trim());
  const offerSuffix = hasOffer
    ? `\n\n${t('lost_compose_offer_suffix', { reduction: label.trim() }).replace(/\s{2,}/g, ' ').trim()}`
    : '';
  return normalizeAutomationWhatsAppLineBreaks(
    normalizeAutomationDashes(
      t('lost_compose', { prenom: p, commerce: c, middle, offer: offerSuffix })
        .replace(/\s{2,}/g, ' ')
        .trim()
    )
  );
}

/** Lien Wallet optionnel (smart-add) sous le message. */
export function appendAutomationWalletLink(
  body: string,
  walletUrl: string | null | undefined,
  t: AutomationComposeTranslate
): string {
  const u = String(walletUrl ?? '').trim();
  const base = normalizeAutomationWhatsAppLineBreaks(normalizeAutomationDashes(body.trim()));
  if (!u) return base;
  return normalizeAutomationDashes(
    `${base}\n\n${t('automation_wallet_link_append', { url: u })}`.trim()
  );
}

/** Message J-7 (ou J-X) : rappel, pièce d’identité, Wallet. */
export function composeBirthdayAnticipationWhatsAppBody(
  prenom: string,
  commerceName: string,
  t: AutomationComposeTranslate,
  locale: string
): string {
  const p = prenom.trim() || t('fallback_prenom');
  const c = commerceName.trim() || t('fallback_commerce_short');
  void locale;
  return normalizeAutomationWhatsAppLineBreaks(
    normalizeAutomationDashes(
      t('birth_anticipation_compose', { prenom: p, commerce: c }).replace(/\s{2,}/g, ' ').trim()
    )
  );
}

export function composeBirthdayWhatsAppBody(
  cfg: Pick<
    MergedBirthdayConfig,
    'message_template' | 'discount_kind' | 'discount_percent' | 'discount_fixed_cents'
  >,
  prenom: string,
  commerceName: string,
  reductionFallback: string,
  t: AutomationComposeTranslate,
  locale: string,
  extras?: AutomationComposeExtras
): string {
  const label = formatReductionForMessage(
    cfg.discount_kind,
    cfg.discount_percent,
    cfg.discount_fixed_cents,
    locale
  );
  const tpl = cfg.message_template;
  const fb = {
    prenom: t('fallback_prenom'),
    etablissement: t('fallback_commerce_lost'),
    periode: t('fallback_periode'),
    montant: t('em_dash'),
    dernier_produit: t('fallback_dernier_produit'),
  };
  if (LEGACY_TEMPLATE_MARK.test(tpl)) {
    return applyAutomationMessageTemplate(
      tpl,
      {
        prenom,
        reduction: label,
        reductionFallback,
        etablissement: commerceName,
        dernier_produit: extras?.dernier_produit,
      },
      fb
    );
  }
  const middle = tpl.trim() || t('default_middle_birth');
  const p = prenom.trim() || t('fallback_prenom');
  const c = commerceName.trim() || t('fallback_commerce_short');
  const red = label.trim() || reductionFallback;
  return normalizeAutomationWhatsAppLineBreaks(
    normalizeAutomationDashes(
      t('birth_compose', { prenom: p, commerce: c, middle, reduction: red })
        .replace(/\s{2,}/g, ' ')
        .trim()
    )
  );
}

/** Message « meilleur client » sur le mois civil écoulé (période libellée selon la locale du marchand). */
export function composeNewClientWelcomeWhatsAppBody(
  cfg: Pick<
    MergedNewClientWelcomeConfig,
    'message_template' | 'discount_kind' | 'discount_percent' | 'discount_fixed_cents'
  >,
  prenom: string,
  commerceName: string,
  reductionFallback: string,
  t: AutomationComposeTranslate,
  locale: string,
  extras?: AutomationComposeExtras
): string {
  const label = formatReductionForMessage(
    cfg.discount_kind,
    cfg.discount_percent,
    cfg.discount_fixed_cents,
    locale
  );
  const tpl = cfg.message_template;
  const fb = {
    prenom: t('fallback_prenom'),
    etablissement: t('fallback_commerce_lost'),
    periode: t('fallback_periode'),
    montant: t('em_dash'),
    dernier_produit: t('fallback_dernier_produit'),
  };
  if (LEGACY_TEMPLATE_MARK.test(tpl)) {
    return applyAutomationMessageTemplate(
      tpl,
      {
        prenom,
        reduction: label,
        reductionFallback,
        etablissement: commerceName,
        dernier_produit: extras?.dernier_produit,
      },
      fb
    );
  }
  const middle = tpl.trim() || t('default_middle_welcome');
  const p = prenom.trim() || t('fallback_prenom');
  const c = commerceName.trim() || t('fallback_commerce_short');
  const red = (label.trim() || reductionFallback).trim();
  return normalizeAutomationWhatsAppLineBreaks(
    normalizeAutomationDashes(
      t('new_client_welcome_compose', { prenom: p, commerce: c, middle, reduction: red })
        .replace(/\s{2,}/g, ' ')
        .trim()
    )
  );
}

export function composeVipOfMonthWhatsAppBody(
  cfg: Pick<
    MergedVipOfMonthConfig,
    'message_template' | 'discount_kind' | 'discount_percent' | 'discount_fixed_cents'
  >,
  prenom: string,
  commerceName: string,
  periodLabel: string,
  montantCaFormatted: string,
  reductionFallback: string,
  t: AutomationComposeTranslate,
  locale: string,
  extras?: AutomationComposeExtras
): string {
  const label = formatReductionForMessage(
    cfg.discount_kind,
    cfg.discount_percent,
    cfg.discount_fixed_cents,
    locale
  );
  const tpl = cfg.message_template;
  const fb = {
    prenom: t('fallback_prenom'),
    etablissement: t('fallback_commerce_lost'),
    periode: t('fallback_periode'),
    montant: t('em_dash'),
    dernier_produit: t('fallback_dernier_produit'),
  };
  if (LEGACY_TEMPLATE_MARK.test(tpl)) {
    return applyAutomationMessageTemplate(
      tpl,
      {
        prenom,
        reduction: label,
        reductionFallback,
        etablissement: commerceName,
        periode: periodLabel,
        montant_ca: montantCaFormatted,
        dernier_produit: extras?.dernier_produit,
      },
      fb
    );
  }
  const middle = tpl.trim() || t('default_middle_vip');
  const p = prenom.trim() || t('fallback_prenom');
  const c = commerceName.trim() || t('fallback_commerce_short');
  const red = label.trim() || reductionFallback;
  const per = periodLabel.trim();
  return normalizeAutomationWhatsAppLineBreaks(
    normalizeAutomationDashes(
      t('vip_compose', {
        prenom: p,
        commerce: c,
        period: per,
        amount: montantCaFormatted,
        middle,
        reduction: red,
      })
        .replace(/\s{2,}/g, ' ')
        .trim()
    )
  );
}

/** Pour le cumul mensuel : uniquement les remises fixes en € (colonne log + stats). */
export function attributionCentsFromDiscount(
  discount_kind: DiscountKind,
  discount_fixed_cents: number
): number {
  if (discount_kind !== 'fixed') return 0;
  return Math.min(500_00, Math.max(0, Math.floor(discount_fixed_cents)));
}

export function reductionPayloadForLog(
  discount_kind: DiscountKind,
  discount_percent: number,
  discount_fixed_cents: number,
  labelFr: string
): {
  kind: DiscountKind;
  percent: number | null;
  fixed_cents: number | null;
  label_fr: string;
  applied: boolean;
} {
  const applied =
    discount_kind !== 'none' &&
    (discount_kind === 'percent' ? discount_percent > 0 : discount_fixed_cents > 0);
  return {
    kind: discount_kind,
    percent: discount_kind === 'percent' ? discount_percent : null,
    fixed_cents: discount_kind === 'fixed' ? discount_fixed_cents : null,
    label_fr: labelFr,
    applied,
  };
}

export function mergeLostConfig(
  raw: Record<string, unknown> | null | undefined,
  opts?: { defaultMessageTemplate?: string }
): MergedLostClientConfig {
  const r = raw ?? {};
  const d = mergeDiscount(r, {
    kind: DEFAULT_LOST_CLIENT.discount_kind,
    pct: DEFAULT_LOST_CLIENT.discount_percent,
    cents: DEFAULT_LOST_CLIENT.discount_fixed_cents,
  });
  const defTpl = opts?.defaultMessageTemplate ?? DEFAULT_LOST_PERSONAL_MIDDLE;
  return {
    enabled: Boolean(r.enabled ?? DEFAULT_LOST_CLIENT.enabled),
    inactive_days: Math.min(
      90,
      Math.max(7, Math.floor(Number(r.inactive_days ?? DEFAULT_LOST_CLIENT.inactive_days)))
    ),
    min_lifetime_visits: Math.min(
      50,
      Math.max(1, Math.floor(Number(r.min_lifetime_visits ?? DEFAULT_LOST_CLIENT.min_lifetime_visits)))
    ),
    message_template: String(r.message_template || defTpl).slice(0, 500),
    ...d,
  };
}

export function mergeBirthdayConfig(
  raw: Record<string, unknown> | null | undefined,
  opts?: { defaultMessageTemplate?: string }
): MergedBirthdayConfig {
  const r = raw ?? {};
  const d = mergeDiscount(r, {
    kind: DEFAULT_BIRTHDAY.discount_kind,
    pct: DEFAULT_BIRTHDAY.discount_percent,
    cents: DEFAULT_BIRTHDAY.discount_fixed_cents,
  });
  const defTpl = opts?.defaultMessageTemplate ?? DEFAULT_BIRTHDAY_PERSONAL_MIDDLE;
  const anticipationEnabled = Boolean(r.anticipation_enabled ?? DEFAULT_BIRTHDAY.anticipation_enabled);
  const anticipationDays = Math.min(
    21,
    Math.max(1, Math.floor(Number(r.anticipation_days ?? DEFAULT_BIRTHDAY.anticipation_days)))
  );
  return {
    enabled: Boolean(r.enabled ?? DEFAULT_BIRTHDAY.enabled),
    message_template: String(r.message_template || defTpl).slice(0, 500),
    anticipation_enabled: anticipationEnabled,
    anticipation_days: anticipationDays,
    ...d,
  };
}

export function mergeVipOfMonthConfig(
  raw: Record<string, unknown> | null | undefined,
  opts?: { defaultMessageTemplate?: string }
): MergedVipOfMonthConfig {
  const r = raw ?? {};
  const d = mergeDiscount(r, {
    kind: DEFAULT_VIP_OF_MONTH.discount_kind,
    pct: DEFAULT_VIP_OF_MONTH.discount_percent,
    cents: DEFAULT_VIP_OF_MONTH.discount_fixed_cents,
  });
  const defTpl = opts?.defaultMessageTemplate ?? DEFAULT_VIP_OF_MONTH_PERSONAL_MIDDLE;
  return {
    enabled: Boolean(r.enabled ?? DEFAULT_VIP_OF_MONTH.enabled),
    message_template: String(r.message_template || defTpl).slice(0, 500),
    ...d,
  };
}

export function mergeNewClientWelcomeConfig(
  raw: Record<string, unknown> | null | undefined,
  opts?: { defaultMessageTemplate?: string }
): MergedNewClientWelcomeConfig {
  const r = raw ?? {};
  const d = mergeDiscount(r, {
    kind: DEFAULT_NEW_CLIENT_WELCOME.discount_kind,
    pct: DEFAULT_NEW_CLIENT_WELCOME.discount_percent,
    cents: DEFAULT_NEW_CLIENT_WELCOME.discount_fixed_cents,
  });
  const defTpl = opts?.defaultMessageTemplate ?? DEFAULT_NEW_CLIENT_WELCOME_PERSONAL_MIDDLE;
  return {
    enabled: Boolean(r.enabled ?? DEFAULT_NEW_CLIENT_WELCOME.enabled),
    delay_days: Math.min(
      14,
      Math.max(1, Math.floor(Number(r.delay_days ?? DEFAULT_NEW_CLIENT_WELCOME.delay_days)))
    ),
    message_template: String(r.message_template || defTpl).slice(0, 500),
    ...d,
  };
}
