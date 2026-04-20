/**
 * Projection indicative « horizon 100M€ ARR » à partir du MRR courant et de la tendance
 * récente du CA facturé Stripe (croissance composée m/m).
 */

export const TARGET_ARR_EUR = 100_000_000;

export type ExecutiveProjection = {
  monthsTo100mArr: number | null;
  /** Code court pour logs / PDF (optional) */
  projectionNote?: 'arr_zero' | 'growth_flat' | 'too_long' | 'already_there';
  /** Taux de croissance mensuel implicite retenu (ex. 0.04 = +4 %), si calculable */
  impliedMonthlyMomentum: number | null;
};

function monthKeysChronological(monthsBack: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/**
 * @param mrrEur MRR Stripe (abonnements actifs + trialing)
 * @param invoiceByMonth montants EUR par clé YYYY-MM (CA factures payées)
 */
export function computeExecutiveProjection(
  mrrEur: number,
  invoiceByMonth: Map<string, number>
): ExecutiveProjection {
  const arr = mrrEur * 12;
  if (arr >= TARGET_ARR_EUR) {
    return { monthsTo100mArr: 0, projectionNote: 'already_there', impliedMonthlyMomentum: null };
  }
  if (!Number.isFinite(arr) || arr <= 0) {
    return { monthsTo100mArr: null, projectionNote: 'arr_zero', impliedMonthlyMomentum: null };
  }

  const keys = monthKeysChronological(6);
  const amounts = keys.map((k) => Math.max(0, invoiceByMonth.get(k) ?? 0));
  const mults: number[] = [];
  for (let i = 1; i < amounts.length; i++) {
    const prev = amounts[i - 1];
    const cur = amounts[i];
    if (prev > 0 && cur > 0) mults.push(cur / prev);
  }

  let impliedG: number | null = null;
  if (mults.length >= 2) {
    impliedG = (mults[mults.length - 1]! + mults[mults.length - 2]!) / 2 - 1;
  } else if (mults.length === 1) {
    impliedG = mults[0]! - 1;
  }

  if (impliedG == null || !Number.isFinite(impliedG) || impliedG <= 0.0005) {
    return {
      monthsTo100mArr: null,
      projectionNote: 'growth_flat',
      impliedMonthlyMomentum: impliedG != null && Number.isFinite(impliedG) ? impliedG : null,
    };
  }

  const ratio = TARGET_ARR_EUR / arr;
  const n = Math.log(ratio) / Math.log(1 + impliedG);
  if (!Number.isFinite(n) || n < 0) {
    return { monthsTo100mArr: null, impliedMonthlyMomentum: impliedG };
  }

  const months = Math.max(1, Math.ceil(n));
  if (months > 480) {
    return { monthsTo100mArr: null, projectionNote: 'too_long', impliedMonthlyMomentum: impliedG };
  }

  return { monthsTo100mArr: months, impliedMonthlyMomentum: impliedG };
}

/** Textes data-room (Executive Summary) — PDF & contexte copilot ; formulation factuelle, sans CAC/LTV. */
export function buildExecutiveSummaryNarrative(proj: ExecutiveProjection): string {
  const months = proj.monthsTo100mArr;
  const arrRef =
    'seuil de référence data-room de 100 M€ d’ARR (MRRStripe × 12, non audité)';
  if (months === 0) {
    return `L’ARR dérivé du MRR Stripe agrégé atteint ou dépasse déjà ${arrRef}.`;
  }
  if (months != null) {
    return `Scénario purement mécanique (non prévisionnel) : en prolongeant le momentum récent des encaissements facturés et le MRR courant, un ordre de grandeur indicatif plafonne un horizon d’environ ${months} mois vers ${arrRef}. Ce calcul ne tient pas compte du churn, de la saisonnalité ni des changements d’offre.`;
  }
  return 'Les agrégats Stripe (trésorerie, MRR, encaissements) reflètent l’état courant. Aucun horizon chiffré vers 100 M€ d’ARR n’est déduit automatiquement lorsque la série récente d’encaissements ne permet pas une extrapolation stable ou récurrente.';
}

export function executiveSummaryFootnote(proj: ExecutiveProjection): string {
  if (proj.monthsTo100mArr != null && proj.monthsTo100mArr > 0 && proj.impliedMonthlyMomentum != null) {
    const pct = (proj.impliedMonthlyMomentum * 100).toFixed(2);
    return `Note méthodologique (non auditée) : momentum mensuel implicite ≈ ${pct} % sur la fenêtre récente ; lecture indicative, pas un engagement de trajectoire.`;
  }
  return 'Note (non auditée) : lorsque la tendance facturée est plate, discontinue ou insuffisamment lisible, aucun horizon chiffré n’est imposé.';
}
