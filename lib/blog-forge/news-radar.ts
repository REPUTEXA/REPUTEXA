/**
 * Agrégation d’titres RSS récents (actualité) — pas de scraping payant requis.
 */

const RSS_FEEDS = [
  { url: 'https://www.journaldunet.com/rss/', label: 'Journal du Net' },
  { url: 'https://www.usine-digitale.fr/rss/all.xml', label: 'Usine Digitale' },
  { url: 'https://www.maddyness.com/feed/', label: 'Maddyness' },
  { url: 'https://searchengineland.com/feed', label: 'Search Engine Land' },
  { url: 'https://www.lesechos.fr/rss/rss_tech.xml', label: 'Les Echos Tech' },
  { url: 'https://siecledigital.fr/feed/', label: 'Siècle Digital' },
  { url: 'https://www.01net.com/rss/news/', label: '01net' },
];

export async function fetchNewsRadarHeadlines(): Promise<string[]> {
  const headlines: string[] = [];
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  await Promise.allSettled(
    RSS_FEEDS.map(async ({ url, label }) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'REPUTEXA-BlogForge/1.0' },
        });
        clearTimeout(timeout);

        if (!res.ok) return;

        const xml = await res.text();

        const cdataMatches = Array.from(xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g));
        const plainMatches = Array.from(xml.matchAll(/<title>(.*?)<\/title>/g));
        const matches = cdataMatches.length > 1 ? cdataMatches.slice(1) : plainMatches.slice(1);

        const pubDates = Array.from(xml.matchAll(/<pubDate>(.*?)<\/pubDate>/g)).map((m) => m[1]);

        for (let i = 0; i < Math.min(matches.length, 8); i++) {
          const title = matches[i][1]
            .trim()
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");

          let isRecent = true;
          if (pubDates[i]) {
            const pubDate = new Date(pubDates[i]);
            if (!isNaN(pubDate.getTime())) {
              isRecent = pubDate >= oneWeekAgo;
            }
          }

          if (isRecent && title.length > 10 && title.length < 200) {
            headlines.push(`[${label}] ${title}`);
          }
        }
      } catch {
        /* feed indisponible */
      }
    })
  );

  return Array.from(new Set(headlines)).slice(0, 25);
}
