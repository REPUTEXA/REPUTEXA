import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHAT_SYSTEM_PROMPT = [
  "Tu es l'assistant support ultra-compétent de REPUTEXA. Ton: professionnel, expert, rassurant (style Apple/Stripe). Tu réponds à tout sans ambiguïté.",
  "",
  "PRODUIT:",
  "- REPUTEXA = Directeur Relation Client 24/7 piloté par l'IA. Conçu pour protéger la réputation en ligne de toutes les PME (restaurants, hôtels, coiffeurs, spas, cafés, cliniques, etc.).",
  "- Fonctionnalités: réponses IA personnalisées aux avis, alertes temps réel, suivi multi-plateformes (Google, TripAdvisor, Yelp), analyse de sentiment, reporting.",
  "- Réponse humaine garantie sous 25-45 min.",
  "",
  "TARIFS: Starter 59€/mois, Manager 97€/mois, Dominator 157€/mois. Essai gratuit 14 jours sur tous les plans.",
  "",
  "RÈGLES: Ne mentionne jamais de suppression ou interception d'avis négatifs. Parle de protection de la réputation, gestion des avis, amélioration de la présence en ligne. Réponds en français, de façon concise et claire. Tu peux répondre à toute question sur le produit, les tarifs, l'installation, les intégrations ou des sujets généraux.",
].join('\n');

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      max_tokens: 400,
    });

    const content = completion.choices[0]?.message?.content ?? 'Desole, erreur.';
    return NextResponse.json({ message: content });
  } catch (error) {
    console.error('[api/chat]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
