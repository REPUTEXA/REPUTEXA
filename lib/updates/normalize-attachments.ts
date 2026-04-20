/** Parse les pièces jointes `app_updates.attachments` (JSON). Module sans "use client" pour les pages RSC. */

export type UpdateAttachment = { url: string; type: 'image' | 'video' };

export function normalizeAttachments(raw: unknown): UpdateAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: UpdateAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const url = String(rec.url ?? '').trim();
    const type = rec.type;
    if (type !== 'image' && type !== 'video') continue;
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({ url, type });
  }
  return out;
}
