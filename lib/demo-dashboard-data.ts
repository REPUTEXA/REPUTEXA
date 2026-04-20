/**
 * Données de démo pour le mockup du dashboard sur la landing.
 * Même structure que les données du vrai dashboard.
 * Déterministe (pas de Math.random) pour éviter les erreurs d'hydratation serveur/client.
 */

import { subDays } from 'date-fns';

export type DemoReview = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  source: string;
  responseText: string | null;
  createdAt: string;
};

const NAMES = ['Camille', 'Julien', 'Marie', 'Thomas', 'Sophie', 'Pierre', 'Léa', 'Antoine', 'Emma', 'Lucas', 'Chloé', 'Nathan', 'Manon', 'Hugo', 'Julie', 'Louis', 'Laura', 'Gabriel', 'Pauline', 'Raphaël'];
const POSITIVE_COMMENTS = [
  "Cuisine raffinée et cuisson parfaite des viandes. Service impeccable.",
  "Super accueil, terrasse agréable et carte des vins au top.",
  "Excellente soirée, plats savoureux et équipe aux petits soins.",
  "Cadre magnifique, ambiance conviviale. À refaire !",
  "Les desserts sont divins. Un vrai régal.",
  "Service rapide et souriant, qualité au rendez-vous.",
];
const NEGATIVE_COMMENTS = [
  "Plus de 25 minutes d'attente entre les plats le samedi soir.",
  "Un peu d'attente au moment de l'addition.",
  "Le plat était tiède à l'arrivée.",
  "Terrasse bruyante, difficile de discuter.",
];

/** Pick déterministe basé sur l'index pour que serveur et client aient les mêmes données. */
function pickAt<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

/** Date de référence fixe pour que les dates générées soient identiques serveur/client. */
const DEMO_BASE_DATE = new Date('2025-01-15T12:00:00.000Z');

export function getDemoReviews(): DemoReview[] {
  const reviews: DemoReview[] = [];

  // 72 positifs (4-5★), 15 négatifs (1-3★) → 87 total, avg ~4.4
  const positiveRatings = [...Array(58).fill(5), ...Array(14).fill(4)];
  const negativeRatings = [...Array(5).fill(3), ...Array(5).fill(2), ...Array(5).fill(1)];
  const allRatings = [...positiveRatings, ...negativeRatings];

  for (let i = 0; i < 87; i++) {
    const rating = allRatings[i];
    const isPositive = rating >= 4;
    const source = pickAt(['Google', 'Facebook', 'Trustpilot'] as const, i);
    const dayOffset = i % 30;
    const createdAt = subDays(DEMO_BASE_DATE, dayOffset);

    reviews.push({
      id: `demo-${i}`,
      reviewerName: pickAt(NAMES, i),
      rating,
      comment: isPositive ? pickAt(POSITIVE_COMMENTS, i) : pickAt(NEGATIVE_COMMENTS, i),
      source,
      responseText: isPositive && i % 2 === 0 ? 'Merci pour votre avis !' : null,
      createdAt: createdAt.toISOString(),
    });
  }

  return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
