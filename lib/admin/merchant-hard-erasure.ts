import type { SupabaseClient } from '@supabase/supabase-js';

export const MERCHANT_ERASURE_CONFIRM = 'EFFACER DEFINITIVEMENT';

export type MerchantErasureResult = {
  ok: true;
  targetUserId: string;
  stripeSubscriptionCancelled: boolean;
  notes: string[];
};

/**
 * Droit à l’oubli marchand (Art. 17 RGPD — traitement côté REPUTEXA).
 * Supprime le compte Auth : CASCADE sur public.* liées à auth.users / profiles.
 * Stripe : tentative d’annulation d’abonnement si configuré (facturation / obligations légales chez Stripe : traitement manuel complémentaire possible).
 * Resend / logs tiers : pas d’API d’effacement universelle — noter en conformité_logs.
 */
export async function executeMerchantHardErasure(
  admin: SupabaseClient,
  params: { targetUserId: string; actorAdminId: string; confirmPhrase: string }
): Promise<MerchantErasureResult> {
  const { targetUserId, actorAdminId, confirmPhrase } = params;
  if (confirmPhrase.trim().toUpperCase() !== MERCHANT_ERASURE_CONFIRM) {
    throw new Error('CONFIRMATION_INVALIDE');
  }
  if (targetUserId === actorAdminId) {
    throw new Error('AUTO_SUPPRESSION_INTERDITE');
  }

  const { data: targetProfile, error: tpErr } = await admin
    .from('profiles')
    .select('role, stripe_customer_id, stripe_subscription_id')
    .eq('id', targetUserId)
    .maybeSingle();

  if (tpErr) {
    console.error('[merchant-hard-erasure] profile', tpErr);
    throw new Error('PROFILE_READ_FAILED');
  }
  if (!targetProfile) {
    throw new Error('PROFILE_NOT_FOUND');
  }
  if (targetProfile.role === 'admin') {
    throw new Error('SUPPRESSION_ADMIN_INTERDITE');
  }

  const notes: string[] = [
    'Traces applicatives Supabase (auth + public) supprimées en cascade si schéma à jour.',
    'Vérifier manuellement : dossier Stripe (facturation), journaux Resend, sauvegardes externes, support tickets.',
  ];

  let stripeSubscriptionCancelled = false;
  const subId =
    typeof targetProfile.stripe_subscription_id === 'string'
      ? targetProfile.stripe_subscription_id.trim()
      : '';
  const secret = process.env.STRIPE_SECRET_KEY;

  if (secret && subId) {
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(secret);
      await stripe.subscriptions.cancel(subId);
      stripeSubscriptionCancelled = true;
      notes.push('Abonnement Stripe annulé automatiquement (subscription id présent).');
    } catch (e) {
      console.warn('[merchant-hard-erasure] stripe cancel', e);
      notes.push(
        'Échec ou skip annulation Stripe automatique — traiter dans le dashboard Stripe si nécessaire.'
      );
    }
  } else {
    notes.push('Pas d’annulation Stripe auto (clé ou subscription absente).');
  }

  await admin.from('legal_compliance_logs').insert({
    event_type: 'ai_audit',
    message: `Effacement marchand RGPD (Art. 17) — cible ${targetUserId}, opérateur ${actorAdminId}`,
    metadata: {
      kind: 'merchant_hard_erasure',
      targetUserId,
      actorAdminId,
      stripe_subscription_cancel_attempted: !!subId && !!secret,
      stripe_subscription_cancelled: stripeSubscriptionCancelled,
    },
    legal_version: null,
  });

  const { error: delErr } = await admin.auth.admin.deleteUser(targetUserId);
  if (delErr) {
    throw new Error(delErr.message || 'AUTH_DELETE_FAILED');
  }

  return {
    ok: true,
    targetUserId,
    stripeSubscriptionCancelled,
    notes,
  };
}
