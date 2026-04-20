/**
 * Découpe targets/filtered-hardcode-app-lib-components.csv en listes ciblées « ce que le client voit ».
 *
 * P1 — Interface directe : chemins contenant \components\ ou \app\[locale]\
 * P2 — Erreurs API : chemins sous \app\api\ avec texte orienté message (heuristique)
 */
import fs from "fs";

const frChars = /[àâäéèêëïîôùûüçœæñÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆÑ]/;

const TECH_SINGLE_WORDS = new Set([
  "prisma",
  "delete",
  "stats",
  "table",
  "limit",
  "running",
  "object",
  "schedule",
  "priority",
  "improve",
  "translate",
  "error",
  "ready",
  "processing",
]);

function parseCsvLine(line) {
  if (!line?.trim()) return null;
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

/** P2 : message d’erreur plausible (pas log [tag] seul, pas liste SQL) */
function looksLikeApiErrorMessage(content) {
  const t = content.trim();
  if (/^\[[^\]]+\]\s*\w+$/.test(t) && !frChars.test(t)) return false;
  if (/^[a-z][a-z0-9_]*(?:,\s*[a-z][a-z0-9_]*)+$/i.test(t.replace(/\s/g, " ")))
    return false;
  if (frChars.test(t)) return true;
  if (/\s/.test(t) && /[a-zA-Z]{3,}/.test(t)) return true;
  const inner = t.replace(/^['"]|['"]$/g, "");
  if (/^[a-z]+$/i.test(inner) && TECH_SINGLE_WORDS.has(inner.toLowerCase()))
    return false;
  if (/^[A-Z][a-z]+$/.test(inner) && inner.length >= 5) return true;
  return false;
}

const srcPath = "targets/filtered-hardcode-app-lib-components.csv";
const text = fs.readFileSync(srcPath, "utf8");
const lines = text.split(/\r?\n/);
const header = lines[0];

const p1 = [header];
const p2 = [header];

for (let li = 1; li < lines.length; li++) {
  const row = parseCsvLine(lines[li]);
  if (!row) continue;
  const norm = row.path.replace(/\//g, "\\").toLowerCase();
  const lineOut = lines[li];

  if (norm.includes("\\components\\") || norm.includes("\\app\\[locale]\\")) {
    p1.push(lineOut);
  }

  if (norm.includes("\\app\\api\\") && looksLikeApiErrorMessage(row.content)) {
    p2.push(lineOut);
  }
}

fs.writeFileSync(
  "targets/client-facing-priority1-ui.csv",
  p1.join("\n"),
  "utf8"
);
fs.writeFileSync(
  "targets/client-facing-priority2-api-errors.csv",
  p2.join("\n"),
  "utf8"
);

console.error("P1 (components + app/[locale]):", p1.length - 1, "→ targets/client-facing-priority1-ui.csv");
console.error("P2 (app/api, error-like):", p2.length - 1, "→ targets/client-facing-priority2-api-errors.csv");
