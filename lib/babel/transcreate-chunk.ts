import OpenAI from 'openai';
import { getCulturalManifestForLocale } from '@/lib/babel/babel-cultural-manifests';
import { BABEL_MAJORDOME_PERSONA_FR, loadProductAiContextForBabel } from '@/lib/babel/babel-ai-prompt-context';
import { formatGlossaryForPrompt } from '@/lib/babel/babel-native-glossary';

/**
 * Parse une réponse modèle : JSON strict, ou bloc ```json```, ou premier objet `{…}`.
 */
function parseJsonObjectRobust(raw: string, label: string): Record<string, unknown> {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    throw new Error(`${label} : réponse vide`);
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      try {
        return JSON.parse(fence[1].trim()) as Record<string, unknown>;
      } catch {
        /* suite */
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        /* suite */
      }
    }
  }
  throw new Error(`${label} : JSON invalide`);
}

function getBabelMaxCompletionTokens(): number {
  return Math.min(
    32_768,
    Math.max(4_096, Number(process.env.BABEL_MAX_COMPLETION_TOKENS?.trim()) || 16_384)
  );
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(patch)) {
    const bv = patch[k];
    const av = out[k];
    if (
      bv != null &&
      typeof bv === 'object' &&
      !Array.isArray(bv) &&
      av != null &&
      typeof av === 'object' &&
      !Array.isArray(av)
    ) {
      out[k] = deepMerge(av as Record<string, unknown>, bv as Record<string, unknown>);
    } else {
      out[k] = bv;
    }
  }
  return out;
}

function isNativeCritiqueEnabled(): boolean {
  const v = process.env.BABEL_NATIVE_CRITIQUE_ENABLED?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no') return false;
  return true;
}

/**
 * Deuxième passe : auto-critique « robot vs natif » avant validation du JSON fusionné.
 */
