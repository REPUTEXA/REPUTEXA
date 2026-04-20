/**
 * Fusionne Dashboard.bananoLoyaltySettings et Dashboard.bananoStaffSettings
 * dans chaque messages/{locale}.json
 * Exécuter : node scripts/merge-banano-dashboard-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES = path.join(__dirname, '..', 'messages');

const bananoLoyaltySettings = {
  fr: {
    toastPresetApplied:
      'Période « {label} » : {start} → {end} — double-clic pour ajuster les dates.',
    toastUserPresetApplied: 'Période « {label} » appliquée.',
    toastCustomCreated:
      'Événement perso créé — modifiez le nom et les dates, puis « Appliquer ».',
    toastEndAfterStart: 'La fin doit être après ou égale au début.',
    toastBonusDatesSaved: 'Dates du bonus enregistrées dans le formulaire.',
    toastEventDeleted: 'Événement supprimé.',
    defaultEventLabel: 'Événement',
    defaultMyEvent: 'Mon événement',
    errThresholdPoints: 'Programme points : seuil au moins égal à 1.',
    errThresholdStamps: 'Programme tampons : seuil au moins égal à 1.',
    errPointsPerEuro:
      'Indiquez combien de points par euro TTC pour le programme points (ex. 1).',
    errStampsProgram:
      'Programme tampons : indiquez soit des tampons par euro TTC, soit un forfait par achat (> 0).',
    errStampsFlat: 'Tampons forfait par achat : 0 — 10 000.',
    errRewardPtsLen: 'Libellé récompense (points) : 1 à 2000 caractères.',
    errRewardStLen: 'Libellé récompense (tampons) : 1 à 2000 caractères.',
    errBonusPointsNeedEnable:
      'Cochez « Activer le bonus » et enregistrez avec des dates : sinon le « points bonus par € » n’est pas appliqué à la caisse.',
    errBonusStampsNeedEnable:
      'Cochez « Activer le bonus » avec des dates : sinon le « tampons bonus par € » n’est pas appliqué.',
    errBonusNeedDates: 'Bonus : renseignez la date de début et de fin.',
    errBonusEndBeforeStart: 'La fin de période doit être après ou égale au début.',
    errBonusPointsPerEuro:
      'Mode Points : indiquez des points bonus par euro TTC (> 0) — ils s’ajoutent au taux de base (ex. 1 + 1 = 2 pt/€).',
    errBonusStampsPerEuro:
      'Mode Tampons : indiquez des tampons bonus par euro TTC (> 0) sur la période.',
    errVoucherPercent:
      '{context} : pourcentage bon entre 0 et 100 (ex. 5 pour 5 %).',
    errVoucherEuro: '{context} : montant bon invalide (ex. 5 ou 5,50).',
    errVoucherValidity: 'Validité des bons : 1 à 3650 jours, ou vide.',
    errGeneric: 'Erreur',
    toastSavedSuccess: 'Programme enregistré — le terminal se met à jour en direct.',
    voucherCtxPoints: 'Bon programme points',
    voucherCtxStamps: 'Bon programme tampons',
    voucherTitle: "Bon d'achat au seuil ({unit} · usage unique, archivé, QR en caisse)",
    unitPointsLower: 'points',
    unitStampsLower: 'tampons',
    unitPointsCap: 'Points',
    unitStampsCap: 'Tampons',
    voucherIntro:
      'À chaque passage caisse, dès que le total de {unit} dépasse l’objectif ci-dessus, un bon est créé automatiquement et le client garde le reliquat de {unit}. L’avantage se valide uniquement avec le code (ou QR) du bon — pas de débit manuel du carnet.',
    voucherNatureLabel: 'Nature de l’avantage affiché sur le bon',
    optLabelOnly: 'Libellé seul (champ « libellé » ci-dessus)',
    optPercentLabel: 'Pourcentage + libellé',
    optFixedEuro: 'Montant fixe (€) + libellé',
    pctOnVoucherLabel: 'Pourcentage imprimé sur le bon (ex. 5 → 5 %)',
    euroAmountLabel: 'Montant en euros (ex. 5 ou 5,50)',
    validityDaysLabel: 'Durée de validité (jours après émission ; vide = sans limite)',
    validityPlaceholder: 'ex. 90',
    whatsappCheckbox:
      'Envoyer automatiquement le code du bon par WhatsApp à la création (numéro client requis).',
    settingsCardTitle: 'Réglages fidélité (employés : même programme en direct)',
    modeActiveLabel: 'Mode actif',
    modePoints: 'Points',
    modeStamps: 'Tampons',
    modePointsHelp:
      'La caisse crédite des points selon le montant du ticket (€ × taux, arrondi supérieur) + bonus éventuel.',
    modeStampsHelp:
      'La caisse crédite des tampons : soit selon le ticket (€ × taux), soit au forfait par achat, ou les deux.',
    programPointsTitle: 'Programme en points',
    programStampsTitle: 'Programme en tampons',
    goalPointsLabel: 'Objectif : combien de points pour débloquer la récompense ?',
    goalStampsLabel: 'Objectif : combien de tampons pour la récompense ?',
    rewardLabelPoints: 'Libellé sur le bon et à l’écran caisse',
    rewardLabelStamps: 'Libellé sur le bon et à l’écran caisse (ex. 1 menu offert, -15 %…)',
    rewardPlaceholderPoints: '-10 %, menu offert, 10 € sur l’addition…',
    rewardPlaceholderStamps: 'ex. 10 achats = 1 menu offert',
    creditPointsLabel:
      'Crédit : 1 € TTC = combien de points ? (obligatoire · arrondi supérieur sur le ticket)',
    creditPlaceholder: 'ex. 1',
    stampsPerEuroLabel:
      'Tampons par euro TTC (0 = ignorer le montant : utiliser seulement le forfait ci-dessous)',
    stampsPerEuroPlaceholder: 'ex. 0,1 pour ~1 tampon / 10 €',
    stampsPerEuroHelpA: 'Arrondi supérieur sur le TTC. Ex. taux',
    stampsPerEuroHelpStrong: '0,1',
    stampsPerEuroHelpB: '→ 25 € =',
    stampsPerEuroHelpC:
      '{count, plural, one {# tampon} other {# tampons}}. Laissez 0 si vous voulez uniquement un forfait fixe par achat.',
    stampsFlatLabel:
      'Tampons forfait par achat (s’ajoute au montant ticket si les deux sont utilisés)',
    recapCashTitle: 'Récap · ce que la caisse applique',
    recapCashSubtitle:
      'Un seul arrondi au supérieur sur le montant TTC × taux total (base ± bonus par €).',
    recapRewardLine:
      '{reward} : dès {threshold} {threshold, plural, one {point} other {points}} → bon au seuil = {text}',
    recapRewardBold: 'Récompense :',
    recapOffBonusTitle: 'Hors période bonus',
    recapOffBonusRest:
      '(dates non couvertes ou bonus désactivé) : {rate} pt/€ — ex. 1,20 € → {exA} pts · 50,01 € → {exB} pts.',
    recapBonusPeriod:
      'Période bonus du {start} au {end} (Europe/Paris, jours inclus) : taux total {rate} pt/€ ({base} base + {bonus} bonus) — ex. 1,20 € → {exA} pts · 50,01 € → {exB} pts.',
    recapBonusHintIncomplete:
      'Renseignez les dates et le « points bonus par € » ci-dessous pour afficher ici le taux pendant l’événement.',
    recapStampsTitle: 'Récap · tampons sur le ticket',
    recapStampsCardLine:
      '{carte} : au passage en caisse, dès {threshold} {threshold, plural, one {tampon} other {tampons}} cumulés, un {bon} (code + QR) est créé ; le client garde le reliquat en tampons. La récompense s’encaisse comme en mode points (validation du bon).',
    recapStampsCarteBold: 'Carte tampons :',
    recapStampsBon: 'bon d’achat',
    recapStampsDisplayLine:
      '{affichage} : « {text} » (et avantage % / € si configuré sur le bon tampons).',
    recapStampsAffichageBold: 'Affichage :',
    recapOffBonusStamps:
      '{title} : {rate} {rateWord} — ex. 24,90 € → {ex} sur le ticket',
    recapOffBonusStampsTitle: 'Hors période bonus',
    recapStampPerEuro: '{n} {n, plural, one {tampon} other {tampons}}/€',
    recapFlatPlus: '+ {n} forfait / achat',
    recapBonusStampsLine:
      'Période bonus du {start} au {end} : taux total {rate} — ex. 24,90 € → {ex}{flat}',
    recapFlatShort: '+ {n} forfait',
    recapStampsBonusHint:
      'Indiquez dates + tampons bonus / € pour voir le taux combiné pendant l’événement.',
    recapFlatOnlyLine:
      '{forfait} : +{n} {n, plural, one {tampon} other {tampons}} (sans montant ticket). Bonus éventuel : voir réglages ci-dessous.',
    recapFlatOnlyBold: 'Forfait par achat',
    recapDefineRateOrFlat:
      'Définissez un taux par € ou un forfait par achat dans le formulaire ci-dessus.',
    bonusDetailsTitle: 'Bonus période (optionnel · fuseau Europe/Paris)',
    bonusDetailsLead:
      'Le bonus ajoute un {strong} au programme (ex. base 1 pt/€ + bonus 1 pt/€ = {rate2}, un seul arrondi au supérieur sur le total : 50,01 € → 101 pts).',
    bonusDetailsStrong: 'taux par euro TTC',
    legacyFlatWarning:
      'Ancien réglage détecté : forfait +{n} pt/achat. Enregistrez avec le nouveau champ « par euro » pour basculer — le forfait ne sera plus utilisé.',
    periodsTypicalTitle: 'Périodes types ·',
    periodsTypicalHint: 'clic = appliquer · double-clic = ajuster les dates',
    presetDblClickTitle: 'Double-clic pour modifier les dates avant d’appliquer',
    userPresetDblClickTitle: 'Double-clic pour renommer ou modifier les dates',
    addCustomEventButton: '+ Événement perso',
    editorAdjustBuiltin: 'Ajuster « {label} »',
    editorCustomEvent: 'Événement personnalisé',
    buttonNameLabel: 'Nom affiché sur le bouton',
    dateStartLabel: 'Début',
    dateEndLabel: 'Fin',
    applyBonus: 'Appliquer au bonus',
    close: 'Fermer',
    deleteEvent: 'Supprimer l’événement',
    enableBonusCheckbox: 'Activer le bonus sur les dates ci-dessous',
    bonusStartInclusive: 'Début (inclus)',
    bonusEndInclusive: 'Fin (inclus)',
    bonusPointsPerEuroLabel: 'Points bonus par euro TTC (s’ajoutent au taux de base sur la période)',
    bonusPointsPlaceholder: 'ex. 1 pour doubler un taux base 1 pt/€',
    bonusStampsPerEuroLabel:
      'Tampons bonus par euro TTC (s’ajoutent au taux tampons/€ sur la période)',
    bonusStampsPlaceholder: 'ex. 0,1',
    todayParisPrefix: 'Aujourd’hui (Paris)',
    bonusActive: 'actif',
    seeGreenRecapExamples: 'sur chaque ticket (exemples chiffrés dans le récap vert).',
    todayBaseOnly: '{rate} (taux base).',
    todayOutsideWindow: 'Ce jour est hors fenêtre bonus (Paris) — voir ci-dessous.',
    todaySeeGreenRecap: 'Pour les dates bonus, voir le récap vert.',
    todayWindowLine:
      'Fenêtre {start} → {end} (inclus, Paris) : aujourd’hui la caisse applique {rate} uniquement (sans le +{bonus} bonus).',
    definePointsRate: 'Définissez le taux points/€ ci-dessus.',
    stampsTodayOutside: ' — ce jour : hors fenêtre bonus (Paris).',
    stampsTodaySeeGreen: ' — détail période dans le récap vert.',
    stampsWindowLine: 'Sur la fenêtre {start} → {end} : {rate} (voir récap vert).',
    flatPreview:
      '{flat} : +{n} {n, plural, one {tampon} other {tampons}} / achat (sans montant ticket).',
    flatPreviewBold: 'Aperçu forfait',
    saveSettings: 'Enregistrer les réglages',
    preset_noel: 'Noël',
    preset_nouvel_an: 'Nouvel An',
    preset_st_valentin: 'Saint-Valentin',
    preset_ete: 'Été',
    ptsAbbr: 'pts',
  },
};

// English (source for UI when locale is en)
bananoLoyaltySettings.en = {
  toastPresetApplied:
    'Period “{label}”: {start} → {end} — double-click to adjust the dates.',
  toastUserPresetApplied: 'Period “{label}” applied.',
  toastCustomCreated:
    'Custom event created — edit the name and dates, then “Apply”.',
  toastEndAfterStart: 'The end date must be on or after the start date.',
  toastBonusDatesSaved: 'Bonus dates saved to the form.',
  toastEventDeleted: 'Event removed.',
  defaultEventLabel: 'Event',
  defaultMyEvent: 'My event',
  errThresholdPoints: 'Points program: threshold must be at least 1.',
  errThresholdStamps: 'Stamp program: threshold must be at least 1.',
  errPointsPerEuro: 'Enter how many points per € incl. tax for the points program (e.g. 1).',
  errStampsProgram:
    'Stamp program: enter either stamps per € incl. tax or a per-purchase flat amount (> 0).',
  errStampsFlat: 'Flat stamps per purchase: 0 — 10,000.',
  errRewardPtsLen: 'Reward label (points): between 1 and 2000 characters.',
  errRewardStLen: 'Reward label (stamps): between 1 and 2000 characters.',
  errBonusPointsNeedEnable:
    'Enable “Activate bonus” and save with dates — otherwise “bonus points per €” is not applied at checkout.',
  errBonusStampsNeedEnable:
    'Enable “Activate bonus” with dates — otherwise “bonus stamps per €” is not applied.',
  errBonusNeedDates: 'Bonus: enter both start and end dates.',
  errBonusEndBeforeStart: 'The end of the period must be on or after the start.',
  errBonusPointsPerEuro:
    'Points mode: enter bonus points per € incl. tax (> 0) — they add to the base rate (e.g. 1 + 1 = 2 pts/€).',
  errBonusStampsPerEuro:
    'Stamps mode: enter bonus stamps per € incl. tax (> 0) for the period.',
  errVoucherPercent: '{context}: voucher percentage must be between 0 and 100 (e.g. 5 for 5%).',
  errVoucherEuro: '{context}: invalid voucher amount (e.g. 5 or 5.50).',
  errVoucherValidity: 'Voucher validity: 1 to 3650 days, or leave empty.',
  errGeneric: 'Error',
  toastSavedSuccess: 'Program saved — the terminal updates live.',
  voucherCtxPoints: 'Points program voucher',
  voucherCtxStamps: 'Stamp program voucher',
  voucherTitle: 'Purchase voucher at threshold ({unit} · single use, archived, QR at checkout)',
  unitPointsLower: 'points',
  unitStampsLower: 'stamps',
  unitPointsCap: 'Points',
  unitStampsCap: 'Stamps',
  voucherIntro:
    'Each time at checkout, when the total {unit} exceeds the goal above, a voucher is created automatically and the customer keeps the leftover {unit}. The benefit is only validated with the voucher code or QR — no manual stamp book debit.',
  voucherNatureLabel: 'Type of benefit shown on the voucher',
  optLabelOnly: 'Label only (the “label” field above)',
  optPercentLabel: 'Percentage + label',
  optFixedEuro: 'Fixed amount (€) + label',
  pctOnVoucherLabel: 'Percentage printed on the voucher (e.g. 5 → 5%)',
  euroAmountLabel: 'Amount in euros (e.g. 5 or 5.50)',
  validityDaysLabel: 'Validity period (days after issue; empty = no limit)',
  validityPlaceholder: 'e.g. 90',
  whatsappCheckbox:
    'Automatically send the voucher code by WhatsApp when created (customer phone required).',
  settingsCardTitle: 'Loyalty settings (staff: same live program)',
  modeActiveLabel: 'Active mode',
  modePoints: 'Points',
  modeStamps: 'Stamps',
  modePointsHelp:
    'Checkout credits points from the ticket amount (€ × rate, rounded up) + optional bonus.',
  modeStampsHelp:
    'Checkout credits stamps: either from the ticket (€ × rate), or a flat per purchase, or both.',
  programPointsTitle: 'Points program',
  programStampsTitle: 'Stamp program',
  goalPointsLabel: 'Goal: how many points to unlock the reward?',
  goalStampsLabel: 'Goal: how many stamps for the reward?',
  rewardLabelPoints: 'Label on the voucher and checkout screen',
  rewardLabelStamps: 'Label on the voucher and checkout screen (e.g. 1 free menu, -15%…)',
  rewardPlaceholderPoints: '-10%, free menu, €10 off the bill…',
  rewardPlaceholderStamps: 'e.g. 10 purchases = 1 free menu',
  creditPointsLabel:
    'Credit: 1 € incl. tax = how many points? (required · rounded up on the ticket)',
  creditPlaceholder: 'e.g. 1',
  stampsPerEuroLabel:
    'Stamps per € incl. tax (0 = ignore amount: use only the flat rate below)',
  stampsPerEuroPlaceholder: 'e.g. 0.1 for ~1 stamp / €10',
  stampsPerEuroHelpA: 'Rounded up on incl. tax. E.g. rate',
  stampsPerEuroHelpStrong: '0.1',
  stampsPerEuroHelpB: '→ €25 =',
  stampsPerEuroHelpC: '{count, plural, one {# stamp} other {# stamps}}. Leave 0 if you only want a fixed amount per purchase.',
  stampsFlatLabel: 'Flat stamps per purchase (adds to ticket amount if both are used)',
  recapCashTitle: 'Summary · what checkout applies',
  recapCashSubtitle:
    'A single round-up on the incl. tax total × combined rate (base ± bonus per €).',
  recapRewardLine:
    '{reward} from {threshold} {threshold, plural, one {point} other {points}} → threshold voucher = {text}',
  recapRewardBold: 'Reward:',
  recapOffBonusTitle: 'Outside bonus period',
  recapOffBonusRest:
    '(dates not covered or bonus off): {rate} pts/€ — e.g. €1.20 → {exA} pts · €50.01 → {exB} pts.',
  recapBonusPeriod:
    'Bonus period {start} to {end} (Europe/Paris, inclusive): total rate {rate} pts/€ ({base} base + {bonus} bonus) — e.g. €1.20 → {exA} pts · €50.01 → {exB} pts.',
  recapBonusHintIncomplete:
    'Enter the dates and “bonus points per €” below to show the rate during the event here.',
  recapStampsTitle: 'Summary · stamps on the ticket',
  recapStampsCardLine:
    '{carte} at checkout, once {threshold} {threshold, plural, one {stamp} other {stamps}} are collected, a {bon} (code + QR) is created; the customer keeps leftover stamps. The reward is redeemed like in points mode (voucher validation).',
  recapStampsCarteBold: 'Stamp card:',
  recapStampsBon: 'purchase voucher',
  recapStampsDisplayLine:
    '{affichage} “{text}” (and % / € benefit if set on the stamp voucher).',
  recapStampsAffichageBold: 'Display:',
  recapOffBonusStamps: '{title}: {rate} — e.g. €24.90 → {ex} on the ticket',
  recapOffBonusStampsTitle: 'Outside bonus period',
  recapStampPerEuro: '{n} {n, plural, one {stamp} other {stamps}}/€',
  recapFlatPlus: '+ {n} flat / purchase',
  recapBonusStampsLine:
    'Bonus period {start} to {end}: total rate {rate} — e.g. €24.90 → {ex}{flat}',
  recapFlatShort: '+ {n} flat',
  recapStampsBonusHint:
    'Enter dates + bonus stamps per € to see the combined rate during the event.',
  recapFlatOnlyLine:
    '{forfait}: +{n} {n, plural, one {stamp} other {stamps}} (no ticket amount). Optional bonus: see settings below.',
  recapFlatOnlyBold: 'Flat per purchase',
  recapDefineRateOrFlat: 'Set a rate per € or a flat amount per purchase in the form above.',
  bonusDetailsTitle: 'Bonus period (optional · Europe/Paris timezone)',
  bonusDetailsLead:
    'Bonus adds a {strong} to the program (e.g. base 1 pt/€ + bonus 1 pt/€ = {rate2}, one round-up on the total: €50.01 → 101 pts).',
  bonusDetailsStrong: 'rate per € incl. tax',
  legacyFlatWarning:
    'Legacy setting detected: flat +{n} pts/purchase. Save with the new “per euro” field to migrate — the flat will no longer be used.',
  periodsTypicalTitle: 'Typical periods ·',
  periodsTypicalHint: 'click = apply · double-click = adjust dates',
  presetDblClickTitle: 'Double-click to change dates before applying',
  userPresetDblClickTitle: 'Double-click to rename or change dates',
  addCustomEventButton: '+ Custom event',
  editorAdjustBuiltin: 'Adjust “{label}”',
  editorCustomEvent: 'Custom event',
  buttonNameLabel: 'Name shown on the button',
  dateStartLabel: 'Start',
  dateEndLabel: 'End',
  applyBonus: 'Apply to bonus',
  close: 'Close',
  deleteEvent: 'Remove event',
  enableBonusCheckbox: 'Enable bonus on the dates below',
  bonusStartInclusive: 'Start (inclusive)',
  bonusEndInclusive: 'End (inclusive)',
  bonusPointsPerEuroLabel: 'Bonus points per € incl. tax (add to base rate in the period)',
  bonusPointsPlaceholder: 'e.g. 1 to double a 1 pt/€ base rate',
  bonusStampsPerEuroLabel: 'Bonus stamps per € incl. tax (add to stamp rate in the period)',
  bonusStampsPlaceholder: 'e.g. 0.1',
  todayParisPrefix: 'Today (Paris)',
  bonusActive: 'active',
  seeGreenRecapExamples: 'on each ticket (examples in the green summary).',
  todayBaseOnly: '{rate} (base rate).',
  todayOutsideWindow: 'Today is outside the bonus window (Paris) — see below.',
  todaySeeGreenRecap: 'For bonus dates, see the green summary.',
  todayWindowLine:
    'Window {start} → {end} (inclusive, Paris): today checkout applies {rate} only (without the +{bonus} bonus).',
  definePointsRate: 'Set the points/€ rate above.',
  stampsTodayOutside: ' — today: outside bonus window (Paris).',
  stampsTodaySeeGreen: ' — period details in the green summary.',
  stampsWindowLine: 'On window {start} → {end}: {rate} (see green summary).',
  flatPreview:
    '{flat}: +{n} {n, plural, one {stamp} other {stamps}} / purchase (no ticket amount).',
  flatPreviewBold: 'Flat preview',
  saveSettings: 'Save settings',
  preset_noel: 'Christmas',
  preset_nouvel_an: 'New Year',
  preset_st_valentin: "Valentine's Day",
  preset_ete: 'Summer',
  ptsAbbr: 'pts',
};

// German — aligned meaning EN/FR
bananoLoyaltySettings.de = {
  toastPresetApplied:
    'Zeitraum „{label}“: {start} → {end} — Doppelklick zum Anpassen der Daten.',
  toastUserPresetApplied: 'Zeitraum „{label}“ angewendet.',
  toastCustomCreated:
    'Eigenes Ereignis erstellt — Name und Daten ändern, dann „Anwenden“.',
  toastEndAfterStart: 'Das Enddatum muss am oder nach dem Startdatum liegen.',
  toastBonusDatesSaved: 'Bonusdaten im Formular gespeichert.',
  toastEventDeleted: 'Ereignis entfernt.',
  defaultEventLabel: 'Ereignis',
  defaultMyEvent: 'Mein Ereignis',
  errThresholdPoints: 'Punkteprogramm: Schwellenwert mindestens 1.',
  errThresholdStamps: 'Stempelprogramm: Schwellenwert mindestens 1.',
  errPointsPerEuro: 'Geben Sie an, wie viele Punkte pro € inkl. MwSt. (z. B. 1).',
  errStampsProgram:
    'Stempelprogramm: entweder Stempel pro € inkl. MwSt. oder Pauschalbetrag pro Einkauf (> 0).',
  errStampsFlat: 'Pauschal-Stempel pro Einkauf: 0 — 10.000.',
  errRewardPtsLen: 'Belohnungstext (Punkte): 1 bis 2000 Zeichen.',
  errRewardStLen: 'Belohnungstext (Stempel): 1 bis 2000 Zeichen.',
  errBonusPointsNeedEnable:
    '„Bonus aktivieren“ anhaken und mit Daten speichern — sonst wird „Bonuspunkte pro €“ an der Kasse nicht angewendet.',
  errBonusStampsNeedEnable:
    '„Bonus aktivieren“ mit Daten — sonst werden „Bonusstempel pro €“ nicht angewendet.',
  errBonusNeedDates: 'Bonus: Start- und Enddatum angeben.',
  errBonusEndBeforeStart: 'Das Ende der Periode muss am oder nach dem Beginn liegen.',
  errBonusPointsPerEuro:
    'Punkte-Modus: Bonuspunkte pro € inkl. MwSt. (> 0) — addieren sich zum Basiswert (z. B. 1 + 1 = 2 Pt./€).',
  errBonusStampsPerEuro:
    'Stempel-Modus: Bonusstempel pro € inkl. MwSt. (> 0) für die Periode.',
  errVoucherPercent: '{context}: Gutscheinprozentsatz zwischen 0 und 100 (z. B. 5 für 5 %).',
  errVoucherEuro: '{context}: ungültiger Gutscheinbetrag (z. B. 5 oder 5,50).',
  errVoucherValidity: 'Gültigkeit der Gutscheine: 1 bis 3650 Tage oder leer.',
  errGeneric: 'Fehler',
  toastSavedSuccess: 'Programm gespeichert — Terminal aktualisiert live.',
  voucherCtxPoints: 'Gutschein Punkteprogramm',
  voucherCtxStamps: 'Gutschein Stempelprogramm',
  voucherTitle:
    'Kauf-Gutschein an der Schwelle ({unit} · einmalig, archiviert, QR an der Kasse)',
  unitPointsLower: 'Punkte',
  unitStampsLower: 'Stempel',
  unitPointsCap: 'Punkte',
  unitStampsCap: 'Stempel',
  voucherIntro:
    'Bei jedem Kassiervorgang überschreitet der {unit}-Gesamtwert das Ziel, wird automatisch ein Gutschein erstellt und der Kunde behält den {unit}-Rest. Der Vorteil gilt nur mit Gutscheincode oder QR — kein manueller Abzug.',
  voucherNatureLabel: 'Art des Vorteils auf dem Gutschein',
  optLabelOnly: 'Nur Bezeichnung (Feld „Bezeichnung“ oben)',
  optPercentLabel: 'Prozentsatz + Bezeichnung',
  optFixedEuro: 'Fester Betrag (€) + Bezeichnung',
  pctOnVoucherLabel: 'Auf dem Gutschein gedruckter Prozentsatz (z. B. 5 → 5 %)',
  euroAmountLabel: 'Betrag in Euro (z. B. 5 oder 5,50)',
  validityDaysLabel: 'Gültigkeit (Tage nach Ausgabe; leer = unbegrenzt)',
  validityPlaceholder: 'z. B. 90',
  whatsappCheckbox:
    'Gutscheincode bei Erstellung automatisch per WhatsApp senden (Kundentelefon erforderlich).',
  settingsCardTitle: 'Treue-Einstellungen (Personal: gleiches Live-Programm)',
  modeActiveLabel: 'Aktiver Modus',
  modePoints: 'Punkte',
  modeStamps: 'Stempel',
  modePointsHelp:
    'Kasse gutschreibt Punkte nach Bonbetrag (€ × Satz, aufrunden) + optionaler Bonus.',
  modeStampsHelp:
    'Kasse gutschreibt Stempel: nach Bon (€ × Satz), Pauschal pro Einkauf oder beides.',
  programPointsTitle: 'Punkteprogramm',
  programStampsTitle: 'Stempelprogramm',
  goalPointsLabel: 'Ziel: wie viele Punkte für die Belohnung?',
  goalStampsLabel: 'Ziel: wie viele Stempel für die Belohnung?',
  rewardLabelPoints: 'Bezeichnung auf Gutschein und Kassenbildschirm',
  rewardLabelStamps: 'Bezeichnung auf Gutschein und Kasse (z. B. 1 Menü gratis, -15 %…)',
  rewardPlaceholderPoints: '-10 %, gratis Menü, 10 € vom Betrag…',
  rewardPlaceholderStamps: 'z. B. 10 Einkäufe = 1 Menü gratis',
  creditPointsLabel:
    'Gutschrift: 1 € inkl. MwSt. = wie viele Punkte? (Pflicht · Aufrunden auf dem Bon)',
  creditPlaceholder: 'z. B. 1',
  stampsPerEuroLabel:
    'Stempel pro € inkl. MwSt. (0 = Betrag ignorieren: nur Pauschal unten)',
  stampsPerEuroPlaceholder: 'z. B. 0,1 für ~1 Stempel / 10 €',
  stampsPerEuroHelpA: 'Aufrunden auf Brutto. Z. B. Satz',
  stampsPerEuroHelpStrong: '0,1',
  stampsPerEuroHelpB: '→ 25 € =',
  stampsPerEuroHelpC:
    '{count, plural, one {# Stempel} other {# Stempel}}. 0 lassen, wenn nur Pauschal pro Einkauf.',
  stampsFlatLabel: 'Pauschal-Stempel pro Einkauf (addiert sich zum Bon, wenn beides genutzt)',
  recapCashTitle: 'Überblick · was die Kasse anwendet',
  recapCashSubtitle:
    'Einmal Aufrunden auf Brutto × Gesamtsatz (Basis ± Bonus pro €).',
  recapRewardLine:
    '{reward} ab {threshold} {threshold, plural, one {Punkt} other {Punkte}} → Schwelle-Gutschein = {text}',
  recapRewardBold: 'Belohnung:',
  recapOffBonusTitle: 'Außerhalb Bonuszeitraum',
  recapOffBonusRest:
    '(Daten nicht abgedeckt oder Bonus aus): {rate} Pt./€ — z. B. 1,20 € → {exA} Pkt. · 50,01 € → {exB} Pkt.',
  recapBonusPeriod:
    'Bonuszeitraum {start} bis {end} (Europa/Paris, inkl.): Gesamtsatz {rate} Pt./€ ({base} Basis + {bonus} Bonus) — z. B. 1,20 € → {exA} Pkt. · 50,01 € → {exB} Pkt.',
  recapBonusHintIncomplete:
    'Daten und „Bonuspunkte pro €“ unten eintragen, um den Satz während des Ereignisses hier zu sehen.',
  recapStampsTitle: 'Überblick · Stempel auf dem Bon',
  recapStampsCardLine:
    '{carte} an der Kasse: ab {threshold} {threshold, plural, one {Stempel} other {Stempel}} wird ein {bon} (Code + QR) erstellt; Rest-Stempel bleiben. Einlösung wie im Punkte-Modus (Gutschein validieren).',
  recapStampsCarteBold: 'Stempelkarte:',
  recapStampsBon: 'Kauf-Gutschein',
  recapStampsDisplayLine:
    '{affichage} „{text}“ (und %- / €-Vorteil, falls am Stempel-Gutschein gesetzt).',
  recapStampsAffichageBold: 'Anzeige:',
  recapOffBonusStamps: '{title}: {rate} — z. B. 24,90 € → {ex} auf dem Bon',
  recapOffBonusStampsTitle: 'Außerhalb Bonuszeitraum',
  recapStampPerEuro: '{n} {n, plural, one {Stempel} other {Stempel}}/€',
  recapFlatPlus: '+ {n} Pauschal / Einkauf',
  recapBonusStampsLine:
    'Bonuszeitraum {start} bis {end}: Gesamtsatz {rate} — z. B. 24,90 € → {ex}{flat}',
  recapFlatShort: '+ {n} Pauschal',
  recapStampsBonusHint:
    'Daten + Bonus-Stempel pro € angeben, um den kombinierten Satz zu sehen.',
  recapFlatOnlyLine:
    '{forfait}: +{n} {n, plural, one {Stempel} other {Stempel}} (ohne Bonbetrag). Optionaler Bonus: siehe unten.',
  recapFlatOnlyBold: 'Pauschal pro Einkauf',
  recapDefineRateOrFlat: 'Satz pro € oder Pauschal pro Einkauf oben im Formular setzen.',
  bonusDetailsTitle: 'Bonuszeitraum (optional · Zeitzone Europa/Paris)',
  bonusDetailsLead:
    'Bonus addiert einen {strong} zum Programm (z. B. Basis 1 Pt./€ + Bonus 1 Pt./€ = {rate2}, einmal Aufrunden: 50,01 € → 101 Pkt.).',
  bonusDetailsStrong: 'Satz pro € inkl. MwSt.',
  legacyFlatWarning:
    'Alte Einstellung: Pauschal +{n} Pt./Einkauf. Mit neuem Feld „pro €“ speichern — Pauschal wird nicht mehr genutzt.',
  periodsTypicalTitle: 'Typische Zeiträume ·',
  periodsTypicalHint: 'Klick = anwenden · Doppelklick = Daten anpassen',
  presetDblClickTitle: 'Doppelklick, um Daten vor dem Anwenden zu ändern',
  userPresetDblClickTitle: 'Doppelklick zum Umbenennen oder Ändern der Daten',
  addCustomEventButton: '+ Eigenes Ereignis',
  editorAdjustBuiltin: '„{label}“ anpassen',
  editorCustomEvent: 'Eigenes Ereignis',
  buttonNameLabel: 'Name auf dem Button',
  dateStartLabel: 'Beginn',
  dateEndLabel: 'Ende',
  applyBonus: 'Auf Bonus anwenden',
  close: 'Schließen',
  deleteEvent: 'Ereignis entfernen',
  enableBonusCheckbox: 'Bonus für die unten stehenden Daten aktivieren',
  bonusStartInclusive: 'Beginn (inkl.)',
  bonusEndInclusive: 'Ende (inkl.)',
  bonusPointsPerEuroLabel: 'Bonuspunkte pro € inkl. MwSt. (addieren sich zur Basis in der Periode)',
  bonusPointsPlaceholder: 'z. B. 1, um 1 Pt./€ Basis zu verdoppeln',
  bonusStampsPerEuroLabel: 'Bonusstempel pro € inkl. MwSt. (addieren sich zum Stempelsatz)',
  bonusStampsPlaceholder: 'z. B. 0,1',
  todayParisPrefix: 'Heute (Paris)',
  bonusActive: 'aktiv',
  seeGreenRecapExamples: 'pro Bon (Beispiele in der grünen Zusammenfassung).',
  todayBaseOnly: '{rate} (Basissatz).',
  todayOutsideWindow: 'Heute außerhalb des Bonusfensters (Paris) — siehe unten.',
  todaySeeGreenRecap: 'Für Bonusdaten siehe die grüne Zusammenfassung.',
  todayWindowLine:
    'Fenster {start} → {end} (inkl., Paris): heute wendet die Kasse nur {rate} an (ohne +{bonus} Bonus).',
  definePointsRate: 'Punkte/€-Satz oben eintragen.',
  stampsTodayOutside: ' — heute: außerhalb Bonusfenster (Paris).',
  stampsTodaySeeGreen: ' — Details in der grünen Zusammenfassung.',
  stampsWindowLine: 'Im Fenster {start} → {end}: {rate} (siehe grüne Zusammenfassung).',
  flatPreview:
    '{flat}: +{n} {n, plural, one {Stempel} other {Stempel}} / Einkauf (ohne Bonbetrag).',
  flatPreviewBold: 'Pauschal-Vorschau',
  saveSettings: 'Einstellungen speichern',
  preset_noel: 'Weihnachten',
  preset_nouvel_an: 'Neujahr',
  preset_st_valentin: 'Valentinstag',
  preset_ete: 'Sommer',
  ptsAbbr: 'Pkt.',
};

bananoLoyaltySettings.es = { ...bananoLoyaltySettings.en };
bananoLoyaltySettings.it = { ...bananoLoyaltySettings.en };
bananoLoyaltySettings.pt = { ...bananoLoyaltySettings.en };
bananoLoyaltySettings.ja = { ...bananoLoyaltySettings.en };
bananoLoyaltySettings.zh = { ...bananoLoyaltySettings.en };

// Spanish (replace English fallback)
Object.assign(bananoLoyaltySettings.es, {
  toastPresetApplied:
    'Periodo «{label}»: {start} → {end} — doble clic para ajustar las fechas.',
  toastUserPresetApplied: 'Periodo «{label}» aplicado.',
  toastCustomCreated:
    'Evento personal creado — modifique el nombre y las fechas, luego «Aplicar».',
  toastEndAfterStart: 'La fecha de fin debe ser posterior o igual al inicio.',
  toastBonusDatesSaved: 'Fechas de bonus guardadas en el formulario.',
  toastEventDeleted: 'Evento eliminado.',
  defaultEventLabel: 'Evento',
  defaultMyEvent: 'Mi evento',
  errThresholdPoints: 'Programa de puntos: umbral mínimo 1.',
  errThresholdStamps: 'Programa de sellos: umbral mínimo 1.',
  errPointsPerEuro: 'Indique cuántos puntos por € IVA incl. (ej. 1).',
  errStampsProgram:
    'Programa de sellos: indique sellos por € IVA incl. o un importe fijo por compra (> 0).',
  errStampsFlat: 'Sellos fijos por compra: 0 — 10 000.',
  errRewardPtsLen: 'Etiqueta de recompensa (puntos): entre 1 y 2000 caracteres.',
  errRewardStLen: 'Etiqueta de recompensa (sellos): entre 1 y 2000 caracteres.',
  errBonusPointsNeedEnable:
    'Marque «Activar bonus» y guarde con fechas; si no, los «puntos bonus por €» no se aplican en caja.',
  errBonusStampsNeedEnable:
    'Marque «Activar bonus» con fechas; si no, los «sellos bonus por €» no se aplican.',
  errBonusNeedDates: 'Bonus: indique fecha de inicio y fin.',
  errBonusEndBeforeStart: 'El fin del periodo debe ser posterior o igual al inicio.',
  errBonusPointsPerEuro:
    'Modo puntos: indique puntos bonus por € IVA incl. (> 0) — se suman a la base (ej. 1 + 1 = 2 pt/€).',
  errBonusStampsPerEuro:
    'Modo sellos: indique sellos bonus por € IVA incl. (> 0) en el periodo.',
  errVoucherPercent: '{context}: porcentaje del vale entre 0 y 100 (ej. 5 para 5 %).',
  errVoucherEuro: '{context}: importe del vale no válido (ej. 5 o 5,50).',
  errVoucherValidity: 'Validez de los vales: 1 a 3650 días, o vacío.',
  errGeneric: 'Error',
  toastSavedSuccess: 'Programa guardado — el terminal se actualiza en directo.',
  voucherCtxPoints: 'Vale programa puntos',
  voucherCtxStamps: 'Vale programa sellos',
  voucherTitle:
    'Vale de compra en el umbral ({unit} · uso único, archivado, QR en caja)',
  unitPointsLower: 'puntos',
  unitStampsLower: 'sellos',
  voucherIntro:
    'En cada paso por caja, cuando el total de {unit} supera el objetivo, se crea un vale automáticamente y el cliente conserva el resto de {unit}. El beneficio solo se valida con el código o QR del vale.',
  voucherNatureLabel: 'Tipo de ventaja mostrada en el vale',
  optLabelOnly: 'Solo etiqueta (campo «etiqueta» arriba)',
  optPercentLabel: 'Porcentaje + etiqueta',
  optFixedEuro: 'Importe fijo (€) + etiqueta',
  pctOnVoucherLabel: 'Porcentaje impreso en el vale (ej. 5 → 5 %)',
  euroAmountLabel: 'Importe en euros (ej. 5 o 5,50)',
  validityDaysLabel: 'Validez (días tras la emisión; vacío = sin límite)',
  validityPlaceholder: 'ej. 90',
  whatsappCheckbox:
    'Enviar automáticamente el código del vale por WhatsApp al crearlo (teléfono cliente obligatorio).',
  settingsCardTitle: 'Ajustes de fidelidad (personal: mismo programa en directo)',
  modeActiveLabel: 'Modo activo',
  modePointsHelp:
    'La caja acredita puntos según el ticket (€ × tipo, redondeo superior) + bonus opcional.',
  modeStampsHelp:
    'La caja acredita sellos: por ticket (€ × tipo), tarifa fija por compra, o ambos.',
  programPointsTitle: 'Programa de puntos',
  programStampsTitle: 'Programa de sellos',
  goalPointsLabel: 'Objetivo: ¿cuántos puntos para desbloquear la recompensa?',
  goalStampsLabel: 'Objetivo: ¿cuántos sellos para la recompensa?',
  rewardLabelPoints: 'Etiqueta en el vale y en pantalla de caja',
  rewardLabelStamps: 'Etiqueta en el vale y caja (ej. 1 menú gratis, -15 %…)',
  rewardPlaceholderPoints: '-10 %, menú gratis, 10 € en la cuenta…',
  rewardPlaceholderStamps: 'ej. 10 compras = 1 menú gratis',
  creditPointsLabel:
    'Crédito: 1 € IVA incl. = ¿cuántos puntos? (obligatorio · redondeo superior en el ticket)',
  creditPlaceholder: 'ej. 1',
  stampsPerEuroLabel:
    'Sellos por € IVA incl. (0 = ignorar importe: solo tarifa fija abajo)',
  stampsPerEuroPlaceholder: 'ej. 0,1 para ~1 sello / 10 €',
  stampsPerEuroHelpC:
    '{count, plural, one {# sello} other {# sellos}}. Deje 0 si solo quiere tarifa fija por compra.',
  stampsFlatLabel: 'Sellos fijos por compra (se suman al ticket si ambos se usan)',
  recapCashTitle: 'Resumen · lo que aplica la caja',
  recapCashSubtitle:
    'Un solo redondeo superior sobre el total IVA incl. × tipo total (base ± bonus por €).',
  recapRewardLine:
    '{reward} desde {threshold} {threshold, plural, one {punto} other {puntos}} → vale en umbral = {text}',
  recapRewardBold: 'Recompensa:',
  recapOffBonusTitle: 'Fuera del periodo bonus',
  recapOffBonusRest:
    '(fechas no cubiertas o bonus desactivado): {rate} pt/€ — ej. 1,20 € → {exA} pts · 50,01 € → {exB} pts.',
  recapBonusPeriod:
    'Periodo bonus del {start} al {end} (Europa/París, inclusive): tipo total {rate} pt/€ ({base} base + {bonus} bonus) — ej. 1,20 € → {exA} pts · 50,01 € → {exB} pts.',
  recapBonusHintIncomplete:
    'Indique fechas y «puntos bonus por €» abajo para ver el tipo durante el evento.',
  recapStampsTitle: 'Resumen · sellos en el ticket',
  recapStampsCardLine:
    '{carte} en caja, al llegar a {threshold} {threshold, plural, one {sello} other {sellos}}, se crea un {bon} (código + QR); el cliente conserva el resto en sellos. Canje como en puntos (validar vale).',
  recapStampsCarteBold: 'Tarjeta de sellos:',
  recapStampsBon: 'vale de compra',
  recapStampsDisplayLine:
    '{affichage} «{text}» (y % / € si está configurado en el vale sellos).',
  recapStampsAffichageBold: 'Visualización:',
  recapOffBonusStamps: '{title}: {rate} — ej. 24,90 € → {ex} en el ticket',
  recapStampPerEuro: '{n} {n, plural, one {sello} other {sellos}}/€',
  recapFlatPlus: '+ {n} fijo / compra',
  recapBonusStampsLine:
    'Periodo bonus {start} a {end}: tipo total {rate} — ej. 24,90 € → {ex}{flat}',
  recapFlatShort: '+ {n} fijo',
  recapStampsBonusHint:
    'Indique fechas + sellos bonus / € para ver el tipo combinado.',
  recapFlatOnlyLine:
    '{forfait}: +{n} {n, plural, one {sello} other {sellos}} (sin importe de ticket). Bonus: ver ajustes.',
  recapFlatOnlyBold: 'Tarifa fija por compra',
  recapDefineRateOrFlat: 'Defina un tipo por € o tarifa fija por compra arriba.',
  bonusDetailsTitle: 'Periodo bonus (opcional · zona Europa/París)',
  bonusDetailsLead:
    'El bonus añade un {strong} al programa (ej. base 1 pt/€ + bonus 1 pt/€ = {rate2}, un redondeo: 50,01 € → 101 pts).',
  legacyFlatWarning:
    'Ajuste antiguo: fijo +{n} pt/compra. Guarde con el nuevo campo «por €» — el fijo ya no se usa.',
  periodsTypicalTitle: 'Periodos típicos ·',
  periodsTypicalHint: 'clic = aplicar · doble clic = ajustar fechas',
  addCustomEventButton: '+ Evento personal',
  editorAdjustBuiltin: 'Ajustar «{label}»',
  editorCustomEvent: 'Evento personalizado',
  buttonNameLabel: 'Nombre en el botón',
  dateStartLabel: 'Inicio',
  dateEndLabel: 'Fin',
  applyBonus: 'Aplicar al bonus',
  close: 'Cerrar',
  deleteEvent: 'Eliminar evento',
  enableBonusCheckbox: 'Activar bonus en las fechas siguientes',
  bonusStartInclusive: 'Inicio (inclusive)',
  bonusEndInclusive: 'Fin (inclusive)',
  bonusPointsPerEuroLabel: 'Puntos bonus por € IVA incl. (se suman a la base en el periodo)',
  bonusPointsPlaceholder: 'ej. 1 para duplicar una base 1 pt/€',
  bonusStampsPerEuroLabel: 'Sellos bonus por € IVA incl. (se suman al tipo sellos)',
  bonusStampsPlaceholder: 'ej. 0,1',
  todayParisPrefix: 'Hoy (París)',
  bonusActive: 'activo',
  seeGreenRecapExamples: 'en cada ticket (ejemplos en el resumen verde).',
  todayBaseOnly: '{rate} (tipo base).',
  todayOutsideWindow: 'Hoy fuera de la ventana bonus (París) — ver abajo.',
  todaySeeGreenRecap: 'Para fechas bonus, ver el resumen verde.',
  todayWindowLine:
    'Ventana {start} → {end} (inclusive, París): hoy la caja aplica solo {rate} (sin el +{bonus} bonus).',
  definePointsRate: 'Defina el tipo puntos/€ arriba.',
  stampsTodayOutside: ' — hoy: fuera de ventana bonus (París).',
  stampsTodaySeeGreen: ' — detalle en el resumen verde.',
  stampsWindowLine: 'En ventana {start} → {end}: {rate} (ver resumen verde).',
  flatPreview:
    '{flat}: +{n} {n, plural, one {sello} other {sellos}} / compra (sin importe de ticket).',
  flatPreviewBold: 'Vista previa fija',
  saveSettings: 'Guardar ajustes',
  preset_noel: 'Navidad',
  preset_nouvel_an: 'Año nuevo',
  preset_st_valentin: 'San Valentín',
  preset_ete: 'Verano',
  ptsAbbr: 'pts',
});

bananoLoyaltySettings.it = {
  ...bananoLoyaltySettings.en,
  toastPresetApplied:
    'Periodo «{label}»: {start} → {end} — doppio clic per regolare le date.',
  toastUserPresetApplied: 'Periodo «{label}» applicato.',
  settingsCardTitle: 'Impostazioni fedeltà (staff: stesso programma live)',
  modeActiveLabel: 'Modalità attiva',
  modePoints: 'Punti',
  modeStamps: 'Bollini',
  programPointsTitle: 'Programma punti',
  programStampsTitle: 'Programma bollini',
  goalPointsLabel: 'Obiettivo: quanti punti per sbloccare la ricompensa?',
  goalStampsLabel: 'Obiettivo: quanti bollini per la ricompensa?',
  saveSettings: 'Salva impostazioni',
  voucherTitle:
    'Buono acquisto alla soglia ({unit} · uso unico, archiviato, QR in cassa)',
  voucherIntro:
    'A ogni passaggio in cassa, quando il totale {unit} supera l’obiettivo, viene creato un buono e il cliente mantiene il resto di {unit}. Il vantaggio si valida solo con codice o QR del buono.',
  voucherNatureLabel: 'Natura del vantaggio sul buono',
  optLabelOnly: 'Solo etichetta (campo sopra)',
  optPercentLabel: 'Percentuale + etichetta',
  optFixedEuro: 'Importo fisso (€) + etichetta',
  recapCashTitle: 'Riepilogo · cosa applica la cassa',
  bonusDetailsTitle: 'Periodo bonus (opzionale · fuso Europa/Parigi)',
  preset_noel: 'Natale',
  preset_nouvel_an: 'Capodanno',
  preset_st_valentin: 'San Valentino',
  preset_ete: 'Estate',
};

bananoLoyaltySettings.pt = {
  ...bananoLoyaltySettings.es,
  settingsCardTitle: 'Definições de fidelidade (equipa: mesmo programa em direto)',
  modePoints: 'Pontos',
  modeStamps: 'Carimbos',
  programPointsTitle: 'Programa de pontos',
  programStampsTitle: 'Programa de carimbos',
  saveSettings: 'Guardar definições',
  toastSavedSuccess: 'Programa guardado — o terminal atualiza em direto.',
  bonusDetailsTitle: 'Período de bónus (opcional · fuso Europa/Paris)',
  preset_nouvel_an: 'Ano Novo',
  preset_st_valentin: 'Dia dos Namorados',
};

bananoLoyaltySettings.ja = {
  ...bananoLoyaltySettings.en,
  settingsCardTitle: 'ロイヤルティ設定（スタッフ：同じライブプログラム）',
  modeActiveLabel: '有効モード',
  modePoints: 'ポイント',
  modeStamps: 'スタンプ',
  programPointsTitle: 'ポイントプログラム',
  programStampsTitle: 'スタンププログラム',
  saveSettings: '設定を保存',
  toastSavedSuccess: '保存しました — 端末がリアルタイムで更新されます。',
  voucherTitle: 'しきい値の購入バウチャー（{unit} · 一回限り、アーカイブ、レジでQR）',
  voucherNatureLabel: 'バウンチャーに表示する特典の種類',
  recapCashTitle: '概要 · レジで適用される内容',
  bonusDetailsTitle: 'ボーナス期間（任意 · タイムゾーン 欧州/パリ）',
  preset_noel: 'クリスマス',
  preset_nouvel_an: '新年',
  preset_st_valentin: 'バレンタイン',
  preset_ete: '夏',
  todayParisPrefix: '今日（パリ）',
};

bananoLoyaltySettings.zh = {
  ...bananoLoyaltySettings.en,
  settingsCardTitle: '忠诚度设置（员工：同一实时方案）',
  modeActiveLabel: '当前模式',
  modePoints: '积分',
  modeStamps: '集点',
  programPointsTitle: '积分计划',
  programStampsTitle: '集点计划',
  saveSettings: '保存设置',
  toastSavedSuccess: '已保存 — 终端将实时更新。',
  voucherTitle: '满额购券（{unit} · 单次使用、已归档、收银台扫码）',
  voucherNatureLabel: '券面显示的优惠类型',
  recapCashTitle: '摘要 · 收银台如何计算',
  bonusDetailsTitle: '奖励期间（可选 · 欧洲/巴黎时区）',
  preset_noel: '圣诞',
  preset_nouvel_an: '新年',
  preset_st_valentin: '情人节',
  preset_ete: '夏季',
  todayParisPrefix: '今日（巴黎）',
};

const bananoStaffSettings = {
  fr: {
    errPinDigits: 'Le nouveau code doit faire exactement 4 chiffres.',
    toastPinUpdated: 'Code équipier mis à jour — indiquez-le à la personne.',
    errGeneric: 'Erreur',
    savePin: 'Enregistrer',
    errLoadAllowance: 'Impossible de charger les réglages bons collaborateurs.',
    errStaffAllowanceAmount: 'Bon collaborateur : indiquez un montant mensuel supérieur à 0.',
    errStaffAllowanceValidity: 'Validité bon collaborateur : 1 à 3650 jours ou vide.',
    toastAllowanceSaved: 'Réglages bons collaborateurs enregistrés',
    toastMemberUpdated: 'Fiche mise à jour',
    errPickMember: 'Choisissez une fiche client (recherche ci-dessus).',
    errPin4: 'Le code doit comporter exactement 4 chiffres.',
    toastStaffAdded: 'Équipier ajouté — le code s’affiche à côté du nom.',
    toastReactivated: 'Équipier réactivé',
    toastAccessCut: 'Accès terminal coupé pour cet équipier',
    toastStaffDeleted: 'Équipier supprimé définitivement',
    sectionTitle: 'Équipe (terminal caisse)',
    sectionLead:
      'Chaque équipier est rattaché à une <strong>fiche client</strong> (compte CRM). Le <strong>code à 4 chiffres</strong> est son PIN au terminal ; communiquez-le à la personne. <strong>Deux équipiers ne peuvent pas partager le même code.</strong>',
    staffAllowanceTitle: 'Bons collaborateurs (avantage salarié · comptabilité séparée)',
    loadingAllowance: 'Chargement des réglages…',
    allowanceCheckbox:
      'Activer la génération mensuelle automatique (cron 1er du mois · montant ci-dessous).',
    allowanceDisabledHint:
      'Tant que cette case est décochée, aucun montant ni liste de bénéficiaires n’est proposé ici. Les équipiers restent gérés ci-dessous.',
    allowanceEnabledLead:
      'Un bon en euros est émis chaque mois pour chaque personne déjà enregistrée comme équipier (fiche client + code caisse). Solde dégressif en caisse. Pilotage et corrections : onglet <strong>Base clients → Archive bons employés</strong>.',
    allowanceMonthlyLabel: 'Montant chargé sur chaque bon / mois / personne (€)',
    allowanceValidityLabel: 'Validité après émission (jours ; vide = sans limite)',
    allowancePlaceholderEuro: 'ex. 50',
    allowancePlaceholderDays: 'ex. 45',
    saveAllowance: 'Enregistrer les réglages bons collaborateurs',
    recipientsTitle: 'Bénéficiaires du bon mensuel ({count})',
    recipientsHint:
      'Même liste que les équipiers ayant une fiche client : retirez ici l’éligibilité au bon sans supprimer le code caisse.',
    addStaffHintEmpty: 'Ajoutez un équipier ci-dessous (fiche client + PIN).',
    removeVoucher: 'Retirer le bon',
    newStaffTitle: 'Nouvel équipier',
    newStaffLead:
      'Recherchez une <strong>fiche client existante</strong> (nom ou téléphone), sélectionnez-la, puis attribuez le code à 4 chiffres.',
    clientRecordLabel: 'Fiche client',
    searchPlaceholder: 'Tapez au moins 2 caractères…',
    selectionPrefix: 'Sélection :',
    pickListAria: 'Choisir une fiche client',
    searching: 'Recherche…',
    noHits: 'Aucune fiche ne correspond.',
    pinLabel: 'Code à 4 chiffres (PIN caisse, unique)',
    pinPlaceholder: 'ex. 4829',
    addStaff: 'Ajouter l’équipier',
    loading: 'Chargement…',
    emptyStaff:
      'Aucun équipier pour l’instant. Le terminal plein écran reste ouvert sans trombinoscope tant que la liste est vide.',
    codeUndefined: '(code non défini — utilisez « Nouveau code »)',
    activeTerminal: 'Actif · terminal',
    disabled: 'Désactivé',
    newPinLabel: 'Nouveau code (4 ch.)',
    deactivate: 'Désactiver',
    reactivate: 'Réactiver',
    delete: 'Supprimer',
    deleteTitle: 'Supprimer l’équipier ?',
    deleteLead:
      'action définitive. L’historique lié restera sans nom d’équipier.',
    typeToConfirm: 'Tapez <span>{word}</span> pour confirmer',
    cancel: 'Annuler',
    deleteForever: 'Supprimer définitivement',
    close: 'Fermer',
    deleteConfirmWord: 'supprimer',
  },
  en: {
    errPinDigits: 'The new code must be exactly 4 digits.',
    toastPinUpdated: 'Staff code updated — share it with the person.',
    errGeneric: 'Error',
    savePin: 'Save',
    errLoadAllowance: 'Could not load staff voucher settings.',
    errStaffAllowanceAmount: 'Staff voucher: enter a monthly amount greater than 0.',
    errStaffAllowanceValidity: 'Staff voucher validity: 1 to 3650 days or empty.',
    toastAllowanceSaved: 'Staff voucher settings saved',
    toastMemberUpdated: 'Record updated',
    errPickMember: 'Choose a client record (search above).',
    errPin4: 'The code must be exactly 4 digits.',
    toastStaffAdded: 'Staff member added — the code appears next to the name.',
    toastReactivated: 'Staff member reactivated',
    toastAccessCut: 'Terminal access disabled for this staff member',
    toastStaffDeleted: 'Staff member permanently deleted',
    sectionTitle: 'Team (checkout terminal)',
    sectionLead:
      'Each staff member is linked to a <strong>client record</strong> (CRM account). The <strong>4-digit code</strong> is their terminal PIN — share it with them. <strong>Two staff members cannot share the same code.</strong>',
    staffAllowanceTitle: 'Staff vouchers (employee benefit · separate accounting)',
    loadingAllowance: 'Loading settings…',
    allowanceCheckbox:
      'Enable automatic monthly generation (1st of month cron · amount below).',
    allowanceDisabledHint:
      'While unchecked, no amount or beneficiary list is shown here. Staff are still managed below.',
    allowanceEnabledLead:
      'A euro voucher is issued each month for everyone already registered as staff (client record + checkout code). Balance decreases at checkout. Management and fixes: <strong>Client base → Staff voucher archive</strong> tab.',
    allowanceMonthlyLabel: 'Amount loaded on each voucher / month / person (€)',
    allowanceValidityLabel: 'Validity after issue (days; empty = no limit)',
    allowancePlaceholderEuro: 'e.g. 50',
    allowancePlaceholderDays: 'e.g. 45',
    saveAllowance: 'Save staff voucher settings',
    recipientsTitle: 'Monthly voucher recipients ({count})',
    recipientsHint:
      'Same list as staff with a client record: remove voucher eligibility here without removing the checkout code.',
    addStaffHintEmpty: 'Add a staff member below (client record + PIN).',
    removeVoucher: 'Remove voucher',
    newStaffTitle: 'New staff member',
    newStaffLead:
      'Search an <strong>existing client record</strong> (name or phone), select it, then assign the 4-digit code.',
    clientRecordLabel: 'Client record',
    searchPlaceholder: 'Type at least 2 characters…',
    selectionPrefix: 'Selected:',
    pickListAria: 'Choose a client record',
    searching: 'Searching…',
    noHits: 'No matching record.',
    pinLabel: '4-digit code (unique checkout PIN)',
    pinPlaceholder: 'e.g. 4829',
    addStaff: 'Add staff member',
    loading: 'Loading…',
    emptyStaff:
      'No staff yet. Full-screen terminal stays open without a roster while the list is empty.',
    codeUndefined: '(code not set — use “New code”)',
    activeTerminal: 'Active · terminal',
    disabled: 'Disabled',
    newPinLabel: 'New code (4 digits)',
    deactivate: 'Deactivate',
    reactivate: 'Reactivate',
    delete: 'Delete',
    deleteTitle: 'Remove staff member?',
    deleteLead: 'permanent action. Linked history will no longer show a staff name.',
    typeToConfirm: 'Type <span>{word}</span> to confirm',
    cancel: 'Cancel',
    deleteForever: 'Delete permanently',
    close: 'Close',
    deleteConfirmWord: 'delete',
  },
};

bananoStaffSettings.de = {
  ...bananoStaffSettings.en,
  sectionTitle: 'Team (Kassenterminal)',
  savePin: 'Speichern',
  toastPinUpdated: 'Mitarbeitercode aktualisiert — bitte weitergeben.',
  sectionLead:
    'Jeder Mitarbeiter ist mit einem <strong>Kundenprofil</strong> (CRM) verknüpft. Der <strong>4-stellige Code</strong> ist die PIN am Terminal. <strong>Zwei Mitarbeiter dürfen nicht denselben Code haben.</strong>',
  staffAllowanceTitle: 'Mitarbeitergutscheine (Personalvorteil · getrennte Buchhaltung)',
  loadingAllowance: 'Einstellungen werden geladen…',
  addStaff: 'Mitarbeiter hinzufügen',
  deleteConfirmWord: 'löschen',
  deleteTitle: 'Mitarbeiter entfernen?',
};

bananoStaffSettings.es = {
  ...bananoStaffSettings.en,
  sectionTitle: 'Equipo (terminal de caja)',
  toastPinUpdated: 'Código de personal actualizado — dígaselo a la persona.',
  staffAllowanceTitle: 'Vales de personal (beneficio de empleado · contabilidad separada)',
  deleteConfirmWord: 'eliminar',
  deleteTitle: '¿Eliminar miembro del personal?',
};

bananoStaffSettings.it = {
  ...bananoStaffSettings.en,
  sectionTitle: 'Team (terminale cassa)',
  deleteConfirmWord: 'elimina',
  deleteTitle: 'Rimuovere il membro dello staff?',
};

bananoStaffSettings.pt = {
  ...bananoStaffSettings.en,
  sectionTitle: 'Equipa (terminal de caixa)',
  deleteConfirmWord: 'eliminar',
};

bananoStaffSettings.ja = {
  ...bananoStaffSettings.en,
  sectionTitle: 'チーム（レジ端末）',
  deleteConfirmWord: '削除',
};

bananoStaffSettings.zh = {
  ...bananoStaffSettings.en,
  sectionTitle: '团队（收银终端）',
  deleteConfirmWord: '删除',
};

for (const loc of ['fr', 'en', 'de', 'es', 'it', 'ja', 'pt', 'zh']) {
  const p = path.join(MESSAGES, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.Dashboard) j.Dashboard = {};
  j.Dashboard.bananoLoyaltySettings = bananoLoyaltySettings[loc];
  j.Dashboard.bananoStaffSettings = bananoStaffSettings[loc];
  fs.writeFileSync(p, JSON.stringify(j));
  console.log('merged', loc);
}
