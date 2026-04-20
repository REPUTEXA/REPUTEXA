import { NextRequest, NextResponse } from 'next/server';
import { checkTunnelDemoRateLimit } from '@/lib/rate-limit';
import {
  generateWhatsAppTunnelDemo,
  getTunnelDemoStaticPayload,
  normalizeTunnelDemoLocale,
  parseTunnelScenarioKind,
} from '@/lib/landing/whatsapp-tunnel-demo-ai';

export const dynamic = 'force-dynamic';

function demoLocale(raw: string | null): string {
  return normalizeTunnelDemoLocale(raw ?? 'en');
}

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

/** Évite un chargement infini si OpenAI/Anthropic ne répondent pas (F5, réseau lent, etc.). */
const GENERATION_BUDGET_MS = 22_000;

function withBudget<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('whatsapp-tunnel-demo-timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const locale = demoLocale(url.searchParams.get('locale'));
  const kind = parseTunnelScenarioKind(url.searchParams.get('kind'));

  try {
    const limited = checkTunnelDemoRateLimit(request);
    if (!limited.ok) {
      return NextResponse.json(getTunnelDemoStaticPayload(locale, kind), { headers: NO_STORE });
    }

    const payload = await withBudget(generateWhatsAppTunnelDemo(locale, kind), GENERATION_BUDGET_MS);
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg !== 'whatsapp-tunnel-demo-timeout') {
      console.error('[whatsapp-tunnel-demo] route', e);
    }
    return NextResponse.json(getTunnelDemoStaticPayload(locale, kind), { headers: NO_STORE });
  }
}