async function nativeSelfCritiquePolish(params: {
  openai: OpenAI;
  model: string;
  targetLocaleCode: string;
  targetLabel: string;
  keys: string[];
  draft: Record<string, unknown>;
  productContextBlock: string;
  glossaryBlock: string;
  culturalManifestBlock: string;
}): Promise<Record<string, unknown>> {
  const {
    openai,
    model,
    targetLocaleCode,
    targetLabel,
    keys,
    draft,
    productContextBlock,
    glossaryBlock,
    culturalManifestBlock,
  } = params;

  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    temperature: 0.22,
    max_completion_tokens: getBabelMaxCompletionTokens(),
    messages: [
      {
        role: 'system',
        content: `${BABEL_MAJORDOME_PERSONA_FR}

Tu es également éditeur linguistique senior pour la locale "${targetLabel}" (${targetLocaleCode}).

Tâche : relecture uniquement. Le JSON d’entrée est déjà structuré : tu dois le POLIR pour qu’il sonne indiscutablement natif.

Auto-critique obligatoire pour chaque chaîne visible : pose-toi la question « Est-ce que cette phrase sonne comme un robot ou comme un humain natif ? » — si elle sonne robot ou calquée, réécris-la.

Règles strictes :
- Conserver EXACTEMENT la même structure JSON : mêmes clés à tous les niveaux, mêmes types.
- Ne pas ajouter ni supprimer de clés.
- Répondre UNIQUEMENT avec un objet JSON valide (pas de markdown).
- Respecter le glossaire ci-dessous quand le sens correspond à un concept listé.
- Appliquer intégralement le manifeste culturel (noms, villes, ton) — aucune entorse.

Glossaire préférentiel :
${glossaryBlock}

Manifeste culturel (obligatoire) :
${culturalManifestBlock || '(non défini pour cette locale — rester naturel.)'}`,
      },
      {
        role: 'user',
        content: `Contexte produit (référence terminologique, ne pas copier tel quel) :\n${productContextBlock || '(non disponible)'}

---

${culturalManifestBlock ? `Rappel manifeste culturel :\n${culturalManifestBlock}\n\n---\n\n` : ''}JSON à peaufiner (clés racine : ${keys.join(', ')}) :

${JSON.stringify(draft)}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
  return parseJsonObjectRobust(raw, 'Auto-critique');
}

/**
 * Transcrée un sous-arbre des messages (même forme de clés) pour une locale cible.
 * Pipeline Native-Perfect : contexte produit + persona + glossaire → transcréation → auto-critique (optionnelle).
 */
export async function transcreateMessageChunk(params: {
  openai: OpenAI;
  targetLocaleCode: string;
  targetLabel: string;
  chunk: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const { openai, targetLocaleCode, targetLabel, chunk } = params;
  const keys = Object.keys(chunk);
  if (keys.length === 0) return {};

  const model = process.env.BABEL_TRANSCREATE_MODEL?.trim() || 'gpt-4o-mini';
  const productContext = await loadProductAiContextForBabel();
  const glossaryBlock = formatGlossaryForPrompt(targetLocaleCode);
  const culturalManifestBlock = getCulturalManifestForLocale(targetLocaleCode);

  const productContextBlock =
    productContext.length > 0
      ? productContext
      : '(Fichier product-ai-context non trouvé — s’appuyer sur le glossaire et le bon sens marché.)';

  const systemContent = `${BABEL_MAJORDOME_PERSONA_FR}

Tu es expert en localisation produit SaaS B2B pour la locale "${targetLabel}" (code ISO ${targetLocaleCode}).

Règles strictes :
- TRANSCRÉATION, pas traduction littérale : ton naturel du marché cible, registre premium cohérent avec un outil pour établissements CHR.
- Dans les textes d’exemple / placeholders : prénoms, noms d’enseigne, villes, formats téléphone/code postal crédibles pour ce pays.
- Conserver EXACTEMENT la même structure JSON : mêmes clés à tous les niveaux, mêmes types (string reste string, objet reste objet, tableau reste tableau).
- Ne pas ajouter ni supprimer de clés.
- Répondre UNIQUEMENT avec un objet JSON valide (pas de markdown).
- Pour les concepts proches des entrées ci-dessous, privilégier ces formulations (adaptées au contexte de phrase).
- Manifeste culturel : appliquer à 100 % (noms fictifs, villes, ton, formats locaux) — non négociable.

Glossaire préférentiel :
${glossaryBlock}

Manifeste culturel (obligatoire pour cette locale) :
${culturalManifestBlock || '(Aucun manifeste spécifique — rester premium CHR et idiomatique.)'}`;

  const userContent = `Guide terminologique & périmètre produit (contexte factuel — ne pas inventer de fonctionnalités absentes ; t’informer sur le ton et le vocabulaire domaine) :

${productContextBlock}

---

${culturalManifestBlock ? `Manifeste culturel — rappel :\n${culturalManifestBlock}\n\n---\n\n` : ''}Transcrée ce fragment de fichier de traduction (source française, clés racine : ${keys.join(', ')}) :

${JSON.stringify(chunk)}`;

  let parsed: Record<string, unknown> | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      temperature: attempt === 1 ? 0.32 : 0.12,
      max_completion_tokens: getBabelMaxCompletionTokens(),
      messages: [
        {
          role: 'system',
          content:
            attempt === 1
              ? systemContent
              : `${systemContent}\n\nIMPORTANT : ta réponse précédente n’a pas pu être parsée. Réponds à nouveau avec UN SEUL objet JSON complet, valide, sans texte hors JSON.`,
        },
        { role: 'user', content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}';
    try {
      parsed = parseJsonObjectRobust(raw, 'Réponse IA');
      break;
    } catch (e) {
      if (attempt === 2) throw e;
      console.warn('[babel] JSON 1re passe invalide, nouvel essai…', e);
    }
  }

  if (!parsed) {
    throw new Error('[babel] Réponse IA sans JSON exploitable après deux tentatives.');
  }

  for (const k of keys) {
    if (!(k in parsed)) {
      throw new Error(`Clé manquante dans la réponse IA : ${k}`);
    }
  }

  if (!isNativeCritiqueEnabled()) {
    return parsed;
  }

  try {
    const polished = await nativeSelfCritiquePolish({
      openai,
      model,
      targetLocaleCode,
      targetLabel,
      keys,
      draft: parsed,
      productContextBlock,
      glossaryBlock,
      culturalManifestBlock,
    });
    for (const k of keys) {
      if (!(k in polished)) {
        throw new Error(`Auto-critique : clé manquante ${k}`);
      }
    }
    return polished;
  } catch (e) {
    console.warn('[babel] Auto-critique native ignorée (repli sur 1re passe) :', e);
    return parsed;
  }
}

export function mergeDraftMessages(
  current: Record<string, unknown>,
  newPart: Record<string, unknown>
): Record<string, unknown> {
  return deepMerge(current, newPart);
}
