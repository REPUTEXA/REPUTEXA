export type Section = {
  heading?: string;
  lead?: string;
  paragraphs?: string[];
  bullets?: { text: string; sub?: string }[];
  callout?: { type: 'stat' | 'warning' | 'tip' | 'key'; text: string; label?: string };
  numbered?: { title: string; body: string }[];
};

export type Source = {
  label: string;
  url?: string;
  note?: string;
};

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  updatedDate?: string;
  readTime: string;
  category: string;
  author: string;
  editorial: string;
  intro: string;
  sections: Section[];
  conclusion: string;
  cta: string;
  sources: Source[];
  methodology?: string;
};
