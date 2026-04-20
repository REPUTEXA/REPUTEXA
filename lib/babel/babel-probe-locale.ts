/**
 * Teste si la racine locale répond (dev local ou URL explicite).
 * BABEL_SELF_ORIGIN ex. http://127.0.0.1:3000
 */
export async function probeLocaleHomepage(locale: string): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
  url?: string;
}> {
  const raw = process.env.BABEL_SELF_ORIGIN?.trim();
  const base = raw && /^https?:\/\//i.test(raw) ? raw : 'http://127.0.0.1:3000';
  try {
    const u = new URL(base);
    const url = `${u.origin}/${locale.replace(/^\//, '')}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    const r = await fetch(url, { redirect: 'follow', signal: ac.signal });
    clearTimeout(t);
    return { ok: r.ok, status: r.status, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
