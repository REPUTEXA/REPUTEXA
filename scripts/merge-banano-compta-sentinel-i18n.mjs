/**
 * Dashboard.bananoComptaExpert, Dashboard.bananoSentinel
 * Run: node scripts/merge-banano-compta-sentinel-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function pack(fr, en) {
  return { fr, en };
}

const bananoComptaExpert = {
  ...pack(
    {
      lockedTitle: 'Pack Expert-Comptable',
      lockedBody:
        'Ce module (synthèse mensuelle fidélité + collaborateurs, exports PDF et CSV pour votre équipe comptable) est inclus dans le plan {plan}. Vous tracez chaque bon avec date, bénéficiaire et montant : fini les écarts « invisibles » entre caisse et avantages offerts.',
      ariaLocked: 'Expert-Comptable Zénith',
      ariaMain: 'Expert-Comptable',
      title: 'Expert-Comptable — pièces justificatives',
      intro:
        'Total des remises fidélité (bons utilisés) et des avantages collaborateurs réellement consommés en caisse. À transmettre au comptable avec vos journaux : même principe qu’un rapport d’opérations marketing ou d’avantages en nature tracés. Méthode pro recommandée : créer un mode de paiement ou une ligne de remise « REPUTEXA » sur votre logiciel de caisse pour un rapprochement sans friction.',
      monthLabel: 'Mois',
      pdfPro: 'PDF Pro',
      csvCompta: 'CSV comptable',
      loading: 'Chargement…',
      loyaltyTitle: 'Fidélité clients',
      loyaltySub:
        'Cumul bons à montant fixe (€). Hors pourcentage : {percentCount} bon(s) % · libellé seul : {labelOnlyCount}. Utilisations totales : {redemptions}.',
      staffTitle: 'Collaborateurs',
      staffSub: 'Somme des débits enregistrés en caisse sur la période. Mouvements : {debitEventCount}.',
      noData: 'Données indisponibles.',
      footnote:
        'Note : ce document sert de pièce justificative de synthèse pour les remises marketing fidélité et les avantages en nature collaborateurs enregistrés via REPUTEXA ; il complète vos justificatifs de caisse sans remplacer vos obligations légales ou déclaratives.',
      errGeneric: 'Erreur',
      errInvalidResponse: 'Réponse invalide',
    },
    {
      lockedTitle: 'Accountant pack',
      lockedBody:
        'This module (monthly loyalty + staff summary, PDF and CSV exports for your accounting team) is included in the {plan} plan. You track each voucher with date, beneficiary and amount: no more “invisible” gaps between the till and perks.',
      ariaLocked: 'Zenith accountant',
      ariaMain: 'Accountant',
      title: 'Accountant — supporting documents',
      intro:
        'Totals for loyalty discounts (vouchers redeemed) and staff perks actually consumed at the till. Share with your accountant with your ledgers—same idea as a marketing spend report or tracked benefits-in-kind. Pro tip: add a REPUTEXA tender or discount line in your POS for easy reconciliation.',
      monthLabel: 'Month',
      pdfPro: 'Pro PDF',
      csvCompta: 'Accounting CSV',
      loading: 'Loading…',
      loyaltyTitle: 'Customer loyalty',
      loyaltySub:
        'Fixed-amount vouchers (€). Excluding percentage: {percentCount} % voucher(s) · label-only: {labelOnlyCount}. Total redemptions: {redemptions}.',
      staffTitle: 'Staff',
      staffSub: 'Sum of debits recorded at the till in the period. Movements: {debitEventCount}.',
      noData: 'Data unavailable.',
      footnote:
        'Note: this is a summary supporting document for loyalty marketing discounts and staff benefits-in-kind recorded via REPUTEXA; it complements your till records and does not replace legal or filing obligations.',
      errGeneric: 'Error',
      errInvalidResponse: 'Invalid response',
    },
  ),
};

const bananoSentinel = {
  ...pack(
    {
      dash: '—',
      sessionRequired: 'Session requise.',
      title: 'Sentinel Live Feed',
      subtitle: 'Flux temps réel des scans et transacts Agent Ghost (Supabase Realtime).',
      live: 'Live',
      connecting: 'Connexion…',
      empty:
        'Aucun événement Ghost pour l’instant. Les scans depuis l’agent Windows apparaîtront ici.',
      verifiedByGhost: 'Vérifié par Ghost',
      traceTitle: 'Traçabilité Agent Ghost',
      sourceLabel: 'Source : {source}',
      memberPending: '…',
      action_scan_resolve: 'Scan Ghost',
      action_transact_earn: 'Passage fidélité',
      action_transact_redeem_points: 'Débit points',
      action_transact_staff_usage: 'Repas staff',
      action_voucher_redeem: 'Bon utilisé',
      action_enroll: 'Inscription',
      action_device_bind: 'Appareil lié',
      action_ticket_sniffer: 'Ticket (sniffer)',
      action_macro_play: 'Macro caisse',
      action_default: 'Événement',
      impact_earn_ticket: 'Ticket {amount} € · fidélité créditée via Ghost',
      impact_earn_no_ticket: 'Fidélité créditée via Ghost',
      impact_staff_both: '−{debit} € staff · solde restant {rem} €',
      impact_staff_debit: '−{debit} € crédit staff',
      impact_staff_plain: 'Débit crédit staff',
      impact_voucher_code: 'Bon {code}',
      impact_voucher_plain: 'Bon fidélité encaissé',
      scan_member_with_status: 'Carte membre {status}',
      scan_member: 'Carte membre',
      scan_voucher: 'Scan bon (VCHR)',
      scan_unknown: 'Scan non reconnu',
      scan_resolution: 'Résolution : {resolved}',
      scan_default: 'Scan',
      impact_ticket: 'Montant ticket {amount} €',
      scan_found_recognized: 'reconnu',
      scan_found_unknown: 'inconnu',
    },
    {
      dash: '—',
      sessionRequired: 'Sign-in required.',
      title: 'Sentinel Live Feed',
      subtitle: 'Real-time stream of Ghost Agent scans and transacts (Supabase Realtime).',
      live: 'Live',
      connecting: 'Connecting…',
      empty: 'No Ghost events yet. Scans from the Windows agent will appear here.',
      verifiedByGhost: 'Verified by Ghost',
      traceTitle: 'Ghost Agent traceability',
      sourceLabel: 'Source: {source}',
      memberPending: '…',
      action_scan_resolve: 'Ghost scan',
      action_transact_earn: 'Loyalty visit',
      action_transact_redeem_points: 'Points debit',
      action_transact_staff_usage: 'Staff meal',
      action_voucher_redeem: 'Voucher used',
      action_enroll: 'Enrollment',
      action_device_bind: 'Device linked',
      action_ticket_sniffer: 'Ticket (sniffer)',
      action_macro_play: 'POS macro',
      action_default: 'Event',
      impact_earn_ticket: 'Ticket {amount} € · loyalty credited via Ghost',
      impact_earn_no_ticket: 'Loyalty credited via Ghost',
      impact_staff_both: '−{debit} € staff · balance left {rem} €',
      impact_staff_debit: '−{debit} € staff credit',
      impact_staff_plain: 'Staff credit debit',
      impact_voucher_code: 'Voucher {code}',
      impact_voucher_plain: 'Loyalty voucher redeemed',
      scan_member_with_status: 'Member card {status}',
      scan_member: 'Member card',
      scan_voucher: 'Voucher scan (VCHR)',
      scan_unknown: 'Unrecognized scan',
      scan_resolution: 'Resolution: {resolved}',
      scan_default: 'Scan',
      impact_ticket: 'Ticket amount {amount} €',
      scan_found_recognized: 'recognized',
      scan_found_unknown: 'unknown',
    },
  ),
};

function mergeNs(name, dict) {
  for (const loc of ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh']) {
    const p = path.join(root, 'messages', `${loc}.json`);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.Dashboard = j.Dashboard || {};
    const payload = loc === 'fr' ? dict.fr : loc === 'en' ? dict.en : { ...dict.en };
    j.Dashboard[name] = payload;
    fs.writeFileSync(p, JSON.stringify(j));
  }
}

mergeNs('bananoComptaExpert', bananoComptaExpert);
mergeNs('bananoSentinel', bananoSentinel);
console.log('Merged bananoComptaExpert + bananoSentinel');
