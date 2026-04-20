/**
 * Recherche d’établissements proches (Google Places API v1 — searchNearby).
 * Usage interne / veille concurrentielle : ne pas utiliser pour envoyer des messages non sollicités.
 *
 * Usage:
 *   npx tsx scripts/nearby-places-research.ts <lat> <lng> <radiusMeters> [includedType]
 * Exemple:
 *   npx tsx scripts/nearby-places-research.ts 45.7640 4.8357 500 restaurant
 */

import 'dotenv/config';

const MAPS_API_KEY = process.env.MAPS_API_KEY;
const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location';

type NearbyPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude?: number; longitude?: number };
};

async function searchNearby(
  lat: number,
  lng: number,
  radiusMeters: number,
  includedType?: string
): Promise<NearbyPlace[]> {
  if (!MAPS_API_KEY) throw new Error('MAPS_API_KEY is required');

  const body: Record<string, unknown> = {
    maxResultCount: 20,
    rankPreference: 'DISTANCE',
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Math.min(Math.max(radiusMeters, 1), 50_000),
      },
    },
  };
  if (includedType?.trim()) {
    body.includedTypes = [includedType.trim()];
  }

  const res = await fetch(NEARBY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': MAPS_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`searchNearby failed: ${err}`);
  }

  const data = (await res.json()) as { places?: NearbyPlace[] };
  return data.places ?? [];
}

async function main() {
  const lat = parseFloat(process.argv[2] ?? '');
  const lng = parseFloat(process.argv[3] ?? '');
  const radius = parseFloat(process.argv[4] ?? '500');
  const type = process.argv[5];

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.error('Usage: npx tsx scripts/nearby-places-research.ts <lat> <lng> <radiusMeters> [includedType]');
    process.exit(1);
  }

  const places = await searchNearby(lat, lng, radius, type);
  const rows = places.map((p) => ({
    id: p.id,
    name: p.displayName?.text,
    address: p.formattedAddress,
    rating: p.rating,
    reviews: p.userRatingCount,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
  }));

  console.log(JSON.stringify({ count: rows.length, places: rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
