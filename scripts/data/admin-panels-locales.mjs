/**
 * Source FR/EN for Admin.complianceSentinel, Admin.codeGuardian, Admin.growthEquirectMap.
 * Merged into messages/*.json via scripts/merge-admin-panels-i18n.mjs
 */

export const ADMIN_PANELS_FR = {
  complianceSentinel: {
    listBullet: '●',
    title: 'Agent de conformité',
    introRich:
      'Un <strong>assistant veille</strong> regarde l’actu utile (CNIL, règles données, signaux autour des avis en ligne, sujets consommateurs). Quand quelque chose d’important bouge, il peut préparer un <strong>brouillon</strong> de texte — toujours à relire par un humain avant publication.',
    bulletPersonalDataRich:
      '<strong>Données personnelles</strong> — nouvelles règles ou gros rappels côté autorités quand ils apparaissent dans la veille.',
    bulletGoogleReviewsRich:
      '<strong>Fiches Google / avis</strong> — ce qui touche à la façon de collecter ou montrer les avis quand les sources en parlent.',
    bulletTransparencyRich:
      '<strong>Info client et transparence</strong> — thèmes type prix clairs, petits caractères, loyauté quand la veille les repère.',
    scoreLabel_error: 'Vérification en erreur',
    scoreLabel_actionRecommended: 'Action admin recommandée',
    scoreLabel_watchSuggested: 'Veille : révision suggérée',
    scoreLabel_ok: 'Conforme (veille à jour)',
    scoreLabel_pendingFirst: 'En attente de première veille',
    relNever: 'jamais',
    relJustNow: 'à l’instant',
    relMinutes: 'il y a {count} min',
    relHours: 'il y a {count} h',
    statusPrefix: 'Statut :',
    lastWatchPrefix: 'Dernière veille :',
    lastWatchTour: '(tour de veille)',
    pendingDocsTitle: 'Documents en attente :',
    pendingDocsLine:
      '{count, plural, =0 {aucune suggestion en file} one {# modification suggérée} other {# modifications suggérées}}',
    emailFallbackRich:
      'Quand un brouillon est prêt, l’e-mail admin inclut résumé + aperçu texte (double avis IA Claude + GPT-4o) — il ne publie rien sans toi. Vérifie aussi spams / bonne boîte (<code>ADMIN_COMPLIANCE_EMAIL</code> ou profil admin).',
    ctaCompliance: 'Ouvrir la conformité',
    ctaPublishLegal: 'Publier un texte légal',
    guideTitle: 'Explications simples — Agent de conformité & Legal Guardian',
    guideWhatTitle: 'C’est quoi ?',
    guideWhatRich:
      '<strong>Guardian</strong> fait le tour des news utiles et peut proposer des <strong>brouillons</strong> de CGU, confidentialité ou mentions. <strong>Toi</strong> tu gardes le dernier mot juridique : on ne met rien en ligne sans validation humaine.',
    guideColorTitle: 'La petite note colorée',
    guideColorRich:
      '<strong>Vert</strong> : tout roulait au dernier passage. <strong>Orange</strong> : rien n’a encore tourné ou il reste des brouillons à traiter. <strong>Rouge</strong> : le dernier tour a planté. Ce n’est <strong>pas</strong> un avocat : un vrai juriste reste recommandé pour les gros sujets.',
    guideOrderTitle: 'Ordre conseillé',
    guideOrderStep1: 'Regarde cette carte et tes mails quand un brouillon est prêt.',
    guideOrderStep2Rich:
      '<strong>Ouvrir la conformité</strong> : lis la file, ouvre chaque brouillon, coche ce que ton interne demande.',
    guideOrderStep3Rich:
      '<strong>Publier un texte légal</strong> : importe le brouillon si besoin, remplis résumé et date (avec le délai légal), prévisualise, puis publie — les utilisateurs sont prévenus au bon moment.',
    guideOrderStep4Rich:
      'Utilise le <strong>Kit audit</strong> si un contrôleur veut des preuves propres.',
    guideLinksTitle: 'Les deux liens',
    guideLinksItem1Rich: '<strong>Ouvrir la conformité</strong> : la page avec brouillons et journal.',
    guideLinksItem2Rich:
      '<strong>Publier un texte légal</strong> : saute au formulaire plus bas sur cette même page admin.',
    guideMailsTitle: 'Mails',
    guideMailsP:
      'Un récap peut partir quand un brouillon naît. Vérifie les spams et que la bonne adresse admin est notée comme contact conformité.',
    scoreOutOf100: '/ 100',
    scoreIndexLabel: 'indice veille',
  },
  codeGuardian: {
    backPanelAdmin: 'Panel admin',
    backSecurity: 'Sécurité & Perfection',
    pageTitle: 'Code Guardian',
    pageBadge: 'Asset Health',
    introRich:
      'Le mécano du code : il regarde la saleté, les freins et les gros morceaux bancals, <strong>sans rien écrire tout seul</strong> dans Git. Tu copies la liste ou tu l’envoies à l’équipe pour corriger sur votre branche.',
    scoreLabel: 'Santé code',
    guideTitle: 'Explications simples — Code Guardian · Asset Health',
    guideIdeaTitle: 'L’idée',
    guideIdeaRich:
      '<strong>Code Guardian</strong> fait un <strong>contrôle technique en lecture seule</strong> : rangement, lenteurs possibles, gros soucis de structure. Rien ne part sur Git tout seul : c’est à vous de copier, coller ou ouvrir une branche.',
    guideScoreTitle: 'La note sur 100',
    guideScoreP:
      'Elle résume le dernier passage complet, pas « est-ce que le site est en ligne » (ça, c’est ailleurs). Une note qui baisse après une grosse livraison arrive souvent ; regarde surtout la tendance et les points marqués urgents.',
    guideAuditBtnTitle: 'Le bouton « audit »',
    guideAuditBtnRich:
      '<strong>Lancer l’audit de perfectionnement</strong> demande au serveur de refaire un tour du propriétaire. Tu obtiens une liste par thème et un <strong>fichier texte prêt à coller</strong> dans Jira, Linear ou une PR.',
    guideBenchTitle: 'Le petit banc d’essai',
    guideBenchRich:
      'Colle un <strong>extrait</strong> + deux lignes de contexte : avis rapide pour une relecture, <strong>sans exécuter</strong> le code et sans lire tes secrets.',
    guideHabitTitle: 'Bon réflexe',
    guideHabitP:
      'Un scan après gros refactor ou avant mise en prod ; tu traites d’abord ce qui crie « urgent », puis le reste. Garde l’export dans ton outil de suivi pour voir si ça s’améliore au fil des semaines.',
    detectorTitle: 'Détecteur',
    btnRunAudit: 'Lancer l’audit de perfectionnement',
    lastScanPrefix: 'Dernier passage :',
    noScanYet: 'Aucun scan encore — lancez un premier audit.',
    filterAll: 'Tout',
    filterUrgent: 'Critique',
    filterCleanup: 'Nettoyage',
    filterPerf: 'Perf.',
    filterStructure: 'Structure',
    findingsShownLine:
      '{shown, plural, one {# point affiché} other {# points affichés}} sur {total}',
    categoryCleanup: 'Nettoyage',
    categoryPerformance: 'Performance',
    categoryStructure: 'Structure',
    severityUrgent: 'critique',
    severityWatch: 'attention',
    severityInfo: 'info',
    openLab: 'Ouvrir le laboratoire (correctif suggéré)',
    filterNoMatch: 'Aucun point pour ce filtre — choisis « Tout » ou un autre thème.',
    copyReportBtn: 'Copier le rapport de nettoyage (journal Indigo)',
    toastReportCopied: 'Rapport markdown copié',
    labTitle: 'Laboratoire',
    labIntro:
      'Sélectionnez une carte ci-dessus pour afficher le correctif — copiez-le dans une branche dédiée. Pas de patch automatique sur le serveur.',
    copyLastFix: 'Copier le dernier correctif ouvert',
    labEmpty: 'Aucun point ouvert.',
    supremeTitle: 'Cour suprême',
    supremeIntro:
      'Petite relecture automatique sur un morceau de code que tu colles (sujets courants : sécurité, Stripe, Tailwind). Ça ne remplace ni les vrais tests ni un développeur qui relit.',
    placeholderContext: 'Contexte (ex: « refacto dashboard Stripe + Tailwind »)',
    placeholderCode: 'Collez ici le code proposé…',
    btnOperationalAudit: 'Lancer l’audit de sécurité opérationnelle',
    indigoTrackTitle: 'Piste Indigo',
    journalEmpty: 'Vide — les scans apparaissent ici.',
    modalClose: 'Fermer',
    suggestedFixHeading: 'Correctif suggéré',
    copyForCursor: 'Copier pour Cursor',
    toastCopiedShort: 'Copié',
    toastLoadFailed: 'Chargement impossible',
    toastScanFailed: 'Échec du scan',
    toastAuditFailed: 'Audit impossible',
    toastTechnicalDebt: 'Dette technique : {score}/100',
    toastVerdictOk: 'Verdict : conforme (contrôles statiques).',
    toastVerdictReview: 'Points à revoir',
    toastCopyFailed: 'Copie impossible',
    toastCopyOk: 'Correctif copié',
    errGeneric: 'Erreur',
    draftDismissConfirm:
      'Écarter ce brouillon ? Tu pourras relancer une veille au prochain cycle.',
    draftServerError: 'Erreur serveur',
    draftVerifyLabel: 'Je certifie avoir relu sources + brouillon',
    draftDismiss: 'Écarter',
    draftVerifiedLine:
      'Vérifié le {date} — tu peux importer le brouillon dans « Publier une nouvelle version ».',
  },
  growthEquirectMap: {
    projectionTitle: 'Projection equirectangulaire · zoom',
    mapZoomAria: 'Zoom carte',
    emptyHint:
      'Aucun point géolocalisé. Lancez le sniper (Places) ou renseignez lat/lng sur les établissements clients.',
  },
};

