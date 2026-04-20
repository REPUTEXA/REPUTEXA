import fs from "fs";

const text = fs.readFileSync("targets/full_hardcode_scan.csv", "utf8");
const lines = text.split(/\r?\n/);

/** Parse one CSV line with 3 quoted fields */
function parseCsvLine(line) {
  if (!line || line === '"Path","LineNumber","Content"') return null;
  const parts = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '"') return null;
    i++;
    let field = "";
    while (i < line.length) {
      if (line[i] === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        i++;
        break;
      }
      field += line[i];
      i++;
    }
    parts.push(field);
    if (i < line.length && line[i] === ",") i++;
  }
  if (parts.length !== 3) return null;
  return { path: parts[0], lineNumber: parts[1], content: parts[2] };
}

function inScope(p) {
  const norm = p.replace(/\//g, "\\").toLowerCase();
  if (norm.includes("\\messages\\")) return false;
  return (
    norm.includes("\\app\\") ||
    norm.includes("\\lib\\") ||
    norm.includes("\\components\\")
  );
}

// French characters in string
const frChars = /[àâäéèêëïîôùûüçœæñÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆÑ]/;

/** Inner string without surrounding quotes (as captured from source) */
const EXACT_SKIP = new Set([
  "use client",
  "use server",
  "undefined",
  "strict",
  "module",
  "object",
  "boolean",
  "string",
  "number",
  "bigint",
  "symbol",
  "function",
]);

/** Common English tokens in code/APIs — not product copy */
const EN_TECH_WORDS = new Set([
  "applied",
  "skipped",
  "failed",
  "success",
  "error",
  "pending",
  "processing",
  "ready",
  "unauthorized",
  "forbidden",
  "optional",
  "required",
  "standalone",
  "critical",
  "default",
  "enabled",
  "disabled",
  "active",
  "inactive",
  "public",
  "private",
  "internal",
  "external",
  "start",
  "continue",
  "cancel",
  "loading",
  "saving",
  "saved",
  "deleted",
  "updated",
  "created",
  "admin",
  "action",
  "actions",
  "status",
  "message",
  "messages",
  "catalog",
  "generate",
  "authorization",
  "sentinel",
]);

/** Noise: not user-facing FR/EN copy (Tailwind, SQL lists, log tags, etc.) */
function isNoiseString(inner) {
  if (!inner || inner.length < 2) return true;
  const t = inner.trim();
  if (EXACT_SKIP.has(t)) return true;
  if (!/\s/.test(t) && EN_TECH_WORDS.has(t.toLowerCase()) && !frChars.test(t))
    return true;
  // camelCase / PascalCase tokens (keys, components) — not natural language
  if (!/\s/.test(t) && /[a-z][A-Z]/.test(t)) return true;
  if (!/\s/.test(t) && /^[A-Z][a-z]+[A-Z]/.test(t)) return true;
  // Tailwind / utility class blobs (spaces + utility tokens)
  if (
    /\b(px-\d|py-\d|pt-\d|pb-\d|pl-\d|pr-\d|bg-|text-|font-|rounded|flex|grid|gap-|min-h-|items-|justify-|hover:|transition-|md:|sm:|lg:)\b/i.test(
      t
    ) &&
    !frChars.test(t)
  )
    return true;
  // SQL-ish: comma-separated snake_case identifiers
  if (/^[a-z][a-z0-9_]*(?:,\s*[a-z][a-z0-9_]*)+$/i.test(t.replace(/\s/g, " ")))
    return true;
  // Log-only: [scope] with no sentence after (optional trailing colon)
  if (/^\[[^\]]+\](?:\s+[A-Za-z]+)*:?\s*$/.test(t) && !frChars.test(t)) return true;
  // Path or URL fragment
  if (/^[/\\.][\w\-./]*$/.test(t)) return true;
  // env-style KEY only
  if (/^[A-Z][A-Z0-9_]+$/.test(t)) return true;
  return false;
}

/**
 * Natural FR/EN between quotes in scan "Content" cell:
 * - French diacritics anywhere, OR
 * - A quoted segment that looks like prose (words / phrase), excluding technical noise.
 */
function looksLikeFrOrEnQuoted(content) {
  if (frChars.test(content)) {
    // Still skip if the only FR is inside obvious noise (rare)
    return true;
  }

  const segRe = /(['"])((?:\\.|(?!\1)[^\\])*?)\1/g;
  let m;
  while ((m = segRe.exec(content)) !== null) {
    const inner = m[2];
    if (!inner) continue;
    if (isNoiseString(inner)) continue;
    // Single word: lowercase prose (≥5) or Title Case word (e.g. Dashboard) — not camelCase (handled above)
    if (!/\s/.test(inner)) {
      if (EN_TECH_WORDS.has(inner.toLowerCase())) continue;
      if (/^[a-zàâäéèêëïîôùûüç]{5,}$/i.test(inner) && !/[A-Z]/.test(inner)) return true;
      if (/^[A-Z][a-zàâäéèêëïîôùûüç]{3,}$/.test(inner)) return true;
    }
    // Phrase: space-separated words
    if (/\s/.test(inner) && /[a-zA-Zàâäéèêëïîôùûüç]{2,}/i.test(inner)) return true;
  }

  // Template fragments: word + space + word inside quotes (must not be technical noise)
  const tmplRe =
    /["']([a-zA-ZàâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆÑ][^"']*\s+[^"']*[a-zA-Zàâäéèêëïîôùûüç])["']/g;
  let tm;
  while ((tm = tmplRe.exec(content)) !== null) {
    if (!isNoiseString(tm[1])) return true;
  }

  return false;
}

const out = ['"Path","LineNumber","Content"'];
let total = 0;
for (let li = 1; li < lines.length; li++) {
  const line = lines[li];
  if (!line.trim()) continue;
  const row = parseCsvLine(line);
  if (!row) continue;
  if (!inScope(row.path)) continue;
  if (!looksLikeFrOrEnQuoted(row.content)) continue;
  out.push(line);
  total++;
}

const outText = out.join("\n");
fs.writeFileSync("targets/filtered-hardcode-app-lib-components.csv", outText, "utf8");
console.error("Matched lines:", total);
console.error("Written: targets/filtered-hardcode-app-lib-components.csv");
