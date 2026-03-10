import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      transcript,
      aiTone,
      aiLength,
      aiInstructions,
    }: {
      transcript?: string;
      aiTone?: string;
      aiLength?: string;
      aiInstructions?: string;
    } = body ?? {};

    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return NextResponse.json({ error: 'Missing transcript' }, { status: 400 });
    }

    const system = [
      'Tu es un assistant qui aide un restaurateur à configurer le style de ses réponses IA aux avis.',
      'À partir des préférences actuelles et de ce qu’il vient de dire à l’oral, tu proposes des réglages mis à jour.',
      'Tu DOIS répondre UNIQUEMENT en JSON avec les clés suivantes :',
      '- "aiTone": un des valeurs suivantes: "professional", "warm", "casual", "luxury", "humorous".',
      '- "aiLength": un des valeurs suivantes: "concise", "balanced", "detailed".',
      '- "aiInstructions": une version mise à jour et réécrite des instructions, maximum 4 phrases.',
      '- "aiSignature": optionnelle, une courte signature si cela a du sens (sinon renvoie simplement une chaîne vide).',
      'Ne commente pas, ne rajoute pas de texte en dehors du JSON.',
    ].join('\n');

    const userContent = [
      'Préférences actuelles :',
      `- Ton: ${aiTone || ''}`,
      `- Longueur: ${aiLength || ''}`,
      `- Instructions: ${aiInstructions || ''}`,
      '',
      'Ce que le gérant vient de dire à voix haute (transcription brute) :',
      transcript.trim(),
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const parsed = JSON.parse(content) as {
      aiTone?: string;
      aiLength?: string;
      aiInstructions?: string;
      aiSignature?: string;
    };

    const allowedTones = ['professional', 'warm', 'casual', 'luxury', 'humorous'] as const;
    const allowedLengths = ['concise', 'balanced', 'detailed'] as const;

    const nextTone =
      allowedTones.find((t) => t === parsed.aiTone) ??
      (allowedTones.find((t) => t === aiTone) ?? 'professional');
    const nextLength =
      allowedLengths.find((l) => l === parsed.aiLength) ??
      (allowedLengths.find((l) => l === aiLength) ?? 'balanced');
    const nextInstructions =
      typeof parsed.aiInstructions === 'string' && parsed.aiInstructions.trim()
        ? parsed.aiInstructions.trim()
        : (typeof aiInstructions === 'string' ? aiInstructions : '');
    const nextSignature =
      typeof parsed.aiSignature === 'string' ? parsed.aiSignature.trim() : (typeof body.aiSignature === 'string' ? body.aiSignature : '');

    return NextResponse.json({
      aiTone: nextTone,
      aiLength: nextLength,
      aiInstructions: nextInstructions,
      aiSignature: nextSignature,
    });
  } catch (error) {
    console.error('[ai/preferences/from-voice]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Voice preferences update failed' },
      { status: 500 },
    );
  }
}

