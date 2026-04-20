/**
 * Fusionne Dashboard.bananoCrmImport dans messages/{locale}.json
 * node scripts/merge-banano-crm-import-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES = path.join(__dirname, '..', 'messages');

const bananoCrmImport = {
  fr: {
    toast_empty_file: 'Fichier vide ou illisible.',
    err_analyse_impossible: 'Analyse impossible',
    err_invalid_response: 'Réponse invalide',
    err_merge_impossible: 'Fusion impossible',
    err_generic: 'Erreur',
    toast_truncated: 'Fichier limité aux {max} premières lignes.',
    toast_success_one: 'Succès ! 1 client importé et mis à jour.',
    toast_success_many: 'Succès ! {count} clients importés et mis à jour.',
    cta_import: 'Importer mes clients',
    aria_close: 'Fermer',
    title: 'Importation magique',
    subtitle:
      'Excel, CSV ou export de votre ancienne caisse — analyse des colonnes puis fusion dans REPUTEXA.',
    drop_title: 'Glissez-déposez votre fichier ici',
    drop_hint: '.xlsx, .xls, .csv — premier onglet ou feuille utilisée',
    choose_file: 'Choisir un fichier',
    pick_help:
      'Export CSV/Excel depuis votre caisse ou fidélité : en Europe (RGPD), vous pouvez en général récupérer votre fichier clients en un clic. Les numéros passent en +33 (espaces, tirets, parenthèses retirés ; 06/07 et mobile sans 0 gérés). Sans export, copier-coller depuis la page web vers Excel fonctionne souvent. Lignes sans numéro valide ignorées. Plusieurs lignes pour le même numéro : le solde importé ({balanceWord}) est additionné. En base déjà : le fichier s’ajoute au solde actuel. Mode actuel du programme : {programMode}.',
    word_points: 'points',
    word_stamps: 'tampons',
    mode_points_only: 'points uniquement',
    mode_stamps_only: 'tampons uniquement',
    analysis_hybrid: '(heuristique + IA)',
    analysis_ai: '(IA)',
    analysis_auto: '(auto)',
    analysis_prefix: 'Analyse ',
    stats_line:
      '{rows} ligne(s) · {unique} client(s) uniques{dupPart}',
    stats_dup_suffix: ' · {dup} doublon(s) fusionné(s) dans le fichier',
    mapping_title: 'Branchement des colonnes',
    mapping_help:
      'Comparez les 3 premières lignes : indiquez quelle colonne contient le numéro de téléphone (les libellés diffèrent : Phone_Number, Téléphone, etc.). Ajustez les autres champs si la détection auto ne convient pas.',
    col_hash: '#',
    col_fallback: 'Col. {n}',
    column_label: 'Colonne {n}',
    column_none: '— Aucune —',
    label_phone: 'Colonne téléphone (obligatoire)',
    label_firstName: 'Prénom',
    label_lastName: 'Nom',
    label_fullName: 'Nom affiché (une seule colonne)',
    label_points_balance: 'Solde points',
    label_stamps_balance: 'Solde tampons',
    preview_th_phone: 'Téléphone',
    preview_th_name: 'Nom (aperçu)',
    preview_th_points: 'Points',
    preview_th_stamps: 'Tampons',
    preview_footer:
      'Aperçu des 5 premières lignes (nom = libellé enregistré : majuscules, sans accents, apostrophes et ponctuation → espaces). Colonnes détectées : {detected}',
    preview_detected_phone: 'tél. «{name}»',
    preview_detected_points: ' · points «{name}»',
    preview_detected_stamps: ' · tampons «{name}»',
    done_title_one: 'Succès ! 1 client importé et mis à jour.',
    done_title_many: 'Succès ! {count} clients importés et mis à jour.',
    done_li_detail:
      'Détail : {inserted} fiche(s) créée(s), {updated} mise(s) à jour (soldes existants + fichier)',
    done_li_processed:
      '{n, plural, one {# ligne traitée avec numéro valide} other {# lignes traitées avec numéro valide}}',
    done_li_skipped:
      '{n, plural, one {# ligne ignorée (téléphone invalide)} other {# lignes ignorées (téléphone invalide)}}',
    done_li_errors:
      '{n, plural, one {# erreur technique — vérifiez la console serveur} other {# erreurs techniques — vérifiez la console serveur}}',
    btn_close: 'Fermer',
    btn_cancel: 'Annuler',
    btn_merge: 'Fusionner dans REPUTEXA',
    btn_another_file: 'Autre fichier',
    em_dash: '—',
  },
};

bananoCrmImport.en = {
  toast_empty_file: 'File is empty or unreadable.',
  err_analyse_impossible: 'Analysis failed',
  err_invalid_response: 'Invalid response',
  err_merge_impossible: 'Merge failed',
  err_generic: 'Error',
  toast_truncated: 'File limited to the first {max} rows.',
  toast_success_one: 'Success! 1 customer imported and updated.',
  toast_success_many: 'Success! {count} customers imported and updated.',
  cta_import: 'Import my customers',
  aria_close: 'Close',
  title: 'Magic import',
  subtitle:
    'Excel, CSV or export from your old POS — column analysis then merge into REPUTEXA.',
  drop_title: 'Drag and drop your file here',
  drop_hint: '.xlsx, .xls, .csv — first sheet or tab used',
  choose_file: 'Choose file',
  pick_help:
    'Export CSV/Excel from your till or loyalty program: in Europe (GDPR) you can usually download your customer file in one click. Numbers are normalized to +33 (spaces, dashes, brackets removed; 06/07 and mobile without leading 0 handled). Without an export, copy-paste from the web to Excel often works. Rows without a valid number are skipped. Several rows for the same number: imported balance ({balanceWord}) is added. If already in the database: the file adds to the current balance. Current program mode: {programMode}.',
  word_points: 'points',
  word_stamps: 'stamps',
  mode_points_only: 'points only',
  mode_stamps_only: 'stamps only',
  analysis_hybrid: '(heuristic + AI)',
  analysis_ai: '(AI)',
  analysis_auto: '(auto)',
  analysis_prefix: 'Analysis ',
  stats_line: '{rows} rows · {unique} unique customers{dupPart}',
  stats_dup_suffix: ' · {dup} duplicate row(s) merged in file',
  mapping_title: 'Column mapping',
  mapping_help:
    'Compare the first 3 rows: pick which column has the phone number (labels vary: Phone_Number, Téléphone, etc.). Adjust other fields if auto-detection is wrong.',
  col_hash: '#',
  col_fallback: 'Col. {n}',
  column_label: 'Column {n}',
  column_none: '— None —',
  label_phone: 'Phone column (required)',
  label_firstName: 'First name',
  label_lastName: 'Last name',
  label_fullName: 'Display name (single column)',
  label_points_balance: 'Points balance',
  label_stamps_balance: 'Stamps balance',
  preview_th_phone: 'Phone',
  preview_th_name: 'Name (preview)',
  preview_th_points: 'Points',
  preview_th_stamps: 'Stamps',
  preview_footer:
    'Preview of the first 5 rows (name = stored label: uppercasing, no accents, punctuation → spaces). Detected columns: {detected}',
  preview_detected_phone: 'phone «{name}»',
  preview_detected_points: ' · points «{name}»',
  preview_detected_stamps: ' · stamps «{name}»',
  done_title_one: 'Success! 1 customer imported and updated.',
  done_title_many: 'Success! {count} customers imported and updated.',
  done_li_detail:
    'Detail: {inserted} profile(s) created, {updated} updated (existing balances + file)',
  done_li_processed:
    '{n, plural, one {# row processed with valid number} other {# rows processed with valid number}}',
  done_li_skipped:
    '{n, plural, one {# row skipped (invalid phone)} other {# rows skipped (invalid phone)}}',
  done_li_errors:
    '{n, plural, one {# technical error — check server logs} other {# technical errors — check server logs}}',
  btn_close: 'Close',
  btn_cancel: 'Cancel',
  btn_merge: 'Merge into REPUTEXA',
  btn_another_file: 'Another file',
  em_dash: '—',
};

bananoCrmImport.de = { ...bananoCrmImport.en };
bananoCrmImport.es = { ...bananoCrmImport.en };
bananoCrmImport.it = { ...bananoCrmImport.en };
bananoCrmImport.pt = { ...bananoCrmImport.en };
bananoCrmImport.ja = { ...bananoCrmImport.en };
bananoCrmImport.zh = { ...bananoCrmImport.en };

for (const loc of ['fr', 'en', 'de', 'es', 'it', 'ja', 'pt', 'zh']) {
  const p = path.join(MESSAGES, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.Dashboard) j.Dashboard = {};
  j.Dashboard.bananoCrmImport = bananoCrmImport[loc];
  fs.writeFileSync(p, JSON.stringify(j));
  console.log('merged bananoCrmImport', loc);
}
