# Typographie REPUTEXA — instructions pour ChatGPT et Claude

Ce fichier sert à **copier-coller** la même règle que `.cursor/rules/strict-typography-hyphens.mdc` dans :

- **ChatGPT** : Réglages → Personnalisation → Instructions personnalisées (ou équivalent selon la version).
- **Claude** : Projet → Instructions du projet (Project instructions).

Les prompts **dans le code** (API OpenAI / Anthropic) incluent déjà une charte proche via `lib/ai/human-keyboard-output.ts` (`HUMAN_KEYBOARD_CHARTER_SNIPPET`). Ce document aligne vos assistants **conversationnels** sur le même standard.

---

## Bloc à coller (anglais — recommandé pour les deux produits)

```
STRICT TYPOGRAPHY RULE:
Do NOT use em-dashes (—) or en-dashes (–) under any circumstances.
Use ONLY the standard hyphen (-) for lists, separators, and punctuation.
This applies to both code comments and UI text.

Wrong examples (never write like this): "Phrase A — phrase B"; ranges like "10–15" or "2020–2024" with long dashes.
Use commas, periods, parentheses, or ASCII hyphen for numeric ranges (e.g. 10-15).
```

---

## Bloc équivalent (français)

```
RÈGLE TYPOGRAPHIE STRICTE :
N'utilise jamais le tiret cadratin (—) ni le demi-cadratin (–).
Utilise UNIQUEMENT le tiret d'union ASCII (-) pour les listes, séparateurs et ponctuation.
S'applique aux commentaires de code et au texte interface.

Contre-exemples interdits : « Phrase A — phrase B » ; plages du type « 10–15 » ou « 2020–2024 » avec tirets longs.
Préfère virgules, points, parenthèses, ou tiret ASCII pour les plages numériques (ex. 10-15).
```

---

## Référence code (génération serveur)

Post-traitement et extraits de charte injectés dans les prompts : `lib/ai/human-keyboard-output.ts` (`scrubAiTypography`, `HUMAN_KEYBOARD_CHARTER_SNIPPET`).
