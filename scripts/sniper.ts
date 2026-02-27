/**
 * Sniper - Script de prospection ultra-performant
 * Utilise Google Places API (Maps_API_KEY) + GPT-4o pour identifier et qualifier des prospects
 * Adapte ton et langue au pays ciblé (country profiles)
 *
 * Usage: npx tsx scripts/sniper.ts [ville] [catégorie] [countryCode]
 * Exemple: npx tsx scripts/sniper.ts "Lyon" "Restaurants" FR
 *          npx tsx scripts/sniper.ts "Milan" "Ristoranti" IT
 *          npx tsx scripts/sniper.ts "Austin" "Restaurants" US
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { getCountryProfile } from '../lib/country-profiles';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAPS_API_KEY = process.env.MAPS_API_KEY;
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACE_DETAILS_BASE = 'https://places.googleapis.com/v1/places';

// Champs pour Text Search (Essentials + Enterprise pour rating)
const SEARCH_FIELDS =
  'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount';
// Champs pour Place Details (inclut reviews)
const DETAILS_FIELDS =
  'id,displayName,formattedAddress,rating,userRatingCount,reviews';

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{
    name?: string;
    text?: { text?: string };
    rating?: number;
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string };
  }>;
};

type PlaceBasic = {
  id: string;
  name: string;
  address?: string;
  rating?: number;
  userRatingCount?: number;
};

type PlaceWithDetails = PlaceBasic & {
  reviews: Array<{
    text: string;
    rating?: number;
    relativeTime?: string;
    authorName?: string;
  }>;
};

async function textSearch(query: string, maxResults = 20): Promise<PlaceBasic[]> {
  if (!MAPS_API_KEY) {
    throw new Error('MAPS_API_KEY is required');
  }

  const res = await fetch(TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': MAPS_API_KEY,
      'X-Goog-FieldMask': SEARCH_FIELDS,
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: Math.min(maxResults, 20),
      languageCode: 'fr',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Places Text Search failed: ${err}`);
  }

  const data = (await res.json()) as { places?: GooglePlace[] };
  const places = data.places ?? [];

  return places
    .filter((p) => p.id)
    .map((p) => ({
      id: p.id!,
      name: p.displayName?.text ?? 'Sans nom',
      address: p.formattedAddress,
      rating: p.rating,
      userRatingCount: p.userRatingCount ?? 0,
    }));
}

async function getPlaceDetails(placeId: string): Promise<PlaceWithDetails | null> {
  if (!MAPS_API_KEY) return null;

  const res = await fetch(`${PLACE_DETAILS_BASE}/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': MAPS_API_KEY,
      'X-Goog-FieldMask': DETAILS_FIELDS,
    },
  });

  if (!res.ok) return null;

  const p = (await res.json()) as GooglePlace;
  if (!p.id) return null;

  const reviews = (p.reviews ?? []).map((r) => ({
    text: r.text?.text ?? '',
    rating: r.rating,
    relativeTime: r.relativePublishTimeDescription,
    authorName: r.authorAttribution?.displayName,
  }));

  return {
    id: p.id,
    name: p.displayName?.text ?? 'Sans nom',
    address: p.formattedAddress,
    rating: p.rating,
    userRatingCount: p.userRatingCount ?? 0,
    reviews,
  };
}

function matchesSniperFilter(place: PlaceWithDetails): boolean {
  const rating = place.rating ?? 0;
  return rating >= 3.2 && rating <= 4.1;
}

const TONE_PROMPTS: Record<string, string> = {
  'aggressive/roi': 'Focus on revenue and growth. Be direct and ROI-oriented. Use "revenue", "growth", "conversion".',
  'protective/quality': 'Focus on quality and reputation protection. Use "qualité", "image", "protection de l\'image".',
  'formal/respect': 'Be ultra-polite and respectful. Use formal language. Emphasize "respect" and "service client".',
  'precise/efficiency': 'Be precise and efficiency-focused. Professional, structured, no fluff.',
  'warm/trust': 'Warm and trust-building. Personal, empathetic, emphasize trust.',
  'professional/warm': 'Professional yet warm. Balanced, empathetic, solution-oriented.',
};

async function generatePitch(
  place: PlaceWithDetails,
  countryCode: string,
  targetLang: string
): Promise<string> {
  const rating = place.rating ?? 0;
  const lastReview = place.reviews[0];
  const reviewExcerpt = lastReview?.text?.slice(0, 120) ?? '';
  const author = lastReview?.authorName ?? 'un client';
  const daysAgo = lastReview?.relativeTime ?? 'récemment';
  const profile = getCountryProfile(countryCode);
  const toneGuide = TONE_PROMPTS[profile.tone] ?? TONE_PROMPTS['professional/warm'];

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Tu es un commercial Reputexa. Tu rédiges des messages d'accroche ultra-personnalisés pour contacter des propriétaires d'établissements.
Le message doit être rédigé en ${targetLang}.
Ton à adopter: ${toneGuide}
Maximum 3 phrases. Personnalise selon leur note (${rating}/5) et leur situation.`,
      },
      {
        role: 'user',
        content: `Génère un pitch pour "${place.name}" (pays: ${countryCode}, langue: ${targetLang}).
- Note actuelle : ${rating}/5
${lastReview ? `- Dernier avis de "${author}" ${daysAgo}: "${reviewExcerpt}"` : '- Pas de dernier avis'}
Commence par la salutation adaptée à la langue (Bonjour, Hello, Hola, etc.). Mentionne leur note et propose une aide concrète.`,
      },
    ],
  });

  return res.choices[0]?.message?.content?.trim() ?? '';
}

const COUNTRY_TO_LANG: Record<string, string> = {
  FR: 'français', US: 'anglais', GB: 'anglais', DE: 'allemand', ES: 'espagnol',
  IT: 'italien', JP: 'japonais', AE: 'arabe', MX: 'espagnol (Mexique)', BR: 'portugais brésilien',
};

async function main() {
  const city = process.argv[2] ?? 'Lyon';
  const category = process.argv[3] ?? 'Restaurants';
  const countryCode = process.argv[4] ?? 'FR';
  const targetLang = COUNTRY_TO_LANG[countryCode.toUpperCase()] ?? 'français';
  const query = `${category} à ${city}`;

  console.log('\n' + '='.repeat(60));
  console.log('🎯 Sniper - Prospection Reputexa (International)');
  console.log('='.repeat(60));
  console.log(`📌 Recherche: "${query}"`);
  console.log(`🌍 Pays: ${countryCode} → langue: ${targetLang}`);
  console.log(`📊 Filtre: note entre 3.2 et 4.1`);
  console.log('='.repeat(60) + '\n');

  if (!MAPS_API_KEY) {
    console.error('❌ MAPS_API_KEY manquant dans .env');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY manquant dans .env');
    process.exit(1);
  }

  console.log('🔍 Recherche des établissements via Places API...');
  const places = await textSearch(query);
  console.log(`   → ${places.length} établissements trouvés\n`);

  const prospects: PlaceWithDetails[] = [];
  const BATCH_DELAY_MS = 200;

  console.log('📥 Récupération des détails et filtrage...');
  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    const details = await getPlaceDetails(p.id);

    if (details && matchesSniperFilter(details)) {
      prospects.push(details);
      console.log(`   [${i + 1}/${places.length}] ✓ ${p.name} (${details.rating}/5) → prospect`);
    } else {
      const ratingStr = details?.rating ? `${details.rating}/5` : '?';
      console.log(`   [${i + 1}/${places.length}] ○ ${p.name} (${ratingStr}) → ignoré`);
    }
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log(`\n🎯 ${prospects.length} prospects identifiés (note 3.2-4.1)\n`);

  console.log('🤖 Génération des pitchs personnalisés (GPT-4o)...');
  for (let i = 0; i < prospects.length; i++) {
    const place = prospects[i];
    console.log(`   [${i + 1}/${prospects.length}] Génération pour "${place.name}" (${place.rating}/5)...`);

    const pitch = await generatePitch(place, countryCode, targetLang);

    const existing = await prisma.prospect.findUnique({
      where: { placeId: place.id },
    });

    const lastReview = place.reviews[0];
    if (existing) {
      await prisma.prospect.update({
        where: { placeId: place.id },
        data: {
          pitch,
          countryCode,
          updatedAt: new Date(),
        },
      });
      console.log(`   ↻ Mis à jour: ${place.name}`);
    } else {
      await prisma.prospect.create({
        data: {
          placeId: place.id,
          establishmentName: place.name,
          address: place.address,
          city,
          category,
          countryCode,
          rating: place.rating ?? 0,
          reviewCount: place.userRatingCount ?? 0,
          lastReviewText: lastReview?.text,
          lastReviewAuthor: lastReview?.authorName,
          lastReviewRelative: lastReview?.relativeTime,
          pitch,
          status: 'TO_CONTACT',
          metadata: { reviewsCount: place.reviews.length } as object,
        },
      });
      console.log(`   ✓ Créé: ${place.name}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Terminé - ${prospects.length} prospects sauvegardés (statut TO_CONTACT)`);
  console.log('='.repeat(60) + '\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
