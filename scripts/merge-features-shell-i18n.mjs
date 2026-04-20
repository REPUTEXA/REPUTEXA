/**
 * Features page: metrics strip, plan cards, CTA (matrix rows stay in TS until full JSON export).
 * Run: node scripts/merge-features-shell-i18n.mjs && node scripts/sync-all-locale-messages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'messages');

function deepAssign(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] =
        target[k] && typeof target[k] === 'object' && !Array.isArray(target[k]) ? target[k] : {};
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

const shellFR = {
  metrics: [
    { value: 'Claude 3.5', label: 'Modèle IA principal', sub: '+ GPT-4o-mini fallback' },
    { value: '3', label: 'Plateformes connectées', sub: 'Google · Facebook · Trustpilot' },
    { value: '30 min', label: 'AI Capture délai', sub: 'Après visite client (ZENITH)' },
    { value: '3 variantes', label: 'Triple Juge IA', sub: 'Empathie · Storytelling · Expertise (PULSE+)' },
  ],
  plansOverview: [
    {
      plan: 'VISION',
      price: '59€',
      color: 'border-gray-600/40',
      badge: 'bg-gray-500/20 text-gray-300',
      features: ['IA Claude (langue locale)', 'Rapport PDF mensuel', 'Shield Center (détection)'],
    },
    {
      plan: 'PULSE',
      price: '97€',
      color: 'border-[#2563eb]/40 bg-[#2563eb]/5',
      badge: 'bg-[#2563eb]/20 text-[#2563eb]',
      features: [
        '+ Multilingue + Triple Juge',
        '+ Alertes WhatsApp',
        '+ Shield complet (contestation)',
        '+ Résumé hebdo WhatsApp',
      ],
    },
    {
      plan: 'ZENITH',
      price: '179€',
      color: 'border-violet-500/40 bg-violet-500/5',
      badge: 'bg-violet-500/20 text-violet-400',
      features: [
        '+ AI Capture (visites → avis)',
        '+ Connecteur POS (Square, SumUp)',
        '+ Boost SEO (mots-clés)',
        '+ Consultant Stratégique IA 24/7',
      ],
    },
  ],
  perMonth: '/mois',
  ctaTitle: 'Toutes ces fonctionnalités, dès l’essai gratuit',
  ctaBody:
    '14 jours avec accès complet au plan ZENITH — sans carte bancaire. Connectez Google en 30 secondes et recevez vos premières réponses IA immédiatement.',
  ctaTrial: 'Démarrer l’essai gratuit',
  ctaPricing: 'Voir les tarifs',
};

const shellEN = {
  metrics: [
    { value: 'Claude 3.5', label: 'Primary AI model', sub: '+ GPT-4o-mini fallback' },
    { value: '3', label: 'Connected platforms', sub: 'Google · Facebook · Trustpilot' },
    { value: '30 min', label: 'AI Capture delay', sub: 'After each visit (ZENITH)' },
    { value: '3 variants', label: 'Triple-judge AI', sub: 'Empathy · Storytelling · Expertise (PULSE+)' },
  ],
  plansOverview: [
    {
      plan: 'VISION',
      price: '€59',
      color: 'border-gray-600/40',
      badge: 'bg-gray-500/20 text-gray-300',
      features: ['Claude AI (local language)', 'Monthly PDF report', 'Shield Center (detection)'],
    },
    {
      plan: 'PULSE',
      price: '€97',
      color: 'border-[#2563eb]/40 bg-[#2563eb]/5',
      badge: 'bg-[#2563eb]/20 text-[#2563eb]',
      features: [
        '+ Multilingual + triple judge',
        '+ WhatsApp alerts',
        '+ Full Shield (disputes)',
        '+ Weekly WhatsApp digest',
      ],
    },
    {
      plan: 'ZENITH',
      price: '€179',
      color: 'border-violet-500/40 bg-violet-500/5',
      badge: 'bg-violet-500/20 text-violet-400',
      features: [
        '+ AI Capture (visits → reviews)',
        '+ POS connector (Square, SumUp)',
        '+ SEO boost (keywords)',
        '+ 24/7 strategic AI consultant',
      ],
    },
  ],
  perMonth: '/mo',
  ctaTitle: 'All of this from day one of your free trial',
  ctaBody:
    '14 days of full ZENITH access — no card required. Connect Google in about 30 seconds and get your first AI replies immediately.',
  ctaTrial: 'Start free trial',
  ctaPricing: 'See pricing',
};

const frPath = path.join(messagesDir, 'fr.json');
const enPath = path.join(messagesDir, 'en.json');
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
deepAssign(fr, { FeaturesPage: shellFR });
deepAssign(en, { FeaturesPage: shellEN });
fs.writeFileSync(frPath, JSON.stringify(fr));
fs.writeFileSync(enPath, JSON.stringify(en));
console.log('merge-features-shell-i18n: OK');
