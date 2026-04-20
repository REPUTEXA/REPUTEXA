import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { resolveGhostAgentMerchantId } from '@/lib/banano/ghost-auth';
import {
  executeBananoLoyaltyTransact,
  type BananoLoyaltyTransactBody,
} from '@/lib/banano/loyalty-transact-execute';

/**
 * POST — Même contrat que `/api/banano/loyalty/transact`, authentifié par jeton Agent Ghost.
 */
export async function POST(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const admin = createAdminClient();
  if (!admin) {
    return apiJsonError(req, 'serviceUnavailable', 503);
  }

  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const merchantId = await resolveGhostAgentMerchantId(admin, bearer);
  if (!merchantId) {
    return NextResponse.json({ error: tm('ghostAgentTokenInvalid') }, { status: 401 });
  }

  let body: BananoLoyaltyTransactBody;
  try {
    body = (await req.json()) as BananoLoyaltyTransactBody;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const result = await executeBananoLoyaltyTransact(admin, merchantId, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (body.kind === 'earn_visit') {
    const cents =
      body.ticketAmountCents != null ? Math.floor(Number(body.ticketAmountCents)) : null;
    void admin.from('banano_ghost_audit_events').insert({
      user_id: merchantId,
      member_id: body.memberId,
      action: 'transact_earn',
      ticket_total_cents: Number.isFinite(cents ?? NaN) ? cents : null,
      payload: {
        idempotencyKey: body.idempotencyKey ?? null,
        ticketItemsCount: body.ticketItemsCount ?? null,
      },
    });
  }

  if (body.kind === 'staff_usage' && result.body.staffUsage) {
    const su = result.body.staffUsage;
    void admin.from('banano_ghost_audit_events').insert({
      user_id: merchantId,
      member_id: body.memberId,
      action: 'transact_staff_usage',
      ticket_total_cents: su.debitEuroCents,
      payload: {
        idempotencyKey: body.idempotencyKey ?? null,
        staffUsageMode: body.staffUsageMode ?? 'require_full_ticket',
        remainingEuroCentsAfter: su.remainingEuroCentsAfter,
      },
    });
  }

  return NextResponse.json(result.body);
}
