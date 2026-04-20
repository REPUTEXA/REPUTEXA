/**
 * Dashboard.comptaBananoPdf — PDF expert-comptable Banano.
 * node scripts/merge-compta-banano-pdf-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES = path.join(__dirname, '..', 'messages');

const fr = {
  tagline: 'Document Expert-Comptable · Fidélité',
  partner_note:
    "Partenaire : identité établissement issue du profil REPUTEXA",
  title_prefix: 'Synthèse comptable —',
  period_utc:
    'Période UTC : du {from} au exclusif {to}.',
  section_loyalty_title: 'Remises fidélité (bons client)',
  loyalty_bullet_fixed:
    '· Montant cumulé (bons à avantage en euros fixe) :',
  loyalty_bullet_redemptions: "· Nombre d'utilisations (tous types) :",
  loyalty_bullet_percent:
    '· Dont bons en pourcentage (montant à retrouver sur ticket de caisse) :',
  loyalty_bullet_label_only:
    '· Dont bons « libellé seul » (pas de montant automatique) :',
  section_staff_title: 'Avantages collaborateurs (bons solde €)',
  staff_bullet_total:
    '· Total consommé en caisse (somme des débits enregistrés) :',
  staff_bullet_moves: '· Nombre de mouvements de débit :',
  detail_loyalty: 'Détail fidélité',
  detail_staff: 'Détail collaborateurs',
  truncated_lines:
    '… {n} ligne(s) supplémentaires : export CSV depuis le tableau de bord.',
  empty_loyalty: 'Aucun bon fidélité utilisé sur cette période.',
  empty_staff: 'Aucun débit bon collaborateur sur cette période.',
  note_title: 'Note explicative',
  footer_page:
    'REPUTEXA · Synthèse comptable fidélité & équipe — usage interne établissement',
  establishment_fallback: 'Établissement',
  disclaimer:
    "Ce document sert de pièce justificative de synthèse pour les remises marketing fidélité et les avantages en nature collaborateurs enregistrés via la plateforme REPUTEXA. Il facilite le rapprochement avec la comptabilité de caisse (ex. mode de paiement ou remise dédiée « REPUTEXA »). Il complète, sans se substituer aux obligations légales, déclarations sociales ou fiscales propres à votre entreprise.",
};

const en = {
  tagline: 'Accountant summary document · Loyalty',
  partner_note: 'Partner: establishment identity from the REPUTEXA profile',
  title_prefix: 'Accounting summary —',
  period_utc: 'UTC period: from {from} to (exclusive) {to}.',
  section_loyalty_title: 'Loyalty redemptions (customer vouchers)',
  loyalty_bullet_fixed: '· Total fixed-amount euro benefits:',
  loyalty_bullet_redemptions: '· Total redemptions (all types):',
  loyalty_bullet_percent:
    '· Of which percentage vouchers (amount on till receipt):',
  loyalty_bullet_label_only: '· Of which “label-only” vouchers (no auto amount):',
  section_staff_title: 'Staff benefits (€ balance vouchers)',
  staff_bullet_total: '· Total debited at till (sum of recorded debits):',
  staff_bullet_moves: '· Number of debit movements:',
  detail_loyalty: 'Loyalty detail',
  detail_staff: 'Staff detail',
  truncated_lines: '… {n} more row(s): export CSV from the dashboard.',
  empty_loyalty: 'No loyalty vouchers used in this period.',
  empty_staff: 'No staff voucher debits in this period.',
  note_title: 'Explanatory note',
  footer_page:
    'REPUTEXA · Loyalty & team accounting summary — internal establishment use',
  establishment_fallback: 'Establishment',
  disclaimer:
    'This document is a supporting summary for loyalty marketing discounts and staff benefits in kind recorded via REPUTEXA. It helps reconcile with till accounting (e.g. payment method or a dedicated “REPUTEXA” discount). It supplements — and does not replace — your legal, payroll, or tax obligations.',
};

for (const loc of ['fr', 'en', 'de', 'es', 'it', 'pt', 'ja', 'zh']) {
  const p = path.join(MESSAGES, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Dashboard = j.Dashboard || {};
  j.Dashboard.comptaBananoPdf = loc === 'fr' ? fr : { ...en };
  fs.writeFileSync(p, JSON.stringify(j));
  console.log('merged comptaBananoPdf', loc);
}
