import type { SupabaseClient } from '@supabase/supabase-js';

export type AutomationRelanceRulesEnabled = {
  lost_client: boolean;
  birthday: boolean;
  vip_of_month: boolean;
  new_client_welcome: boolean;
};

export type AutomationRelanceSendsMonth = {
  lost_client: number;
  birthday: number;
  vip_of_month: number;
  new_client_welcome: number;
};

function parseEnabled(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === 't' || s === '1' || s === 'yes';
  }
  return false;
}

/**
 * Règles d’automatisation WhatsApp actives + volume d’envois réussis sur une fenêtre temporelle.
 */
export async function fetchAutomationRelanceSnapshotForRange(
  supabase: SupabaseClient,
  userId: string,
  range: { fromIso: string; toExclusiveIso: string }
): Promise<{
  rulesEnabled: AutomationRelanceRulesEnabled;
  sendsMonth: AutomationRelanceSendsMonth;
}> {
  const rulesEnabled: AutomationRelanceRulesEnabled = {
    lost_client: false,
    birthday: false,
    vip_of_month: false,
    new_client_welcome: false,
  };

  const { data: rules } = await supabase
    .from('banano_loyalty_automation_rules')
    .select('rule_type, enabled')
    .eq('user_id', userId);

  for (const raw of rules ?? []) {
    const r = raw as { rule_type?: string; enabled?: unknown };
    const t = String(r.rule_type ?? '');
    if (t === 'lost_client' && parseEnabled(r.enabled)) rulesEnabled.lost_client = true;
    if (t === 'birthday' && parseEnabled(r.enabled)) rulesEnabled.birthday = true;
    if (t === 'vip_of_month' && parseEnabled(r.enabled)) rulesEnabled.vip_of_month = true;
    if (t === 'new_client_welcome' && parseEnabled(r.enabled)) rulesEnabled.new_client_welcome = true;
  }

  const countRule = async (ruleType: string): Promise<number> => {
    const { count, error } = await supabase
      .from('banano_loyalty_automation_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('rule_type', ruleType)
      .eq('status', 'sent')
      .gte('created_at', range.fromIso)
      .lt('created_at', range.toExclusiveIso);
    if (error) {
      console.warn('[automation-relance-snapshot]', ruleType, error.message);
      return 0;
    }
    return count ?? 0;
  };

  const [lost_client, birthday, vip_of_month, new_client_welcome] = await Promise.all([
    countRule('lost_client'),
    countRule('birthday'),
    countRule('vip_of_month'),
    countRule('new_client_welcome'),
  ]);

  return {
    rulesEnabled,
    sendsMonth: {
      lost_client,
      birthday,
      vip_of_month,
      new_client_welcome,
    },
  };
}
