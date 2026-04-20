import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ memberId: string }> };

type PatchBody = {
  crmRole?: 'customer' | 'staff';
  receivesStaffAllowance?: boolean;
};

export async function PATCH(req: Request, ctx: Ctx) {
  const { memberId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  if (!memberId) {
    return apiJsonError(req, 'errors.crm_memberInvalid', 400);
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const patch: Record<string, string | boolean> = {};
  if (body.crmRole !== undefined) {
    if (body.crmRole !== 'customer' && body.crmRole !== 'staff') {
      return apiJsonError(req, 'errors.crm_invalidCrmRole', 400);
    }
    patch.crm_role = body.crmRole;
  }
  if (typeof body.receivesStaffAllowance === 'boolean') {
    patch.receives_staff_allowance = body.receivesStaffAllowance;
  }

  if (Object.keys(patch).length === 0) {
    return apiJsonError(req, 'errors.crm_noFieldsToUpdate', 400);
  }

  const { data: row, error } = await supabase
    .from('banano_loyalty_members')
    .update(patch)
    .eq('id', memberId)
    .eq('user_id', user.id)
    .select('id, crm_role, receives_staff_allowance, display_name, phone_e164, first_name, last_name')
    .maybeSingle();

  if (error) {
    console.error('[banano/crm/members PATCH]', error.message);
    return apiJsonError(req, 'errors.replyUpdateFailed', 500);
  }
  if (!row) {
    return apiJsonError(req, 'errors.crm_memberNotFound', 404);
  }

  return NextResponse.json({ ok: true, member: row });
}
