import fs from "fs";

const lines = fs
  .readFileSync("targets/client-facing-priority1-ui.csv", "utf8")
  .split(/\r?\n/);
const out = [lines[0]];
for (let i = 1; i < lines.length; i++) {
  if (lines[i].includes("components\\dashboard\\")) out.push(lines[i]);
}
fs.writeFileSync("targets/p1-components-dashboard-only.csv", out.join("\n"), "utf8");
console.error("rows:", out.length - 1);
