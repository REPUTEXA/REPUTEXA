import OpenAI from 'openai';

const MODEL = 'text-embedding-3-small';

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) throw new Error('OPENAI_API_KEY manquant');
  return new OpenAI({ apiKey: key });
}

export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim().slice(0, 12000);
  if (!trimmed) {
    return Array(1536).fill(0);
  }
  const openai = getClient();
  const res = await openai.embeddings.create({
    model: MODEL,
    input: trimmed,
  });
  const v = res.data[0]?.embedding;
  if (!v?.length) {
    throw new Error('Embedding invalide');
  }
  return v;
}
