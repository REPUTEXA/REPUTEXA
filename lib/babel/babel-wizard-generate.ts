import { readFile } from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import type { BabelWizardStepId } from '@/lib/babel/babel-wizard-types';
import { BABEL_MAJORDOME_PERSONA_FR, loadProductAiContextForBabel } from '@/lib/babel/babel-ai-prompt-context';

async function readRepo(rel: string): Promise<string> {
  const p = path.join(process.cwd(), rel);
  return readFile(p, 'utf8');
}

function excerptSignupFr(ts: string): string {
  const start = ts.indexOf('  fr: {');
  const end = ts.indexOf('\n  en: {', start);
  if (start === -1 || end === -1) return ts.slice(0, 8000);
  return ts.slice(start, end);
}

/**
 * Génère le contenu d’aperçu pour une étape (snippet TypeScript / JSON / texte).
 */
export async function generateWizardStepContent(params: {
  openai: OpenAI;
  stepId: Exclude<BabelWizardStepId, 'checkpoint' | 'messages' | 'authEmail' | 'warRoom' | 'emailsProduct' | 'done'>;
  localeCode: string;
  targetLabel: string;
}): Promise<{ content: string; notes?: string }> {
  const { openai, stepId, localeCode, targetLabel } = params;
  const model = process.env.BABEL_TRANSCREATE_MODEL?.trim() || 'gpt-4o-mini';
  const productCtx = await loadProductAiContextForBabel();
  const productCtxUserSuffix = productCtx
    ? `\n\n---\nContexte produit (product-ai-context.txt — terminologie / périmètre, ne pas inventer de features) :\n${productCtx.slice(0, 12_000)}`
    : '';

  if (stepId === 'catalog') {
    const file = await readRepo('lib/i18n/site-locales-catalog.ts');
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.25,
      max_completion_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: `Tu aides un développeur à ajouter la locale "${targetLabel}" (code ISO ${localeCode}) dans le catalogue Next.js.
Réponds en JSON uniquement : { "snippet": string, "notes": string }
- snippet : instructions + blocs de code TypeScript PRÊTS à coller : (1) ajouter '${localeCode}' dans le tableau SITE_LOCALE_CODES (montrer la ligne ou le tableau complet si plus clair), (2) ajouter l'entrée SITE_LOCALE_META pour ${localeCode} avec labelFr en français (admin) et gateCountryCode : code pays ISO2 si la locale doit être derrière la War Room, sinon null.
- notes : rappels (déploiement, ordre des clés).`,
        },
        {
          role: 'user',
          content: `Fichier actuel :\n\n${file.slice(0, 12000)}${productCtxUserSuffix}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
    const j = JSON.parse(raw) as { snippet?: string; notes?: string };
    return { content: j.snippet ?? raw, notes: j.notes };
  }

  if (stepId === 'serverPack') {
    const file = await readRepo('lib/emails/server-locale-message-pack.ts');
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.25,
      max_completion_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: `Tu aides à brancher messages/${localeCode}.json dans le pack serveur e-mails.
Réponds JSON : { "snippet": string, "notes": string }
- snippet : (1) ligne import ESM : import ${localeCode} from '@/messages/${localeCode}.json'; (2) ajout dans rawByLocale et type SiteLocaleCode si besoin — montre uniquement les lignes à ajouter/modifier, cohérents avec le fichier fourni.
- notes : rappeler que le fichier messages doit exister.`,
        },
        { role: 'user', content: `${file.slice(0, 12000)}${productCtxUserSuffix}` },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
    const j = JSON.parse(raw) as { snippet?: string; notes?: string };
    return { content: j.snippet ?? raw, notes: j.notes };
  }

  if (stepId === 'signup') {
    const signupFile = await readRepo('lib/i18n/signup-ui-by-locale.ts');
    const frExcerpt = excerptSignupFr(signupFile);
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.35,
      max_completion_tokens: 8192,
      messages: [
        {
          role: 'system',
          content: `${BABEL_MAJORDOME_PERSONA_FR}

Expert transcréation produit SaaS inscription pour "${targetLabel}" (${localeCode}).
Réponds JSON : { "snippet": string, "notes": string }
- snippet : UNIQUEMENT le bloc TypeScript à insérer dans l'objet BY : une clé ${localeCode}: { ... } avec TOUS les champs du type SignupUiCopy (mêmes clés que l'exemple français). Transcréation : noms/villes/enseignes/téléphones crédibles pour le marché. Guillemets échappés correctement.
- notes : rappeler d'insérer avant la fermeture de BY.`,
        },
        {
          role: 'user',
          content: `Exemple français (structure à reproduire) :\n\n${frExcerpt.slice(0, 14000)}${productCtxUserSuffix}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
    const j = JSON.parse(raw) as { snippet?: string; notes?: string };
    return { content: j.snippet ?? raw, notes: j.notes };
  }

  if (stepId === 'seo') {
    const layout = await readRepo('app/[locale]/layout.tsx');
    const seoStart = layout.indexOf('const SEO_CONFIG');
    const seoBit =
      seoStart === -1 ? layout.slice(0, 6000) : layout.slice(seoStart, seoStart + 4500);
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.35,
      max_completion_tokens: 2048,
      messages: [
        {
          role: 'system',
          content: `${BABEL_MAJORDOME_PERSONA_FR}

Tu ajoutes l'entrée SEO pour la locale ${localeCode} (${targetLabel}) dans SEO_CONFIG.
Réponds JSON : { "snippet": string, "notes": string }
- snippet : uniquement la paire clé/valeur pour ${localeCode}: { title, description } en langue cible, ton marketing B2B cohérent avec les exemples existants.
- notes : rappeler d'ajouter dans l'objet SEO_CONFIG.`,
        },
        { role: 'user', content: `${seoBit}${productCtxUserSuffix}` },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
    const j = JSON.parse(raw) as { snippet?: string; notes?: string };
    return { content: j.snippet ?? raw, notes: j.notes };
  }

  return { content: '', notes: 'Étape non gérée' };
}
