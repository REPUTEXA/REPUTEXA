/**
 * Test d'envoi d'alerte WhatsApp pour un avis négatif simulé.
 * Crée review + mapping dans Supabase pour que les réponses (texte/vocal) fonctionnent.
 *
 * Usage: npx tsx scripts/test-alert.ts
 *
 * Prérequis:
 * - .env.local : OPENAI_API_KEY, TWILIO_*, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - Un profil dans profiles avec whatsapp_phone OU le numéro sera celui de TO_PHONE
 * - Sandbox WhatsApp rejoint avec le code fourni par Twilio
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../lib/supabase/admin';
import { generateSuggestedResponse } from '../lib/whatsapp-alerts/generate-ai-response';
import { sendWhatsAppAlert } from '../lib/whatsapp-alerts/send-whatsapp-alert';

const TO_PHONE = '0625471015';
const REVIEW = {
  reviewerName: 'Client mécontent',
  rating: 1,
  comment:
    "C'est inadmissible, j'ai attendu 45 minutes pour une salade et personne ne s'est excusé.",
  establishmentName: 'Restaurant Test',
};

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = '33' + digits.slice(1);
  return digits;
}

async function main() {
  console.log('🧪 Test alerte WhatsApp - Avis 1 étoile simulé\n');
  console.log('Avis:', REVIEW.comment);
  console.log('→ Génération de la réponse IA...\n');

  const suggestedReply = await generateSuggestedResponse({
    comment: REVIEW.comment,
    rating: REVIEW.rating,
    establishmentName: REVIEW.establishmentName,
  });

  console.log('Réponse IA générée:', suggestedReply.slice(0, 80) + '...\n');

  const supabase = createAdminClient();
  let reviewId: string | undefined;

  if (supabase) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .maybeSingle();

    const userId = profile?.id;
    if (userId) {
      const { data: newReview, error } = await supabase
        .from('reviews')
        .insert({
          user_id: userId,
          reviewer_name: REVIEW.reviewerName,
          rating: REVIEW.rating,
          comment: REVIEW.comment,
          source: 'Autre',
          status: 'pending',
          ai_response: suggestedReply,
          whatsapp_sent: false,
        })
        .select('id')
        .single();

      if (!error && newReview?.id) {
        reviewId = newReview.id;
        console.log('→ Review créée en DB:', reviewId);
      }
    }
  }

  if (!reviewId) {
    reviewId = 'test-' + Date.now();
    console.log('→ Pas de Supabase, reviewId factice:', reviewId);
  }

  console.log('→ Envoi WhatsApp vers', TO_PHONE, '...\n');

  const result = await sendWhatsAppAlert({
    to: TO_PHONE,
    reviewId,
    reviewerName: REVIEW.reviewerName,
    rating: REVIEW.rating,
    comment: REVIEW.comment,
    suggestedReply,
    establishmentName: REVIEW.establishmentName,
  });

  if (result.success && supabase && reviewId && !reviewId.startsWith('test-')) {
    await supabase.from('reviews').update({ whatsapp_sent: true }).eq('id', reviewId);
    await supabase.from('whatsapp_outbound_mapping').insert({
      to_phone: normalizePhone(TO_PHONE),
      review_id: reviewId,
      twilio_message_sid: result.messageId ?? null,
    });
    console.log('→ Mapping créé pour les réponses texte/vocal');
  }

  if (result.success) {
    console.log('\n✅ Alerte envoyée ! Message SID:', result.messageId);
    console.log('   Répondez par texte ou vocal pour tester la modification.');
  } else {
    console.error('❌ Erreur:', result.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
