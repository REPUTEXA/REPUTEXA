/** Représentation texte pour colonnes pgvector via PostgREST */
export function toVectorParam(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
