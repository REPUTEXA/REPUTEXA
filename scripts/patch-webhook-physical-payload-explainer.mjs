import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES = path.join(__dirname, '..', 'messages');

const webhookPhysicalPayloadExplainer = {
  fr: "En commerce physique, ce corps de requête remplace la saisie côté client sur le terminal : la caisse transmet prénom, téléphone et éventuellement le libellé de l'achat pour personnaliser l'invite WhatsApp.",
  en: 'For physical retail, this JSON body replaces client-side entry on the terminal: the till sends first name, phone and optionally the purchase label to personalize the WhatsApp invite.',
  it: 'Per il punto vendita fisico, questo corpo della richiesta sostituisce l’inserimento lato client sul terminale: la cassa invia nome, telefono e opzionalmente l’etichetta d’acquisto per personalizzare l’invito WhatsApp.',
  es: 'En comercio físico, este cuerpo de petición sustituye la entrada del cliente en el terminal: la caja envía nombre, teléfono y opcionalmente la etiqueta de compra para personalizar la invitación por WhatsApp.',
  de: 'Im stationären Handel ersetzt dieser JSON-Body die Eingabe am Terminal: Die Kasse übermittelt Vorname, Telefon und optional den Kaufbelegtext für die personalisierte WhatsApp-Einladung.',
  pt: 'Em loja física, este corpo do pedido substitui a entrada no terminal: a caixa envia nome, telefone e opcionalmente o rótulo da compra para personalizar o convite WhatsApp.',
  ja: '実店舗では、このリクエスト本文が端末での顧客入力に代わります。レジが名前・電話番号・任意で購入ラベルを送り、WhatsApp招待をパーソナライズします。',
  zh: '实体店中，此请求体替代终端上的客户录入：收银台发送姓名、电话及可选的购买标签，以个性化 WhatsApp 邀请。',
};

for (const loc of Object.keys(webhookPhysicalPayloadExplainer)) {
  const p = path.join(MESSAGES, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.Dashboard.reviewCollection.webhookPhysicalPayloadExplainer =
    webhookPhysicalPayloadExplainer[loc];
  fs.writeFileSync(p, JSON.stringify(j) + '\n');
  console.log('webhookPhysicalPayloadExplainer', loc);
}
