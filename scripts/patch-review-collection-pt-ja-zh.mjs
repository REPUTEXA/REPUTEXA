/**
 * pt / ja / zh ne passent pas par locale-partials/reviewCollection — aligne reviewCollection
 * (profils, ICU pour keyPlaceholder, exemples webhook, explainer).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const messagesDir = path.join(root, 'messages');

const PROFILES = {
  pt: {
    restaurant: { label: 'Restauração', example: 'Enviar ~45 min após a refeição' },
    bakery: { label: 'Pastelaria / padaria', example: 'Enviar ~2 h após a compra' },
    beauty: { label: 'Beleza e cuidados', example: 'Enviar ~3 h após o atendimento' },
    garage: { label: 'Oficina automóvel', example: 'Enviar ~24 h após a entrega do veículo' },
    hotel: { label: 'Hotelaria', example: 'Enviar ~2 h após o check-out' },
    artisan: { label: 'Ofícios / empreiteiro', example: 'Enviar ~4 h após fim do trabalho' },
    fast_service: { label: 'Serviço rápido / takeaway', example: 'Enviar ~20 min após a compra' },
    custom: { label: 'Personalizado (atraso livre)', example: 'Defina o atraso exato em minutos' },
    ecommerce: { label: 'Loja online *', example: 'Após entrega (scan do transportador)' },
  },
  ja: {
    restaurant: { label: '飲食店', example: '食事の約45分後に送信' },
    bakery: { label: 'ベーカリー・菓子', example: '購入から約2時間後に送信' },
    beauty: { label: '美容・ケア', example: '施術の約3時間後に送信' },
    garage: { label: '自動車整備', example: '車両引渡しから約24時間後に送信' },
    hotel: { label: '宿泊', example: 'チェックアウトから約2時間後に送信' },
    artisan: { label: '職人・請負', example: '作業終了から約4時間後に送信' },
    fast_service: { label: 'クイックサービス / テイクアウト', example: '購入から約20分後に送信' },
    custom: { label: 'カスタム（自由な遅延）', example: '遅延を分単位で指定' },
    ecommerce: { label: 'オンラインストア *', example: '配送完了（キャリアスキャン）後' },
  },
  zh: {
    restaurant: { label: '餐饮', example: '用餐后约45分钟发送' },
    bakery: { label: '烘焙 / 糕点', example: '购买后约2小时发送' },
    beauty: { label: '美容护理', example: '服务后约3小时发送' },
    garage: { label: '汽车维修', example: '交车后约24小时发送' },
    hotel: { label: '酒店住宿', example: '退房后约2小时发送' },
    artisan: { label: '工匠 / 承包商', example: '完工后约4小时发送' },
    fast_service: { label: '快取 / 外卖', example: '购买后约20分钟发送' },
    custom: { label: '自定义（自由延迟）', example: '自行设置分钟数' },
    ecommerce: { label: '网店 *', example: '派送扫描显示送达后' },
  },
};

const EXTRA = {
  pt: {
    keyPlaceholder: "'<sua-chave>'",
    legacyZenithTokenHint: "'<legacy-token>'",
    webhookPhysicalSampleLastPurchase: 'Tratamento de queratina',
    webhookEcommerceSampleLastPurchase: 'Encomenda n.º 4521',
    webhookExampleFirstName: 'Maria',
    webhookExamplePhone: '+351912345678',
    webhookEcommerceExampleStatus: 'Entregue',
    webhookEcommerceExampleTracking: 'PT123456789PT',
    webhookEcommerceExampleSource: 'Shopify / Stripe',
    webhookPhysicalPayloadExplainer:
      'Em loja física, este corpo do pedido substitui a entrada no terminal: a caixa envia nome, telefone e opcionalmente o rótulo da compra para personalizar o convite WhatsApp.',
    ecomCardLogisticsBody:
      'status dispara o envio quando a encomenda consta como entregue (ex.: Entregue, Delivered, Zugestellt…) — tracking_number opcional.',
  },
  ja: {
    keyPlaceholder: "'<APIキー>'",
    legacyZenithTokenHint: "'<legacy-token>'",
    webhookPhysicalSampleLastPurchase: 'ケラチン施術',
    webhookEcommerceSampleLastPurchase: '注文 #4521',
    webhookExampleFirstName: '美咲',
    webhookExamplePhone: '+819012345678',
    webhookEcommerceExampleStatus: '配達完了',
    webhookEcommerceExampleTracking: 'JP123456789JP',
    webhookEcommerceExampleSource: 'Shopify / Stripe',
    webhookPhysicalPayloadExplainer:
      '実店舗では、このリクエスト本文が端末での顧客入力に代わります。レジが名前・電話番号・任意で購入ラベルを送り、WhatsApp招待をパーソナライズします。',
    ecomCardLogisticsBody:
      'status は荷物が配達済みとみなされたときに送信を開始します（例：配達完了、Delivered、Zugestellt…）— tracking_number は任意。',
  },
  zh: {
    keyPlaceholder: "'<您的密钥>'",
    legacyZenithTokenHint: "'<legacy-token>'",
    webhookPhysicalSampleLastPurchase: '角蛋白护理',
    webhookEcommerceSampleLastPurchase: '订单 #4521',
    webhookExampleFirstName: '小丽',
    webhookExamplePhone: '+8613800138000',
    webhookEcommerceExampleStatus: '已送达',
    webhookEcommerceExampleTracking: 'CN123456789CN',
    webhookEcommerceExampleSource: 'Shopify / Stripe',
    webhookPhysicalPayloadExplainer:
      '实体店中，此请求体替代终端上的客户录入：收银台发送姓名、电话及可选的购买标签，以个性化 WhatsApp 邀请。',
    ecomCardLogisticsBody:
      'status 在包裹标记为已送达时触发发送（例如：已送达、Delivered、Zugestellt…）— tracking_number 可选。',
  },
};

const en = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf8'));
const legacyEndpoint = en.Dashboard.reviewCollection.legacyZenithEndpoint;

for (const loc of ['pt', 'ja', 'zh']) {
  const p = path.join(messagesDir, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const rc = j.Dashboard.reviewCollection;
  if (!rc) continue;
  rc.profiles = PROFILES[loc];
  rc.legacyZenithEndpoint = legacyEndpoint;
  Object.assign(rc, EXTRA[loc]);
  delete rc.webhookExamplePhysical;
  delete rc.webhookExampleEcommerce;
  fs.writeFileSync(p, JSON.stringify(j));
  console.log('patched reviewCollection', loc);
}
