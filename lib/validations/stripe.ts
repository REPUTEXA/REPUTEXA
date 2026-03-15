/**
 * Schémas Zod pour toutes les entrées API Stripe/Billing.
 * Aucun paramètre ne doit passer sans validation stricte.
 */

import { z } from 'zod';

const planSlugSchema = z.enum(['vision', 'pulse', 'zenith']);

/** Query params pour POST /api/stripe/create-checkout (tous les query sont des string) */
export const createCheckoutQuerySchema = z.object({
  locale: z.string().min(1).max(10).optional().default('fr'),
  planType: z.enum(['starter', 'manager', 'dominator']).optional(),
  planSlug: z
    .string()
    .optional()
    .transform((s) => (s && ['vision', 'pulse', 'zenith'].includes(s) ? s : 'pulse'))
    .pipe(planSlugSchema),
  skipTrial: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  annual: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  quantity: z
    .string()
    .optional()
    .transform((v) => Math.min(15, Math.max(1, parseInt(v ?? '1', 10) || 1))),
});

/** Query params pour GET /api/stripe/preview-expansion */
export const previewExpansionQuerySchema = z.object({
  expansionAddCount: z
    .string()
    .optional()
    .transform((v) => Math.min(15, Math.max(1, Math.floor(Number(v) || 0)))),
});

/** Body pour POST /api/stripe/create-bulk-expansion */
export const createBulkExpansionBodySchema = z.object({
  expansionAddCount: z.coerce.number().int().min(1).max(15),
});

/** Body pour POST /api/stripe/sync-profile */
export const syncProfileBodySchema = z.object({
  session_id: z.string().min(1).trim(),
});

export type CreateCheckoutQuery = z.infer<typeof createCheckoutQuerySchema>;
export type PreviewExpansionQuery = z.infer<typeof previewExpansionQuerySchema>;
export type CreateBulkExpansionBody = z.infer<typeof createBulkExpansionBodySchema>;
export type SyncProfileBody = z.infer<typeof syncProfileBodySchema>;

/** Construit un objet à partir de request.url searchParams pour parsing Zod */
export function getQueryFromRequest(request: Request): Record<string, string | undefined> {
  const { searchParams } = new URL(request.url);
  const out: Record<string, string | undefined> = {};
  searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