export const ADMIN_PANELS_EN = {
  complianceSentinel: {
    listBullet: '●',
    title: 'Compliance agent',
    introRich:
      'A <strong>watch assistant</strong> monitors relevant news (data protection authorities, data rules, signals around online reviews, consumer topics). When something important shifts, it may prepare a <strong>draft</strong> text — always for a human to review before publication.',
    bulletPersonalDataRich:
      '<strong>Personal data</strong> — new rules or major reminders from authorities when they show up in the watch feed.',
    bulletGoogleReviewsRich:
      '<strong>Google listings / reviews</strong> — anything that affects how reviews are collected or displayed when sources cover it.',
    bulletTransparencyRich:
      '<strong>Customer info and transparency</strong> — topics like clear pricing, fine print, loyalty when the watch spots them.',
    scoreLabel_error: 'Check failed',
    scoreLabel_actionRecommended: 'Admin action recommended',
    scoreLabel_watchSuggested: 'Watch: review suggested',
    scoreLabel_ok: 'Compliant (watch up to date)',
    scoreLabel_pendingFirst: 'Awaiting first watch run',
    relNever: 'never',
    relJustNow: 'just now',
    relMinutes: '{count} min ago',
    relHours: '{count} h ago',
    statusPrefix: 'Status:',
    lastWatchPrefix: 'Last watch:',
    lastWatchTour: '(watch run)',
    pendingDocsTitle: 'Pending documents:',
    pendingDocsLine:
      '{count, plural, =0 {no suggestions in queue} one {# suggested change} other {# suggested changes}}',
    emailFallbackRich:
      'When a draft is ready, the admin email includes a summary and text preview (dual AI review Claude + GPT-4o) — it publishes nothing without you. Check spam and the right inbox (<code>ADMIN_COMPLIANCE_EMAIL</code> or admin profile).',
    ctaCompliance: 'Open compliance',
    ctaPublishLegal: 'Publish a legal text',
    guideTitle: 'Plain-language notes — Compliance agent & Legal Guardian',
    guideWhatTitle: 'What is it?',
    guideWhatRich:
      '<strong>Guardian</strong> scans useful news and may propose <strong>drafts</strong> for terms, privacy, or notices. <strong>You</strong> keep final legal say: nothing goes live without human approval.',
    guideColorTitle: 'The small color badge',
    guideColorRich:
      '<strong>Green</strong>: last run looked good. <strong>Orange</strong>: no run yet or drafts still pending. <strong>Red</strong>: the last run failed. It is <strong>not</strong> a lawyer: counsel a real attorney for major issues.',
    guideOrderTitle: 'Suggested order',
    guideOrderStep1: 'Watch this card and your email when a draft is ready.',
    guideOrderStep2Rich:
      '<strong>Open compliance</strong>: read the queue, open each draft, tick what your internal process requires.',
    guideOrderStep3Rich:
      '<strong>Publish a legal text</strong>: import the draft if needed, fill summary and date (with legal lead time), preview, then publish — users are notified at the right time.',
    guideOrderStep4Rich:
      'Use the <strong>audit kit</strong> if an auditor wants clean evidence.',
    guideLinksTitle: 'The two links',
    guideLinksItem1Rich: '<strong>Open compliance</strong>: the page with drafts and the log.',
    guideLinksItem2Rich:
      '<strong>Publish a legal text</strong>: jumps to the form further down on this same admin page.',
    guideMailsTitle: 'Email',
    guideMailsP:
      'A recap may send when a draft appears. Check spam and that the correct admin address is listed as the compliance contact.',
    scoreOutOf100: '/ 100',
    scoreIndexLabel: 'watch index',
  },
  codeGuardian: {
    backPanelAdmin: 'Admin panel',
    backSecurity: 'Security & perfection',
    pageTitle: 'Code Guardian',
    pageBadge: 'Asset Health',
    introRich:
      'Your code mechanic: it spots clutter, drag, and shaky structure, <strong>without writing to Git on its own</strong>. Copy the list or hand it to the team to fix on your branch.',
    scoreLabel: 'Code health',
    guideTitle: 'Plain-language notes — Code Guardian · Asset Health',
    guideIdeaTitle: 'The idea',
    guideIdeaRich:
      '<strong>Code Guardian</strong> runs a <strong>read-only technical check</strong>: cleanup, possible slowdowns, structural issues. Nothing is pushed to Git automatically — you copy, paste, or open a branch.',
    guideScoreTitle: 'The score out of 100',
    guideScoreP:
      'It reflects the last full pass, not “is the site online” (that’s elsewhere). A dip after a big ship is common; focus on trend and urgent-tagged items.',
    guideAuditBtnTitle: 'The “audit” button',
    guideAuditBtnRich:
      '<strong>Run the improvement audit</strong> asks the server for another full pass. You get a themed list and a <strong>plain-text export</strong> ready for Jira, Linear, or a PR.',
    guideBenchTitle: 'The small lab',
    guideBenchRich:
      'Paste a <strong>snippet</strong> plus a couple of context lines: quick review feedback, <strong>without executing</strong> code or reading your secrets.',
    guideHabitTitle: 'Good habit',
    guideHabitP:
      'Scan after a big refactor or before production; tackle “urgent” first, then the rest. Keep the export in your tracker to see improvement over weeks.',
    detectorTitle: 'Scanner',
    btnRunAudit: 'Run improvement audit',
    lastScanPrefix: 'Last run:',
    noScanYet: 'No scan yet — run a first audit.',
    filterAll: 'All',
    filterUrgent: 'Critical',
    filterCleanup: 'Cleanup',
    filterPerf: 'Perf.',
    filterStructure: 'Structure',
    findingsShownLine:
      '{shown, plural, one {# item shown} other {# items shown}} of {total}',
    categoryCleanup: 'Cleanup',
    categoryPerformance: 'Performance',
    categoryStructure: 'Structure',
    severityUrgent: 'critical',
    severityWatch: 'watch',
    severityInfo: 'info',
    openLab: 'Open lab (suggested fix)',
    filterNoMatch: 'No items for this filter — choose “All” or another theme.',
    copyReportBtn: 'Copy cleanup report (Indigo log)',
    toastReportCopied: 'Markdown report copied',
    labTitle: 'Lab',
    labIntro:
      'Pick a card above to show the suggested fix — copy it into a dedicated branch. No automatic patch on the server.',
    copyLastFix: 'Copy last open fix',
    labEmpty: 'No item open.',
    supremeTitle: 'Supreme bench',
    supremeIntro:
      'Lightweight automated review on code you paste (common topics: security, Stripe, Tailwind). It does not replace real tests or a developer review.',
    placeholderContext: 'Context (e.g. “Stripe + Tailwind dashboard refactor”)',
    placeholderCode: 'Paste proposed code here…',
    btnOperationalAudit: 'Run operational security audit',
    indigoTrackTitle: 'Indigo track',
    journalEmpty: 'Empty — scans appear here.',
    modalClose: 'Close',
    suggestedFixHeading: 'Suggested fix',
    copyForCursor: 'Copy for Cursor',
    toastCopiedShort: 'Copied',
    toastLoadFailed: 'Could not load',
    toastScanFailed: 'Scan failed',
    toastAuditFailed: 'Audit failed',
    toastTechnicalDebt: 'Technical debt: {score}/100',
    toastVerdictOk: 'Verdict: compliant (static checks).',
    toastVerdictReview: 'Items to revisit',
    toastCopyFailed: 'Could not copy',
    toastCopyOk: 'Fix copied',
    errGeneric: 'Error',
    draftDismissConfirm:
      'Dismiss this draft? You can trigger another watch on the next cycle.',
    draftServerError: 'Server error',
    draftVerifyLabel: 'I certify I reviewed sources and the draft',
    draftDismiss: 'Dismiss',
    draftVerifiedLine:
      'Verified on {date} — you can import the draft in “Publish a new version”.',
  },
  growthEquirectMap: {
    projectionTitle: 'Equirectangular projection · zoom',
    mapZoomAria: 'Map zoom',
    emptyHint:
      'No geolocated points. Run the Places sniper or add lat/lng on customer establishments.',
  },
};
