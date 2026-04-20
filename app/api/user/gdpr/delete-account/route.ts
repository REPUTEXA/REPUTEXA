import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidGdprDeleteConfirm } from '@/lib/user/gdpr-delete-account-confirm';

/**
 * Suppression définitive du compte (Art. 17 RGPD).
 * Cascade côté base sur les tables liées à auth.users.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { confirm } = body as { confirm?: string };

  if (!isValidGdprDeleteConfirm(confirm)) {
    return apiJsonError(request, 'gdpr_deleteInvalidConfirmation', 400);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const admin = createAdminClient();
  if (!admin) {
    return apiJsonError(request, 'serverConfiguration', 500);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return apiJsonError(request, 'serverError', 500);
  }

  const t = createServerTranslator('Api', apiLocaleFromRequest(request));
  return NextResponse.json({ success: true, message: t('gdpr_accountDeleted') });
}
