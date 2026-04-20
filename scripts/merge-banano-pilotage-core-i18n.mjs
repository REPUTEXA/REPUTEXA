/**
 * Fusionne Dashboard.bananoPilotageCore (textes serveur pilotage + coach mensuel)
 * node scripts/merge-banano-pilotage-core-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES = path.join(__dirname, '..', 'messages');

const bananoPilotageCore = {
  fr: {
    default_member_label: 'Client',
    day_subline_revenue_goal:
      "CA aujourd'hui — objectif : {goal} ({pct} % atteint)",
    day_subline_revenue_no_goal:
      "CA aujourd'hui (montants saisis à la caisse). Définissez un objectif journalier dans votre profil pour activer la jauge.",
    day_insight_revenue_few:
      "Peu de tickets à montant ce jour. Continuez à enregistrer les achats fidélité pour visualiser votre pic d'activité.",
    day_insight_revenue_golden_hour:
      "Aujourd'hui, {share} % de vos passages sont entre {hourStart} h et {hourEnd} h — votre « Golden Hour » pour anticiper équipes et réassort.",
    day_headline_visits:
      '{n, plural, one {# passage} other {# passages}}',
    day_subline_visit_goal:
      "Passages fidélité aujourd'hui — objectif : {goal} ({pct} %)",
    day_subline_visit_no_goal:
      'Volume enregistré à la caisse (points / tampons). Saisissez le montant TTC du ticket pour activer le pilotage CA.',
    day_insight_visit_few:
      "Pas assez de passages pour isoler une heure de pic fiable. Encouragez l'enregistrement à chaque achat.",
    day_insight_visit_peak:
      "Aujourd'hui, {share} % des passages sont entre {hourStart} h et {hourEnd} h — charge maximale sur ce créneau.",
    week_headline_strong: 'Semaine en forte reprise',
    week_sub:
      'Passages fidélité : semaine en cours vs semaine précédente (même plage lundi–dimanche).',
    week_insight_low_data:
      'Pas assez de données sur la semaine pour comparer les jours un à un. Continuez à enregistrer les visites.',
    week_insight_calm_day:
      'Le {weekday} est votre jour le plus calme ({pctVsAvg} vs moyenne hebdo des passages). Une offre ciblée WhatsApp ce jour-là peut lisser la courbe.',
    week_insight_saturday_append:
      ' Analyse du samedi : environ {share} % de vos passages enregistrés sur la période analysée tombent un samedi — anticipez réassort et staffing week-end.',
    month_subline_avg_basket:
      '{count, plural, one {Panier moyen (tickets avec montant) — # ticket ce mois-ci.} other {Panier moyen (tickets avec montant) — # tickets ce mois-ci.}}',
    month_insight_loyalty_uplift:
      "Vos clients les plus habitués (3 visites ou plus au compteur) affichent un panier moyen d'environ {pct} vs les fiches plus récentes sur ce mois — continuez à pousser l'enrôlement.",
    month_insight_increase_variety:
      'Augmentez les montants saisis sur des fiches variées pour comparer fidèles occasionnels vs habitués.',
    month_headline_passages_count: '{n, plural, one {# passage} other {# passages}}',
    month_subline_volume_no_amount:
      'Volume fidélité du mois en cours (sans montants ticket : panier moyen non calculé).',
    month_insight_frequency_compare:
      'Les profils avec 3 visites ou plus reviennent {pct} en moyenne vs les fiches plus neuves ce mois-ci — la fidélité se lit déjà dans la fréquence.',
    month_insight_enter_amounts_hint:
      "Dès que vous saisissez les montants TTC à la caisse, le panier moyen et les écarts fidèles / nouveaux apparaîtront ici.",
    month_subline_sparse_data: 'Mois en cours : données encore trop peu nombreuses.',
    month_insight_sparse:
      'Enregistrez achats et montants pour débloquer la vue stratégie (panier moyen, écart fidèles).',
    card_champion_title: 'Le Champion',
    card_champion_title_caisse: 'Le Champion (caisse)',
    card_champion_body_product:
      '« {name} » domine : environ {pct} % de vos marges sur la période (données catalogue / caisse).',
    card_champion_body_note:
      'Le libellé d\'achat le plus repris ce mois-ci : « {text} » ({count, plural, one {# fois} other {# fois}}). Liez un catalogue pour passer au niveau produit / marge.',
    card_champion_body_empty:
      "Aucun motif d'achat récurrent détecté dans les notes caisse. Saisissez un court détail (ex. « Colis Barbecue ») ou connectez votre catalogue.",
    card_stock_title: "L'Alerte Stock",
    card_stock_body_ratio:
      '« {label} » : ventes environ {ratio}× vs prévision — vérifiez le stock pour les prochains jours.',
    card_stock_body_empty:
      'Branchez votre fichier articles, votre grossiste ou votre ERP pour recevoir des alertes de dérive volumes / prévision.',
    vip_month_range: 'Mois en cours : du {from} au {to}',
    card_vip_title: 'Le VIP du Mois',
    card_vip_body_spend_named:
      '{period}. {name} cumule {amount} sur les tickets saisis. Merci automatique possible dans Paramètres → Relances WhatsApp (client VIP du mois).',
    card_vip_body_spend_anon:
      '{period}. Un client cumule {amount} sur les tickets saisis (fiche à réconcilier). Merci automatique : Paramètres → Relances WhatsApp.',
    card_vip_body_visits_named:
      '{period}. {name} compte {count, plural, one {# passage} other {# passages}} — meilleur volume fidélité. Merci automatique : Paramètres → Relances WhatsApp.',
    card_vip_body_visits_anon:
      '{period}. Meilleur volume : {count, plural, one {# passage enregistré} other {# passages enregistrés}} (fiche à réconcilier).',
    card_vip_body_low_activity:
      "{period}. Pas encore assez d'activité pour désigner un VIP. Saisissez les montants sur les tickets pour classer par cumul CA.",
    card_risk_title: 'Le Risque',
    card_risk_body_at_risk:
      '{count, plural, one {# client fidèle (≥ {minVisits} visites) sans passage depuis {inactiveDays} jours — relance possible sans chercher les numéros.} other {# clients fidèles (≥ {minVisits} visites) sans passage depuis {inactiveDays} jours — relance possible sans chercher les numéros.}}',
    card_risk_body_safe:
      'Aucun fidèle qualifié (≥ {minVisits} visites) au-delà de {inactiveDays} jours sans passage — belle rétention sur cette fenêtre.',
    card_risk_cta_clients: 'Voir la base clients',
    monthly_coach_intro:
      'Vous êtes à {progressPercent} % de votre objectif mensuel ({revenue} sur {goal}), il reste {daysLeft, plural, one {# jour} other {# jours}}.',
    monthly_coach_shortfall:
      " À ce rythme, l'écart projeté en fin de mois est d'environ {shortfall}.",
    monthly_coach_on_track:
      " À ce rythme, vous pouvez viser l'objectif ou le dépasser.",
    monthly_war_gap:
      "Conseil : activez une offre « double points » ou un coup de pouce WhatsApp ce week-end pour combler l'écart et sécuriser votre objectif.",
    monthly_war_done:
      'Objectif atteint ou dépassé : capitalisez en fidélisant les nouveaux profils et en demandant un avis Google après passage.',
    monthly_war_default:
      'Conseil : mettez en avant la carte fidélité à la caisse chaque passage pour maintenir le momentum.',
    monthly_forecast_progress:
      'À ce rythme, projection fin de mois : environ {projected} — objectif {goal} ({vsGoalSigned} % vs objectif).',
    monthly_forecast_simple:
      'Projection fin de mois : {projected} (objectif {goal}).',
  },
};

bananoPilotageCore.en = {
  default_member_label: 'Customer',
  day_subline_revenue_goal: "Today's revenue — goal: {goal} ({pct}% reached)",
  day_subline_revenue_no_goal:
    "Today's revenue (amounts entered at checkout). Set a daily goal in your profile to enable the gauge.",
  day_insight_revenue_few:
    'Few tickets with amounts today. Keep recording loyalty purchases to see your activity peak.',
  day_insight_revenue_golden_hour:
    "Today, {share}% of your visits are between {hourStart}:00 and {hourEnd}:00 — your « Golden Hour » for staffing and replenishment.",
  day_headline_visits: '{n, plural, one {# visit} other {# visits}}',
  day_subline_visit_goal: "Today's loyalty visits — goal: {goal} ({pct}%)",
  day_subline_visit_no_goal:
    'Volume recorded at checkout (points / stamps). Enter the ticket incl. tax amount to enable revenue tracking.',
  day_insight_visit_few:
    'Not enough visits to isolate a reliable peak hour. Encourage recording on every purchase.',
  day_insight_visit_peak:
    "Today, {share}% of visits are between {hourStart}:00 and {hourEnd}:00 — peak load in that slot.",
  week_headline_strong: 'Strong week-on-week rebound',
  week_sub:
    'Loyalty visits: current week vs previous week (same Mon–Sun range).',
  week_insight_low_data:
    'Not enough weekly data to compare days one-to-one. Keep recording visits.',
  week_insight_calm_day:
    '{weekday} is your quietest day ({pctVsAvg} vs weekly average visits). A targeted WhatsApp offer that day can smooth demand.',
  week_insight_saturday_append:
    ' Saturday insight: about {share}% of recorded visits in the analysed period fall on a Saturday — plan replenishment and weekend staffing.',
  month_subline_avg_basket:
    '{count, plural, one {Average basket (tickets with amount) — # ticket this month.} other {Average basket (tickets with amount) — # tickets this month.}}',
  month_insight_loyalty_uplift:
    'Your regulars (3+ lifetime visits) show an average basket about {pct} vs newer profiles this month — keep enrolling.',
  month_insight_increase_variety:
    'Enter amounts on more varied profiles to compare occasional vs regular customers.',
  month_headline_passages_count: '{n, plural, one {# visit} other {# visits}}',
  month_subline_volume_no_amount:
    'Loyalty volume this month (no ticket amounts: average basket not computed).',
  month_insight_frequency_compare:
    'Profiles with 3+ visits return {pct} on average vs newer profiles this month — loyalty shows in frequency.',
  month_insight_enter_amounts_hint:
    'Once you enter incl. tax amounts at checkout, average basket and loyal vs new gaps appear here.',
  month_subline_sparse_data: 'Current month: not enough data yet.',
  month_insight_sparse:
    'Record purchases and amounts to unlock the strategy view (average basket, loyal gap).',
  card_champion_title: 'The Champion',
  card_champion_title_caisse: 'The Champion (checkout)',
  card_champion_body_product:
    '« {name} » leads: about {pct}% of your margin in the period (catalog / checkout data).',
  card_champion_body_note:
    'Most common purchase label this month: « {text} » ({count, plural, one {# time} other {# times}}). Connect a catalog for product / margin level.',
  card_champion_body_empty:
    'No recurring purchase pattern in checkout notes. Enter a short detail (e.g. « BBQ bundle ») or connect your catalog.',
  card_stock_title: 'Stock alert',
  card_stock_body_ratio:
    '« {label} »: sales about {ratio}× vs forecast — check stock for the coming days.',
  card_stock_body_empty:
    'Connect your product file, wholesaler or ERP for volume vs forecast alerts.',
  vip_month_range: 'Current month: {from} – {to}',
  card_vip_title: 'VIP of the month',
  card_vip_body_spend_named:
    '{period}. {name} totals {amount} on recorded tickets. Auto thank-you: Settings → WhatsApp relaunches (VIP of the month).',
  card_vip_body_spend_anon:
    '{period}. One customer totals {amount} on tickets (profile to reconcile). Auto thank-you: Settings → WhatsApp relaunches.',
  card_vip_body_visits_named:
    '{period}. {name} has {count, plural, one {# visit} other {# visits}} — top loyalty volume. Auto thank-you: Settings → WhatsApp relaunches.',
  card_vip_body_visits_anon:
    '{period}. Top volume: {count, plural, one {# visit recorded} other {# visits recorded}} (profile to reconcile).',
  card_vip_body_low_activity:
    '{period}. Not enough activity to name a VIP yet. Enter ticket amounts to rank by cumulative revenue.',
  card_risk_title: 'Risk',
  card_risk_body_at_risk:
    '{count, plural, one {# loyal customer (≥ {minVisits} visits), no visit for {inactiveDays} days — relaunch without hunting numbers.} other {# loyal customers (≥ {minVisits} visits), no visit for {inactiveDays} days — relaunch without hunting numbers.}}',
  card_risk_body_safe:
    'No qualified loyal customer (≥ {minVisits} visits) beyond {inactiveDays} days without a visit — strong retention in this window.',
  card_risk_cta_clients: 'Open client base',
  monthly_coach_intro:
    'You are at {progressPercent}% of your monthly goal ({revenue} of {goal}), with {daysLeft, plural, one {# day} other {# days}} left.',
  monthly_coach_shortfall: ' At this pace, projected gap at month-end is about {shortfall}.',
  monthly_coach_on_track: ' At this pace you can hit or beat the goal.',
  monthly_war_gap:
    'Tip: run a « double points » offer or WhatsApp nudge this weekend to close the gap and secure the goal.',
  monthly_war_done:
    'Goal met or exceeded: double down on new profiles and ask for a Google review after visits.',
  monthly_war_default:
    'Tip: mention the loyalty card at checkout every visit to keep momentum.',
  monthly_forecast_progress:
    'At this pace, month-end projection: about {projected} — goal {goal} ({vsGoalSigned}% vs goal).',
  monthly_forecast_simple: 'Month-end projection: {projected} (goal {goal}).',
};

bananoPilotageCore.de = { ...bananoPilotageCore.en };
bananoPilotageCore.es = { ...bananoPilotageCore.en };
bananoPilotageCore.it = { ...bananoPilotageCore.en };
bananoPilotageCore.pt = { ...bananoPilotageCore.en };
bananoPilotageCore.ja = { ...bananoPilotageCore.en };
bananoPilotageCore.zh = { ...bananoPilotageCore.en };

for (const loc of ['fr', 'en', 'de', 'es', 'it', 'ja', 'pt', 'zh']) {
  const p = path.join(MESSAGES, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.Dashboard) j.Dashboard = {};
  j.Dashboard.bananoPilotageCore = bananoPilotageCore[loc];
  fs.writeFileSync(p, JSON.stringify(j));
  console.log('merged bananoPilotageCore', loc);
}
