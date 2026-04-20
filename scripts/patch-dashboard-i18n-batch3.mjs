/**
 * i18n batch 3: upgrade, admin error, babel headers, growth header, compliance page,
 * admin subpage headers, growth war room client strings.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const messagesDir = path.join(root, 'messages');

function deepMerge(base, patch) {
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = out[k];
    if (
      pv != null &&
      typeof pv === 'object' &&
      !Array.isArray(pv) &&
      typeof bv === 'object' &&
      bv != null &&
      !Array.isArray(bv)
    ) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

const upgradePage = {
  fr: {
    title: 'Changer de plan',
    subtitle:
      "Gérez votre abonnement, changez de plan ou de quantité d'établissements sur le portail sécurisé Stripe. Le prorata est calculé automatiquement.",
    volumeHint:
      'Augmentez simplement la quantité sur votre plan actuel pour bénéficier de la réduction automatique (2e établissement -20 %, 3e -30 %, 4e -40 %, 5e et plus -50 %).',
    cta: 'Ouvrir le portail de facturation',
  },
  en: {
    title: 'Change plan',
    subtitle:
      'Manage your subscription, switch plan or number of establishments on the secure Stripe portal. Proration is automatic.',
    volumeHint:
      'Increase quantity on your current plan for automatic volume discounts (2nd site -20%, 3rd -30%, 4th -40%, 5th+ -50%).',
    cta: 'Open billing portal',
  },
};

const adminError = {
  fr: {
    title: 'Impossible d’afficher le panneau',
    retry: 'Réessayer',
    refPrefix: 'Ref.',
  },
  en: {
    title: 'Unable to load the panel',
    retry: 'Retry',
    refPrefix: 'Ref.',
  },
};

const adminNav = {
  fr: { backToAdmin: 'Administration', backPanel: 'Retour au panneau admin' },
  en: { backToAdmin: 'Administration', backPanel: 'Back to admin panel' },
};

const adminBabelGuardian = {
  fr: {
    backLink: 'Administration',
    title: 'Babel Guardian',
    subtitle: 'Overlord local · smart-merge · checklist',
    overlordTitle: 'Exécuter la conquête native (Overlord)',
    overlordP1:
      'Dernière étape de l’assistant : écriture disque, fusion des snippets dans les .ts, stubs e-mails, commit git optionnel. Nécessite ',
    overlordCode: 'BABEL_FILESYSTEM_WRITE_ENABLED=true',
    overlordP2: ' en local — jamais sur Vercel.',
    overlordCta: 'Ouvrir l’assistant — mode Overlord',
    philosophyTitle: 'Philosophie',
    philosophyP1: 'Vous gardez la main : ',
    philosophyStrong: 'aucune automatisation obligatoire',
    philosophyP2:
      '. Pour qu’une langue soit vraiment « native » (pas un mot hors locale), suivez les étapes 1 → 12 ci-dessous dans l’ordre, puis testez. L’assistant ',
    expansionLink: 'Expansion',
    philosophyP3: ' est ',
    philosophyStrong2: 'facultatif',
    philosophyP4: ' : il peut brouillonner ',
    messagesGlob: 'messages/*.json',
    philosophyP5: ', vous validez et committez.',
    wizardCta: 'Assistant pas à pas',
    expansionCta: 'Expansion (IA seule)',
    checklistSummary: 'Checklist détaillée (12 étapes · texte)',
    demoTitle: 'Démo dashboard & scripts',
    demoP1: 'Les placeholders d’avis en démo vivent dans ',
    demoCode1: 'messages/*.json',
    demoP2: '. Pour les régénérer ou les aligner : ',
    demoCode2: 'scripts/patch-dashboard-demo-placeholders.mjs',
    demoP3: ' (à lancer si vous l’utilisez dans votre flux).',
  },
  en: {
    backLink: 'Administration',
    title: 'Babel Guardian',
    subtitle: 'Local Overlord · smart-merge · checklist',
    overlordTitle: 'Run native conquest (Overlord)',
    overlordP1:
      'Last wizard step: disk writes, snippet merge into .ts, email stubs, optional git commit. Requires ',
    overlordCode: 'BABEL_FILESYSTEM_WRITE_ENABLED=true',
    overlordP2: ' locally — never on Vercel.',
    overlordCta: 'Open assistant — Overlord mode',
    philosophyTitle: 'Philosophy',
    philosophyP1: 'You stay in control: ',
    philosophyStrong: 'no mandatory automation',
    philosophyP2:
      '. For a truly “native” language (no stray strings), follow steps 1 → 12 below in order, then test. The ',
    expansionLink: 'Expansion',
    philosophyP3: ' assistant is ',
    philosophyStrong2: 'optional',
    philosophyP4: ': it can draft ',
    messagesGlob: 'messages/*.json',
    philosophyP5: '; you review and commit.',
    wizardCta: 'Step-by-step assistant',
    expansionCta: 'Expansion (AI only)',
    checklistSummary: 'Detailed checklist (12 steps · text)',
    demoTitle: 'Dashboard demo & scripts',
    demoP1: 'Demo review placeholders live in ',
    demoCode1: 'messages/*.json',
    demoP2: '. To regenerate or align: ',
    demoCode2: 'scripts/patch-dashboard-demo-placeholders.mjs',
    demoP3: ' (run if you use it in your workflow).',
  },
};

const adminBabelWizard = {
  fr: {
    backLink: 'Babel Guardian',
    title: 'Assistant pas à pas',
    subtitle: 'IA + validation · sauvegarde / reprise',
  },
  en: {
    backLink: 'Babel Guardian',
    title: 'Step-by-step assistant',
    subtitle: 'AI + validation · save / resume',
  },
};

const adminBabelExpansion = {
  fr: {
    backLink: 'Babel Guardian',
    title: 'Expansion',
    subtitle: 'IA facultative · brouillon messages/*.json uniquement',
  },
  en: {
    backLink: 'Babel Guardian',
    title: 'Expansion',
    subtitle: 'Optional AI · draft messages/*.json only',
  },
};

const adminGrowthHeader = {
  fr: {
    backLink: 'Administration',
    title: 'Growth War Room',
    subtitle: 'Carte, pays, journal des contacts',
  },
  en: {
    backLink: 'Administration',
    title: 'Growth War Room',
    subtitle: 'Map, countries, contact log',
  },
};

const adminSubpageChrome = {
  fr: {
    codeGuardianTitle: 'Code Guardian',
    codeGuardianBadge: 'Asset health',
    codeGuardianSubtitle:
      'Audit statique lecture seule : dette technique, export markdown, laboratoire de correctifs suggérés.',
    securityTitle: 'Sécurité & Perfection',
    securityBadge: 'Forteresse',
    securitySubtitle:
      'Score de santé, kill switch, Sentinel Vault et automatisations — contrôles sans modification silencieuse du produit.',
    iaForgeTitle: 'IA Forge & Training',
    iaForgeBadge: 'Qualité modèles',
    iaForgeSubtitle:
      'Scores, file d’apprentissage et modes d’entraînement — sans écriture automatique sur le dépôt.',
    blackBoxTitle: 'Black Box Archive',
    blackBoxBadge: 'Preuves',
    blackBoxSubtitle:
      'Index des lots archivés, recherche et récupération — aligné sur la politique de rétention serveur.',
  },
  en: {
    codeGuardianTitle: 'Code Guardian',
    codeGuardianBadge: 'Asset health',
    codeGuardianSubtitle:
      'Read-only static audit: technical debt, markdown export, suggested-fix lab.',
    securityTitle: 'Security & Perfection',
    securityBadge: 'Fortress',
    securitySubtitle:
      'Health score, kill switch, Sentinel Vault and automations — controls without silent product changes.',
    iaForgeTitle: 'AI Forge & Training',
    iaForgeBadge: 'Model quality',
    iaForgeSubtitle: 'Scores, training queue and modes — no automatic repo writes.',
    blackBoxTitle: 'Black Box Archive',
    blackBoxBadge: 'Evidence',
    blackBoxSubtitle: 'Archived batch index, search and recovery — aligned with server retention policy.',
  },
};

const adminCompliance = {
  fr: {
    supabaseMissing: 'Client Supabase admin non configuré.',
    headerTitle: 'Conformité',
    headerBadge: 'Guardian',
    headerSubtitle: 'Veille légale automatisée, brouillons et synthèse des consentements par zone.',
    exportCsv: 'CSV consentements',
    exportAuditJson: 'Audit JSON',
    guardianTitle: 'État du Guardian (IA)',
    guardianLine1: 'Dernière vérification : il y a',
    guardianDayWord: '{count, plural, one {jour} other {jours}}',
    guardianStatusIntro: 'Statut :',
    guardianStatusOk: 'Conforme / veille en cours',
    guardianNoCron:
      'Aucun passage enregistré — planifiez le cron /api/cron/legal-guardian.',
    zonesTitle: 'Conformité par zone (Guardian + parcours cookies)',
    zonesIntro:
      'Indicateurs dérivés du dernier cycle IA (EDPB, marchés principaux et secondaires, ICO UK) et du taux d’acceptation « tout accepter » par zone lorsque des visites sont géolocalisées.',
    zoneCookiesLabel: 'Cookies « tout accepter » (zone) :',
    zoneNoData: 'pas encore de données',
    zoneVisitsFmt: '{pct}% · {count} visites',
    zoneEuNote: 'Cadre horizontal UE — EDPB / orientations communes',
    zone_ok: 'OK',
    zone_watch: 'Veille',
    zone_action_required: 'Action UE',
    zone_local_specific: 'Spécifique pays',
    draftsTitle: 'Brouillons Guardian (à valider dans « Publier une nouvelle version »)',
    consentTraceTitle: 'Consentements site (trace)',
    consentTraceP1:
      'Langue interface = locale next-intl au clic ; navigateur = ',
    consentTraceNavCode: 'navigator.language',
    consentTraceP2:
      ' ; Accept-Language = en-tête HTTP lors de l’enregistrement. Voir aussi export CSV. ',
    consentTraceP3: 'Pays « ZZ »',
    consentTraceP4:
      ' : normal si le pays ne peut pas être déduit — en local il n’y a pas ',
    consentTraceP5: ' ni ',
    consentTraceP6: ' ; en prod sur Vercel vous obtiendrez en général FR, BE, etc.',
    thMaj: 'Maj',
    thStatut: 'Statut',
    thPays: 'Pays',
    thUi: 'UI',
    thNavigateur: 'Navigateur',
    thAcceptLang: 'Accept-Lang',
    thAnalytique: 'Analytique',
    thMarketing: 'Marketing',
    thGpc: 'GPC',
    thVLegal: 'v légal',
    thSujet: 'Sujet',
    zzUnknown: '(inconnu)',
    zzTitleCell: 'Pays inconnu : pas d’en-tête géo sur la requête (souvent dev / équivalent).',
    zzTitleRow: 'Pas d’en-tête pays sur les requêtes enregistrées (ex. localhost).',
    noConsentRows:
      'Aucune trace — migration 105 / 111 appliquée ? Bannière visible sur le site public ?',
    acceptCountryTitle: 'Acceptation par pays',
    thTotal: 'Total',
    thToutAccepter: 'Tout accepter',
    thNecessary: 'Nécessaire',
    thRefus: 'Refus non-essentiel',
    thPartiel: 'Partiel',
    thPctTout: '% « tout »',
    noUserConsents:
      'Aucune ligne dans user_consents — déployez la migration 105 et validez la bannière cookies.',
    auditTitle: 'Journal (audit) — fil de preuve ({locale})',
    auditIntro:
      'Narration alignée sur la langue du dashboard. Métadonnées complètes (sources Guardian, URLs échantillon) dans l’export JSON.',
    emDash: '—',
  },
  en: {
    supabaseMissing: 'Supabase admin client is not configured.',
    headerTitle: 'Compliance',
    headerBadge: 'Guardian',
    headerSubtitle: 'Automated legal watch, drafts and consent summary by zone.',
    exportCsv: 'CSV consents',
    exportAuditJson: 'Audit JSON',
    guardianTitle: 'Guardian status (AI)',
    guardianLine1: 'Last check:',
    guardianDayWord: '{count, plural, one {day} other {days}} ago',
    guardianStatusIntro: 'Status:',
    guardianStatusOk: 'Compliant / watch ongoing',
    guardianNoCron: 'No run recorded — schedule cron /api/cron/legal-guardian.',
    zonesTitle: 'Compliance by zone (Guardian + cookie journey)',
    zonesIntro:
      'Indicators from the latest AI cycle (EDPB, primary/secondary markets, ICO UK) and “accept all” rate per zone when visits are geolocated.',
    zoneCookiesLabel: '“Accept all” cookies (zone):',
    zoneNoData: 'no data yet',
    zoneVisitsFmt: '{pct}% · {count} visits',
    zoneEuNote: 'EU horizontal framework — EDPB / common guidance',
    zone_ok: 'OK',
    zone_watch: 'Watch',
    zone_action_required: 'EU action',
    zone_local_specific: 'Country-specific',
    draftsTitle: 'Guardian drafts (validate under “Publish a new version”)',
    consentTraceTitle: 'Site consents (trace)',
    consentTraceP1: 'UI language = next-intl locale on click; browser = ',
    consentTraceNavCode: 'navigator.language',
    consentTraceP2: '; Accept-Language = HTTP header when stored. See CSV export. ',
    consentTraceP3: 'Country “ZZ”',
    consentTraceP4: ' is normal if country cannot be inferred — locally there is no ',
    consentTraceP5: ' nor ',
    consentTraceP6: '; on Vercel prod you usually get FR, BE, etc.',
    thMaj: 'Updated',
    thStatut: 'Status',
    thPays: 'Country',
    thUi: 'UI',
    thNavigateur: 'Browser',
    thAcceptLang: 'Accept-Lang',
    thAnalytique: 'Analytics',
    thMarketing: 'Marketing',
    thGpc: 'GPC',
    thVLegal: 'Legal v',
    thSujet: 'Subject',
    zzUnknown: '(unknown)',
    zzTitleCell: 'Unknown country: no geo header on the request (often dev).',
    zzTitleRow: 'No country header on stored requests (e.g. localhost).',
    noConsentRows:
      'No traces — migrations 105 / 111 applied? Public cookie banner visible?',
    acceptCountryTitle: 'Acceptance by country',
    thTotal: 'Total',
    thToutAccepter: 'Accept all',
    thNecessary: 'Necessary',
    thRefus: 'Reject non-essential',
    thPartiel: 'Partial',
    thPctTout: '% “all”',
    noUserConsents:
      'No rows in user_consents — deploy migration 105 and validate the cookie banner.',
    auditTitle: 'Log (audit) — evidence trail ({locale})',
    auditIntro:
      'Narration follows dashboard language. Full metadata (Guardian sources, sample URLs) in JSON export.',
    emDash: '—',
  },
};

/** Growth War Room client — keys used in component */
const adminGrowthWarRoom = {
  fr: {
    errLoad: 'Erreur chargement',
    errGeneric: 'Erreur',
    errDetail: 'Détail indisponible',
    errUpdate: 'Mise à jour impossible',
    errSync: 'Sync refusée',
    legend_scanned: 'Piste (pas encore contactée)',
    legend_outreach_recent: 'Contact récent (< 24h)',
    legend_no_response: 'Contactée, pas d’ouverture',
    legend_engaged: 'Ouverture / clic',
    legend_opted_out: 'Stop / désinscription',
    legend_customer: 'Client actif',
    legend_trial: 'Essai',
    legend_lost: 'Perdue',
    prismaHint:
      'Si le message parle de Prisma : arrêtez le dev, npx prisma generate, puis relancez.',
    syncInstantlyDetail:
      'Instantly : {pushed}/{requested} — HTTP {status} — voir logs serveur pour le corps de réponse.',
    syncAllSummary: 'Marchés traités : {ok}/{total}. {details}',
    syncCountryOk: 'OK ({pushed})',
    syncCountryErr: 'erreur',
    domainIntroP1: 'Chaque domaine d’envoi est rattaché à ',
    domainIntroStrong: 'un seul',
    domainIntroP2:
      ' pays dans la base. Les campagnes Instantly par pays évitent de mélanger les « munitions » (.fr vs .it). La conformité (RGPD / ePrivacy) reste votre responsabilité ; Legal Guardian couvre surtout les textes légaux du produit.',
    localesP1: 'même liste',
    localesP2: ' que Next.js (',
    localesP3:
      '). Les clés absentes d’une locale retombent sur le ',
    localesStrongFr: 'français',
    localesP4: '. La langue du compte (',
    localesP5:
      ' Supabase, alignée sur l’établissement quand c’est branché) pilote les e-mails auth / onboarding.',
    localesP6: 'Ajouter une langue (ex. coréen) : éditer le catalogue + créer ',
    localesP7: ', puis déployer. Pas de bouton magique : le build doit connaître la locale. Lancez les scripts ',
    localesP8: ' dans le dépôt.',
    marketGate: 'Marché {code} → « Site / {locale} public »',
    thSitePublic: 'Site / {locale} public',
    outreachActive: 'actif',
    outreachOff: 'off',
    syncAllTitle: 'Poussée Instantly — tous les marchés actifs',
    syncAllBusy: 'Synchronisation…',
    syncAllCta: 'Sync campagnes (pays ON + Instantly)',
    syncAllCronNote:
      'Même logique que le cron /api/cron/outreach-active-countries (Bearer CRON_SECRET), sans plafond manuel par requête : chaque pays utilise son ',
    mapPoints: '{visible} point(s) affiché(s) sur {total}',
    feedTitle: 'Flux récent',
    feedEmpty: 'Aucune entrée',
    loadingMarket: 'Chargement du marché {label}…',
    detailConfigTitle: 'Configuration marché · cluster isolé',
    smartleadReserve: 'ID campagne Smartlead (réserve)',
    saveMarket: 'Enregistrer le marché',
    pushInstantlyTitle: 'Poussée Instantly',
    pushInstantlyBody:
      'Nécessite INSTANTLY_API_KEY, fournisseur « instantly » et un ID de campagne. Les prospects passent en CONTACTED seulement si l’API répond OK.',
    pushBatch: 'Pousser jusqu’à 100 prospects (TO_CONTACT + email)',
    legalNoteP1: 'Le ',
    legalNoteBrand: 'Legal Guardian',
    legalNoteP2:
      ' continue de gérer les publications légales du produit (CGU, confidentialité) depuis l’accueil admin. Pour un pays donné, validez les textes dans la langue cible ; ce panneau ne génère pas encore automatiquement le droit local des campagnes cold-email.',
  },
  en: {
    errLoad: 'Load error',
    errGeneric: 'Error',
    errDetail: 'Detail unavailable',
    errUpdate: 'Update failed',
    errSync: 'Sync denied',
    legend_scanned: 'Lead (not contacted yet)',
    legend_outreach_recent: 'Recent contact (< 24h)',
    legend_no_response: 'Contacted, no open',
    legend_engaged: 'Open / click',
    legend_opted_out: 'Stop / unsubscribe',
    legend_customer: 'Active customer',
    legend_trial: 'Trial',
    legend_lost: 'Lost',
    prismaHint: 'If the message mentions Prisma: stop dev, run npx prisma generate, then restart.',
    syncInstantlyDetail:
      'Instantly: {pushed}/{requested} — HTTP {status} — see server logs for response body.',
    syncAllSummary: 'Markets processed: {ok}/{total}. {details}',
    syncCountryOk: 'OK ({pushed})',
    syncCountryErr: 'error',
    domainIntroP1: 'Each sending domain is tied to ',
    domainIntroStrong: 'one',
    domainIntroP2:
      ' country in the database. Per-country Instantly campaigns avoid mixing “ammo” (.fr vs .it). Compliance (GDPR / ePrivacy) remains your responsibility; Legal Guardian mainly covers product legal copy.',
    localesP1: 'same list',
    localesP2: ' as Next.js (',
    localesP3: '). Missing keys in a locale fall back to ',
    localesStrongFr: 'French',
    localesP4: '. Account language (',
    localesP5: ' Supabase, aligned with establishment when wired) drives auth / onboarding emails.',
    localesP6: 'To add a language (e.g. Korean): edit the catalog + create ',
    localesP7: ', then deploy. No magic button: the build must know the locale. Run ',
    localesP8: ' scripts in the repo.',
    marketGate: 'Market {code} → “Public site / {locale}”',
    thSitePublic: 'Public site / {locale}',
    outreachActive: 'on',
    outreachOff: 'off',
    syncAllTitle: 'Instantly push — all active markets',
    syncAllBusy: 'Syncing…',
    syncAllCta: 'Sync campaigns (country ON + Instantly)',
    syncAllCronNote:
      'Same logic as cron /api/cron/outreach-active-countries (Bearer CRON_SECRET), no per-request cap: each country uses its ',
    mapPoints: '{visible} point(s) shown of {total}',
    feedTitle: 'Recent activity',
    feedEmpty: 'No entries',
    loadingMarket: 'Loading market {label}…',
    detailConfigTitle: 'Market config · isolated cluster',
    smartleadReserve: 'Smartlead campaign ID (reserved)',
    saveMarket: 'Save market',
    pushInstantlyTitle: 'Instantly push',
    pushInstantlyBody:
      'Requires INSTANTLY_API_KEY, “instantly” provider and a campaign ID. Prospects move to CONTACTED only if the API returns OK.',
    pushBatch: 'Push up to 100 prospects (TO_CONTACT + email)',
    legalNoteP1: '',
    legalNoteBrand: 'Legal Guardian',
    legalNoteP2:
      ' still handles product legal publications (ToS, privacy) from the admin home. Per country, validate copy in the target language; this panel does not yet auto-generate cold-email local law text.',
  },
};

function buildPatch(lang) {
  const u = upgradePage[lang];
  const ae = adminError[lang];
  const an = adminNav[lang];
  const bg = adminBabelGuardian[lang];
  const bw = adminBabelWizard[lang];
  const be = adminBabelExpansion[lang];
  const gh = adminGrowthHeader[lang];
  const sc = adminSubpageChrome[lang];
  const co = adminCompliance[lang];
  const gw = adminGrowthWarRoom[lang];
  return {
    Dashboard: {
      upgradePage: u,
      adminError: ae,
      adminNav: an,
      adminBabelGuardian: bg,
      adminBabelWizard: bw,
      adminBabelExpansion: be,
      adminGrowthHeader: gh,
      adminSubpageChrome: sc,
      adminCompliance: co,
      adminGrowthWarRoom: gw,
    },
  };
}

const LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];
const enPatch = buildPatch('en');

for (const code of LANGS) {
  const fp = path.join(messagesDir, `${code}.json`);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const patch = code === 'fr' ? buildPatch('fr') : enPatch;
  fs.writeFileSync(fp, JSON.stringify(deepMerge(data, patch)) + '\n', 'utf8');
  console.log('patched', code);
}
