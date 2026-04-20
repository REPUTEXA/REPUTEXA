import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { approveWeekPost, getDraftForWeek } from '@/lib/blog-forge/db';
import { mondayUtcISODate } from '@/lib/blog-forge/week';

function unauthorized() {
  const t = apiAdminT();
  return NextResponse.json({ error: t('unauthorized') }, { status: 401 });
}

export async function GET(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) return unauthorized();

  const week = mondayUtcISODate();
  const row = await getDraftForWeek(week);
  return NextResponse.json({ weekMonday: week, row });
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.ADMIN_SECRET) return unauthorized();

  const ta = apiAdminT();
  let body: { action?: string; weekMonday?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  if (body.action === 'approve') {
    const wm = body.weekMonday ?? mondayUtcISODate();
    const ok = await approveWeekPost(wm);
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: ta('payloadInvalid') }, { status: 400 });
}
