/**
 * Audit FR potentiellement visible dans les seuls fichiers listés dans p1-unique-files.txt
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const listPath = path.join(root, "targets/p1-unique-files.txt");
const files = fs
  .readFileSync(listPath, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)
  .map((p) => {
    const norm = p.replace(/\\/g, "/");
    const idx = norm.indexOf("/aaaempire-reputation-ai/");
    const rel =
      idx >= 0
        ? norm.slice(idx + "/aaaempire-reputation-ai/".length)
        : norm.replace(/^D:\/aaaempire-reputation-ai\//i, "");
    return path.join(root, rel.split("/").join(path.sep));
  });

const FR_ACCENT = /[àâäéèêëïîôùûçœæ]/i;
const STRING_LIT = /(['"`])[^'"`]{6,}\1/;
const HAS_T =
  /\b(t|getTranslations|useTranslations|createTranslator|ta\(|tp\(|namespace\s*:)\s*\(/;

const hits = [];
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith("//") || t.startsWith("*") || t.startsWith("import "))
      return;
    if (t.startsWith("/**") || t.startsWith("*") || t.startsWith("*/")) return;
    if (t.startsWith("{/*") || t.startsWith("//")) return;
    if (HAS_T.test(line)) return;
    if (line.includes("className=") && !line.includes("toast") && !line.includes("aria-"))
      return;
    if (FR_ACCENT.test(line) && STRING_LIT.test(line)) {
      hits.push({
        file: path.relative(root, file),
        line: i + 1,
        snippet: line.trim().slice(0, 160),
      });
    }
  });
}

console.log(JSON.stringify({ filesScanned: files.length, hits: hits.length }, null, 0));
fs.writeFileSync(
  path.join(root, "targets/p1-i18n-audit-hits.json"),
  JSON.stringify(hits, null, 2),
  "utf8"
);
for (const h of hits.slice(0, 80)) {
  console.log(`${h.file}:${h.line} ${h.snippet}`);
}
if (hits.length > 80) console.log(`… +${hits.length - 80} lines`);
