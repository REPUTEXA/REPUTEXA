/**
 * Recherche web pour le Guardian (clé serveur TAVILY_API_KEY).
 * https://docs.tavily.com
 */

export type TavilySearchResult = { title: string; url: string; content: string };

export async function tavilySearch(query: string, maxResults = 5): Promise<TavilySearchResult[]> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return [];

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: 'advanced',
        max_results: maxResults,
        include_answer: false,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    const rows = data.results ?? [];
    return rows
      .map((r) => ({
        title: String(r.title ?? ''),
        url: String(r.url ?? ''),
        content: String(r.content ?? ''),
      }))
      .filter((r) => r.url.length > 0);
  } catch {
    return [];
  }
}

export function digestTavilyResults(results: TavilySearchResult[]): string {
  if (!results.length) return '(Aucun résultat recherche — vérifiez TAVILY_API_KEY.)';
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 1200)}`)
    .join('\n\n---\n\n');
}
