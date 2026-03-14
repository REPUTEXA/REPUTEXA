/**
 * Analyse de sentiment pour la page Statistiques (Pulse+).
 * Retourne forces, axes d'amélioration, insight expert.
 * Zenith : ajoute benchmark et prédictions.
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { checkPlan, toPlanSlug } from '@/lib/feature-gate';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type SentimentPayload = {
  strengths: string[];
  improvements: string[];
  expertInsight: string;
  benchmark: string | null;
  predictions: string | null;
  notEnoughData?: boolean;
};

const SENTIMENT_CACHE = new Map<string, { createdAt: number; payload: SentimentPayload }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function GET(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const url = new URL(request.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const periodParam = url.searchParams.get('period') ?? '';

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, selected_plan, establishment_name')
      .eq('id', user.id)
      .single();

    const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
    if (!checkPlan(planSlug, 'pulse')) {
      return NextResponse.json({ error: 'Pulse plan required' }, { status: 403 });
    }

    let fromIso: string | null = null;
    let toIso: string | null = null;
    if (fromParam && toParam) {
      const fromDate = new Date(fromParam);
      const toDate = new Date(toParam);
      if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
        const start = fromDate <= toDate ? fromDate : toDate;
        const end = fromDate <= toDate ? toDate : fromDate;
        fromIso = new Date(start.setHours(0, 0, 0, 0)).toISOString();
        toIso = new Date(end.setHours(23, 59, 59, 999)).toISOString();
      }
    }

    const periodKey = fromIso && toIso ? `${fromIso}::${toIso}` : 'all';
    const cacheKey = `${user.id}:${planSlug}:${periodKey}:${periodParam}`;
    const cached = SENTIMENT_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return NextResponse.json(cached.payload);
    }

    let query = supabase
      .from('reviews')
      .select('rating, comment, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(80);

    if (fromIso && toIso) {
      query = supabase
        .from('reviews')
        .select('rating, comment, created_at')
        .eq('user_id', user.id)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false })
        .limit(80);
    }

    const { data: reviews } = await query;

    const list = (reviews ?? []).map((r) => `[${r.rating}/5] ${r.comment}`).filter(Boolean);
    if (list.length < 5) {
      const payload: SentimentPayload = {
        strengths: [],
        improvements: [],
        expertInsight: '',
        benchmark: null,
        predictions: null,
        notEnoughData: true,
      };
      SENTIMENT_CACHE.set(cacheKey, { createdAt: Date.now(), payload });
      return NextResponse.json(payload);
    }

    const isZenith = planSlug === 'zenith';

    const basePromptLines = [
      'Tu es un consultant e-réputation senior en mode COACH BUSINESS.',
      'Analyse ces avis et renvoie UNIQUEMENT un JSON valide.',
      '',
      'CONTRAINTES STRICTES :',
      '- INTERDIT d\'utiliser des phrases vagues ou creuses comme "expérience client satisfaisante", "garder la qualité", "continuer sur cette lancée", "globalement positif", "bonne expérience".',
      '- Tu dois t\'appuyer sur des éléments CONCRETS des avis : exemples de thèmes attendus : "temps d\'attente", "amabilité du personnel", "plats froids", "propreté de la salle", "bruit", "prix", "qualité des desserts", etc.',
      '- strengths et improvements doivent contenir des groupes de mots très courts (maximum 3 mots) décrivant ces thèmes concrets (ex : "temps d\'attente", "plats froids", "propreté salle").',
      '- Pas de paraphrase marketing, uniquement des axes lisibles et opérationnels.',
      '',
      'STRUCTURE JSON ATTENDUE :',
      '{"strengths":["mot ou groupe de mots 1","mot ou groupe de mots 2","mot ou groupe de mots 3"],"improvements":["axe concret 1","axe concret 2"],"expertInsight":"Une phrase de coach ultra concrète avec une action mesurable (max 160 caractères)."}',
      '',
      'RÈGLES POUR "expertInsight" :',
      '- 1 seule phrase, ACTIONNABLE, pas de blabla.',
      '- Mentionne explicitement au moins UN des thèmes présents dans strengths ou improvements.',
      '- Donne une action précise + un objectif mesurable (par ex : "Réduisez le temps d\'attente le samedi soir pour augmenter la note moyenne de 0,5 point.").',
      '',
      'Réponds en français, ton professionnel mais direct.',
      '',
      'Avis à analyser :',
      list.slice(0, 50).join('\n'),
    ];

    const prompt = basePromptLines.join('\n');

    let payload: SentimentPayload;

    if (isZenith) {
      const promptZenith = [
        prompt,
        '',
        'Pour un client au plan ZENITH, complète le JSON avec :',
        '- "benchmark" : une phrase comparant la situation à la moyenne du secteur (restauration/hôtellerie) de façon factuelle.',
        '- "predictions" : une phrase sur la tendance des 3 prochains mois SI rien ne change (ou les gains possibles si les axes d\'amélioration sont traités).',
        'Format final : {"strengths":[],"improvements":[],"expertInsight":"","benchmark":"...","predictions":"..."}',
      ].join('\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Tu es consultant stratégique e-réputation. Tu dois répondre UNIQUEMENT en JSON strictement valide, sans texte autour.',
          },
          { role: 'user', content: promptZenith },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response');
      const parsed = JSON.parse(content) as {
        strengths?: string[];
        improvements?: string[];
        expertInsight?: string;
        benchmark?: string;
        predictions?: string;
      };

      payload = {
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 4) : [],
        expertInsight: String(parsed.expertInsight ?? '').trim(),
        benchmark: String(parsed.benchmark ?? '').trim() || null,
        predictions: String(parsed.predictions ?? '').trim() || null,
      };
    } else {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Tu es consultant e-réputation. Réponds UNIQUEMENT en JSON valide, sans préambule ni explication.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('No response');
      const parsed = JSON.parse(content) as {
        strengths?: string[];
        improvements?: string[];
        expertInsight?: string;
      };

      payload = {
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 4) : [],
        expertInsight: String(parsed.expertInsight ?? '').trim(),
        benchmark: null,
        predictions: null,
      };
    }

    SENTIMENT_CACHE.set(cacheKey, { createdAt: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[statistics-sentiment]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
