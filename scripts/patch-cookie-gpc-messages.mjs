/**
 * Ajoute Compliance.cookieBanner(.Uk).gpcLine pour toutes les locales messages.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const LINE = {
  fr: "Signal Global Privacy Control (GPC) détecté dans ce navigateur : les traceurs non indispensables restent désactivés tant que vous ne choisissez pas autrement.",
  en: 'Global Privacy Control (GPC) is enabled in this browser: non-essential trackers stay off unless you choose otherwise.',
  es: 'Este navegador envía Global Privacy Control (GPC): los rastreadores no esenciales permanecen desactivados salvo que indique lo contrario.',
  de: 'Global Privacy Control (GPC) ist in diesem Browser aktiv: nicht notwendige Tracker bleiben aus, bis Sie anders entscheiden.',
  it: 'Global Privacy Control (GPC) risulta attivo nel browser: i tracciatori non necessari restano disattivati salvo diversa scelta.',
  pt: 'O navegador envia Global Privacy Control (GPC): rastreadores não essenciais permanecem desativados até decidir o contrário.',
  ja: 'このブラウザは Global Privacy Control (GPC) を送信しています。別途選択しない限り、非必須トラッカーはオフです。',
  zh: '此浏览器启用了 Global Privacy Control（GPC）：除非您另行选择，否则非必要跟踪将保持关闭。',
};

for (const loc of ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh']) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Compliance = j.Compliance || {};
  const line = LINE[loc] ?? LINE.en;
  j.Compliance.cookieBanner = { ...j.Compliance.cookieBanner, gpcLine: line };
  j.Compliance.cookieBannerUk = { ...j.Compliance.cookieBannerUk, gpcLine: line };
  fs.writeFileSync(p, JSON.stringify(j));
  console.log('patched gpcLine', loc);
}
