import fs from "fs";

function parseCsvLine(line) {
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
  return parts.length === 3 ? parts[0] : null;
}

const lines = fs
  .readFileSync("targets/client-facing-priority1-ui.csv", "utf8")
  .split(/\r?\n/);
const set = new Set();
for (let li = 1; li < lines.length; li++) {
  const p = parseCsvLine(lines[li]);
  if (p) set.add(p.replace(/\\/g, "/"));
}
const arr = [...set].sort();
fs.writeFileSync("targets/p1-unique-files.txt", arr.join("\n"), "utf8");
console.log("unique files:", arr.length);
