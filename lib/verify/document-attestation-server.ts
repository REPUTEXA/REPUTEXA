import { createAdminClient } from '@/lib/supabase/admin';

/** UUID v4 (ex. `crypto.randomUUID()`). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDocumentAttestationUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export type DocumentAttestationRow = {
  id: string;
  content_sha256: string;
  issuer_legal_name: string;
  created_at: string;
};

export async function getDocumentAttestationById(
  id: string,
): Promise<DocumentAttestationRow | null> {
  if (!isDocumentAttestationUuid(id)) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from('document_attestations')
    .select('id, content_sha256, issuer_legal_name, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as DocumentAttestationRow;
}
