/**
 * Barème Défi REPUTEXA — uniquement des points attribués aux prénoms suivis (pas de pot « équipe »).
 */

export type ReviewInput = {
  id: string;
  rating: number;
  comment: string;
  reviewer_name: string;
};

export type ReviewScoreDetail = {
  reviewId: string;
  rating: number;
  /** Conservé à 0 (plus de points séparés « équipe »). */
  teamDelta: number;
  employeeDeltas: Record<string, number>;
  reasons: string[];
};

export type ChallengeScoreResult = {
  /** Somme des points individuels (peut être négative). */
  totalPoints: number;
  leaderboard: { name: string; points: number }[];
  details: ReviewScoreDetail[];
};

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findTrackedNames(textNorm: string, tracked: string[]): string[] {
  const hits: string[] = [];
  for (const raw of tracked) {
    const n = normalizeText(raw);
    if (n.length >= 2 && textNorm.includes(n)) {
      hits.push(raw.trim());
    }
  }
  return Array.from(new Set(hits));
}

/**
 * Barème individuel : 5★+nom, 4★+nom, malus 1–2★ si nom repéré.
 */
export function scoreReviewsForChallenge(
  reviews: ReviewInput[],
  trackedEmployeeNames: string[]
): ChallengeScoreResult {
  const tracked = trackedEmployeeNames.map((s) => s.trim()).filter(Boolean);

  const employeeTotals = new Map<string, number>();
  for (const n of tracked) {
    employeeTotals.set(n, 0);
  }

  const details: ReviewScoreDetail[] = [];

  for (const r of reviews) {
    const rating = typeof r.rating === 'number' && Number.isFinite(r.rating) ? Math.round(r.rating) : 0;
    const textNorm = normalizeText(`${r.comment ?? ''} ${r.reviewer_name ?? ''}`);
    const nameHits = findTrackedNames(textNorm, tracked);

    const employeeDeltas: Record<string, number> = {};
    const reasons: string[] = [];

    const addEmployee = (name: string, pts: number, reason: string) => {
      employeeDeltas[name] = (employeeDeltas[name] ?? 0) + pts;
      employeeTotals.set(name, (employeeTotals.get(name) ?? 0) + pts);
      reasons.push(reason);
    };

    if (rating <= 2 && rating >= 1) {
      if (nameHits.length > 0) {
        const primary = nameHits[0]!;
        addEmployee(primary, -1, `Avis 1–2★ avec mention de ${primary} : −1`);
      } else {
        reasons.push('Avis 1–2★ sans nom suivi repéré : 0 pt');
      }
    } else if (rating === 5) {
      if (nameHits.length > 0) {
        const primary = nameHits[0]!;
        addEmployee(primary, 3, `5★ + employé cité (${primary}) : +3`);
      } else {
        reasons.push('5★ sans prénom suivi dans le texte : 0 pt');
      }
    } else if (rating === 4) {
      if (nameHits.length > 0) {
        const primary = nameHits[0]!;
        addEmployee(primary, 1, `4★ + employé cité (${primary}) : +1`);
      } else {
        reasons.push('4★ sans prénom suivi : 0 pt');
      }
    } else {
      reasons.push('—');
    }

    details.push({
      reviewId: r.id,
      rating,
      teamDelta: 0,
      employeeDeltas,
      reasons: reasons.length ? reasons : ['—'],
    });
  }

  const leaderboard = Array.from(employeeTotals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    .map(([name, points]) => ({ name, points }));

  const totalPoints = Array.from(employeeTotals.values()).reduce((a, b) => a + b, 0);

  return { totalPoints, leaderboard, details };
}

export function isChallengePeriodActive(
  isActive: boolean,
  startsAt: string | null,
  endsAt: string | null,
  now: Date = new Date()
): boolean {
  if (!isActive) return false;
  if (!startsAt || !endsAt) return false;
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return false;
  const t = now.getTime();
  return t >= s && t <= e;
}
