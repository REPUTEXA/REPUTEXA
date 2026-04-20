/**
 * Jetons acceptés pour POST /api/user/gdpr/delete-account (champ `confirm`).
 * Doit rester aligné avec `Dashboard.settings.gdprDeleteConfirmWord` dans chaque `messages/{locale}.json`.
 */
export const GDPR_DELETE_CONFIRM_TOKENS = [
  'SUPPRIMER',
  'DELETE',
  'LÖSCHEN',
  'LOESCHEN',
  'ELIMINAR',
  'ELIMINA',
  'EXCLUIR',
  '删除',
  '削除',
] as const;

export type GdprDeleteConfirmToken = (typeof GDPR_DELETE_CONFIRM_TOKENS)[number];

export function isValidGdprDeleteConfirm(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (GDPR_DELETE_CONFIRM_TOKENS as readonly string[]).includes(trimmed);
}
