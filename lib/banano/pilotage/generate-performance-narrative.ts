import OpenAI from 'openai';
import type { BananoPerformanceMonthStats } from '@/lib/banano/pilotage/performance-report-stats';
import { REPUTEXA_CROSS_CUT_AI_VOICE } from '@/lib/ai/reputexa-cross-cut-voice';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

export type PerformanceNarrative = {
  /** Ex. Progression Excellente, Vigilance recommandée, Alerte */
  badge: string;
  /** Une phrase d’accroche sous le badge */
  headline: string;
  /** 3 à 5 phrases pour le corps du PDF */
  formalParagraphs: string[];
  /** Phrase courte « équipier du mois » (tickets agent sync), affichée sous le tableau PDF. */
  employeeOfMonthLine: string | null;
};

function fmtEur(cents: number, locale: string): string {
  const tag = siteLocaleToIntlDateTag(locale);
  return new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function employeeOfMonthLineFromCashSync(
  stats: BananoPerformanceMonthStats,
  locale: string
): string | null {
  const top = stats.cashStaffMonth[0];
  if (!top) return null;
  if (locale === 'fr') {
    return `Équipier du mois (tickets sync) : ${top.staffName} — ${fmtEur(top.revenueCents, locale)} sur ${top.ticketCount} ticket${top.ticketCount > 1 ? 's' : ''}, capture Wallet ${top.capturePercent.toFixed(1)} %.`;
  }
  return `Staff of the month (synced tickets): ${top.staffName} — ${fmtEur(top.revenueCents, locale)} across ${top.ticketCount} ticket${top.ticketCount === 1 ? '' : 's'}, Wallet capture ${top.capturePercent.toFixed(1)}%.`;
}

const GPT_OUTPUT_LANG: Record<string, string> = {
  fr: 'French',
  en: 'English',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  zh: 'Simplified Chinese',
};

function fallbackNarrative(
  establishmentName: string,
  stats: BananoPerformanceMonthStats,
  locale: string
): PerformanceNarrative {
  if (locale !== 'fr') {
    return fallbackNarrativeEn(establishmentName, stats, locale);
  }

  const lines: string[] = [];

  if (stats.hasRevenueData) {
    if (stats.revenueChangePct != null) {
      const dir = stats.revenueChangePct >= 0 ? 'progression' : 'variation';
      lines.push(
        `Ce mois-ci, votre chiffre d'affaires enregistré via la caisse fidélité s'élève à ${fmtEur(stats.revenueCents, locale)}, soit une ${dir} de ${stats.revenueChangePct >= 0 ? '+' : ''}${stats.revenueChangePct.toFixed(1)} % par rapport au mois précédent.`
      );
    } else if (stats.revenueCents > 0) {
      lines.push(
        `Ce mois-ci, le total des tickets saisis s'élève à ${fmtEur(stats.revenueCents, locale)}.`
      );
    }
  } else {
    lines.push(
      "Les montants TTC à la caisse ne sont pas encore renseignés de façon systématique : activez la saisie du ticket sur chaque achat pour suivre le CA dans ce rapport."
    );
  }

  if (stats.newMembersCount > 0) {
    lines.push(
      `L'impact de la fidélité : ${stats.newMembersCount} nouveau${stats.newMembersCount > 1 ? 'x' : ''} client${stats.newMembersCount > 1 ? 's' : ''} recruté${stats.newMembersCount > 1 ? 's' : ''} sur la période ${stats.hasRevenueData && stats.newMembersRevenueCents > 0 ? `pour un volume associé d'environ ${fmtEur(stats.newMembersRevenueCents, locale)}` : ''}.`
    );
  } else {
    lines.push(
      "Poussez l'enrôlement au terminal pour convertir davantage de passages en base clients identifiables."
    );
  }

  const rf = stats.retentionFunnel;
  lines.push(
    `Indicateurs de rétention sur le mois clos : ${rf.newClientsThisMonth} nouvelle(s) fiche(s), ${rf.returnedAtLeastTwiceThisMonth} client(s) avec au moins deux passages fidélité, ${rf.vipProfilesCount} fiche(s) VIP (3+ visites au total).`
  );

  const sp = stats.staffPerformance.rows;
  if (sp.length > 0) {
    const top = sp[0];
    lines.push(
      `Côté équipe (${sp.length} profil${sp.length > 1 ? 's' : ''} suivi${sp.length > 1 ? 's' : ''}), ${top.display_name} réalise le plus fort CA tickets saisis (${fmtEur(top.revenueCents, locale)}), avec ${top.clientsCreated} fiche${top.clientsCreated > 1 ? 's' : ''} créée${top.clientsCreated > 1 ? 's' : ''} et ${top.transformPercent.toFixed(1)} % de transformation (fiches ÷ tickets).`
    );
  } else {
    lines.push(
      'Ajoutez vos équipiers dans Banano → Paramètres pour mesurer tickets et fiches créées, mois par mois.'
    );
  }

  const staffLoyalty = stats.loyaltyValue.costBreakdown.fixedRedemptionsByStaff;
  if (staffLoyalty.length > 0) {
    const top = staffLoyalty[0];
    const mix = top.fixedEuroFromVoucherRedeemsCents + top.staffAllowanceDebitCents;
    lines.push(
      `Côté remises fidélité par équipier (PIN caisse), ${top.staffDisplayName} affiche le plus fort cumul du mois : ${fmtEur(mix, locale)} (€ fixes sur bons utilisés + débits bon collaborateur).`
    );
  }

  if (stats.googleRatingDelta != null && stats.googleReviewCountThis > 0) {
    const sign = stats.googleRatingDelta >= 0 ? 'gagné' : 'perdu';
    lines.push(
      `Réputation (avis Google du mois) : note moyenne ${stats.googleAvgThis.toFixed(1)}/5, soit ${Math.abs(stats.googleRatingDelta).toFixed(1)} point${Math.abs(stats.googleRatingDelta) >= 2 ? 's' : ''} ${sign} sur l'échelle par rapport au mois précédent sur les avis reçus.`
    );
  } else if (stats.googleReviewCountThis > 0) {
    lines.push(
      `Note moyenne Google sur les avis du mois : ${stats.googleAvgThis.toFixed(1)}/5 (${stats.googleReviewCountThis} avis).`
    );
  } else {
    lines.push(
      'Réputation en ligne : continuez à solliciter les avis Google pour nourrir cette section du rapport.'
    );
  }

  let badge = 'Suivi régulier';
  let headline = 'Maintenez la discipline de saisie et de relance pour maximiser la valeur REPUTEXA.';

  if (stats.revenueChangePct != null) {
    if (stats.revenueChangePct >= 10) {
      badge = 'Progression Excellente';
      headline = 'Vos indicateurs de caisse fidélité confirment une dynamique très favorable.';
    } else if (stats.revenueChangePct <= -10) {
      badge = "Alerte : baisse d'activité";
      headline =
        'La fréquentation enregistrée ou le panier moyen demandent une action ciblée (offre flash, relance WhatsApp).';
    } else if (stats.revenueChangePct < 0) {
      badge = 'Vigilance recommandée';
      headline = "Léger recul par rapport au mois précédent : surveillez les jours les plus calmes.";
    }
  }

  return {
    badge,
    headline,
    formalParagraphs: lines,
    employeeOfMonthLine: employeeOfMonthLineFromCashSync(stats, locale),
  };
}

/** Hors FR : repli anglais si l’API est indisponible (évite d’exposer du français). */
function fallbackNarrativeEn(
  establishmentName: string,
  stats: BananoPerformanceMonthStats,
  locale: string
): PerformanceNarrative {
  const lines: string[] = [];
  if (stats.hasRevenueData) {
    if (stats.revenueChangePct != null) {
      lines.push(
        `This month, loyalty-till revenue totals ${fmtEur(stats.revenueCents, locale)}, a ${stats.revenueChangePct >= 0 ? 'gain' : 'change'} of ${stats.revenueChangePct >= 0 ? '+' : ''}${stats.revenueChangePct.toFixed(1)}% vs the previous month.`
      );
    } else if (stats.revenueCents > 0) {
      lines.push(`Recorded ticket totals this month: ${fmtEur(stats.revenueCents, locale)}.`);
    }
  } else {
    lines.push(
      'Ticket amounts are not yet entered consistently—add the receipt total on each visit to track revenue here.'
    );
  }
  if (stats.newMembersCount > 0) {
    lines.push(
      `Loyalty impact: ${stats.newMembersCount} new member(s) ${stats.hasRevenueData && stats.newMembersRevenueCents > 0 ? `(~${fmtEur(stats.newMembersRevenueCents, locale)} associated)` : ''}.`
    );
  } else {
    lines.push('Enrol more customers at the terminal to grow your identifiable base.');
  }
  const rf = stats.retentionFunnel;
  lines.push(
    `Retention this month: ${rf.newClientsThisMonth} new profile(s), ${rf.returnedAtLeastTwiceThisMonth} with two+ loyalty visits, ${rf.vipProfilesCount} VIP profiles (3+ lifetime visits).`
  );
  const sp = stats.staffPerformance.rows;
  if (sp.length > 0) {
    const top = sp[0];
    lines.push(
      `Team (${sp.length} profile(s)): ${top.display_name} leads ticket revenue (${fmtEur(top.revenueCents, locale)}), ${top.clientsCreated} profile(s) created, ${top.transformPercent.toFixed(1)}% conversion (profiles ÷ tickets).`
    );
  } else {
    lines.push('Add staff in Banano → Settings to track tickets and profiles month over month.');
  }
  const staffLoyaltyEn = stats.loyaltyValue.costBreakdown.fixedRedemptionsByStaff;
  if (staffLoyaltyEn.length > 0) {
    const top = staffLoyaltyEn[0];
    const mix = top.fixedEuroFromVoucherRedeemsCents + top.staffAllowanceDebitCents;
    lines.push(
      `Loyalty redemptions by staff (till PIN): ${top.staffDisplayName} leads this month at ${fmtEur(mix, locale)} (fixed-€ voucher usage plus staff-allowance debits).`
    );
  }
  if (stats.googleRatingDelta != null && stats.googleReviewCountThis > 0) {
    lines.push(
      `Google reviews this month: average ${stats.googleAvgThis.toFixed(1)}/5, ${Math.abs(stats.googleRatingDelta).toFixed(1)} point(s) ${stats.googleRatingDelta >= 0 ? 'up' : 'down'} vs last month (among reviews received).`
    );
  } else if (stats.googleReviewCountThis > 0) {
    lines.push(
      `Google average this month: ${stats.googleAvgThis.toFixed(1)}/5 (${stats.googleReviewCountThis} reviews).`
    );
  } else {
    lines.push('Keep prompting Google reviews to strengthen this section.');
  }
  let badge = 'Steady tracking';
  let headline = 'Keep disciplined data entry and follow-ups to maximise REPUTEXA value.';
  if (stats.revenueChangePct != null) {
    if (stats.revenueChangePct >= 10) {
      badge = 'Strong momentum';
      headline = 'Your loyalty till metrics show a very favourable trend.';
    } else if (stats.revenueChangePct <= -10) {
      badge = 'Alert: activity dip';
      headline = 'Traffic or basket size may need a targeted action (flash offer, WhatsApp nudge).';
    } else if (stats.revenueChangePct < 0) {
      badge = 'Watch closely';
      headline = 'Slight dip vs last month—watch your quietest days.';
    }
  }
  return {
    badge,
    headline,
    formalParagraphs: lines,
    employeeOfMonthLine: employeeOfMonthLineFromCashSync(stats, locale),
  };
}

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

/**
 * Rédige le texte du PDF performance (IA + repli localisé).
 */
export async function generatePerformanceNarrative(
  establishmentName: string,
  stats: BananoPerformanceMonthStats,
  locale = 'fr'
): Promise<PerformanceNarrative> {
  const openai = getOpenAI();
  if (!openai) {
    return fallbackNarrative(establishmentName, stats, locale);
  }

  const langName = GPT_OUTPUT_LANG[locale] ?? 'English';

  const payload = {
    commerce: establishmentName.trim() || 'Commerce',
    mois: stats.monthLabel,
    ca_cents: stats.revenueCents,
    ca_prev_cents: stats.prevRevenueCents,
    ca_pct: stats.revenueChangePct,
    nouveaux_clients: stats.newMembersCount,
    ca_nouveaux_cents: stats.newMembersRevenueCents,
    visits: stats.visitCount,
    google_note: stats.googleAvgThis,
    google_delta: stats.googleRatingDelta,
    google_avis: stats.googleReviewCountThis,
    has_ca: stats.hasRevenueData,
    retention: stats.retentionFunnel,
    equipe_lignes: stats.staffPerformance.rows.length,
    equipe_top: stats.staffPerformance.rows[0]
      ? {
          nom: stats.staffPerformance.rows[0].display_name,
          ca_cents: stats.staffPerformance.rows[0].revenueCents,
          fiches: stats.staffPerformance.rows[0].clientsCreated,
          transfo_pct: stats.staffPerformance.rows[0].transformPercent,
        }
      : null,
    cash_sync_staff: stats.cashStaffMonth.map((r) => ({
      nom: r.staffName,
      tickets: r.ticketCount,
      ca_cents: r.revenueCents,
      capture_pct: r.capturePercent,
    })),
  };

  const systemFr = `Tu es un analyste conseil pour REPUTEXA (SaaS réputation + fidélité artisan / commerce).
Réponds UNIQUEMENT en JSON valide avec les clés : badge (string courte, ex. "Progression Excellente", "Alerte : fréquentation", "Vigilance"), headline (une phrase), formalParagraphs (tableau de 3 à 5 phrases, ton formel, élégant, "vous"), employeeOfMonthLine (string courte ou null).
Compare toujours au mois précédent quand les chiffres le permettent.
Si has_ca est false, insiste pour saisir les montants en caisse.
Les montants sont en centimes (ca_cents).
Si cash_sync_staff contient au moins une ligne, employeeOfMonthLine doit désigner l'équipier du mois (meilleur CA sur tickets sync, expliciter le taux de capture Wallet) ; sinon null.
Cohérence produit : les relances WhatsApp fidélité côté commerce utilisent le même souci du ton (mémoire client, complicité légère, accueil chaleureux) ; tu peux faire un lien discret avec cette continuité relationnelle si les indicateurs retention / équipe s'y prêtent, sans jargon marketing.
${REPUTEXA_CROSS_CUT_AI_VOICE}`;

  const systemI18n = `You are a consulting analyst for REPUTEXA (SaaS for local businesses: reputation + loyalty).
Reply ONLY with valid JSON: badge (short string), headline (one sentence), formalParagraphs (array of 3–5 formal sentences), employeeOfMonthLine (short string or null).
Compare to the previous month when the figures allow.
If has_ca is false, insist on entering till/receipt amounts.
Amounts in the payload are in cents (ca_cents).
If cash_sync_staff has at least one row, employeeOfMonthLine must name the staff of the month (highest synced-ticket revenue, mention Wallet capture rate); otherwise null.
Tone: warm, professional, light relational memory — aligned with merchant WhatsApp automations; no marketing jargon.
MANDATORY OUTPUT LANGUAGE: ${langName}. Every string in the JSON (badge, headline, every formalParagraphs item, employeeOfMonthLine if not null) must be written entirely in ${langName}.
${REPUTEXA_CROSS_CUT_AI_VOICE}`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: locale === 'fr' ? systemFr : systemI18n,
        },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
      temperature: 0.35,
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as {
      badge?: string;
      headline?: string;
      formalParagraphs?: string[];
      employeeOfMonthLine?: string | null;
    };
    const badge = String(parsed.badge ?? '').trim() || 'Synthèse';
    const headline = String(parsed.headline ?? '').trim() || '';
    const formalParagraphs = Array.isArray(parsed.formalParagraphs)
      ? parsed.formalParagraphs.map((s) => String(s).trim()).filter(Boolean)
      : [];
    if (formalParagraphs.length < 3) {
      return fallbackNarrative(establishmentName, stats, locale);
    }
    let employeeOfMonthLine =
      parsed.employeeOfMonthLine != null ? String(parsed.employeeOfMonthLine).trim() : '';
    if (!employeeOfMonthLine && stats.cashStaffMonth.length > 0) {
      employeeOfMonthLine = employeeOfMonthLineFromCashSync(stats, locale) ?? '';
    }
    return {
      badge,
      headline,
      formalParagraphs,
      employeeOfMonthLine: employeeOfMonthLine || null,
    };
  } catch {
    return fallbackNarrative(establishmentName, stats, locale);
  }
}
