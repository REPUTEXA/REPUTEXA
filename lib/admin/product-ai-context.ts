import fs from 'fs';
import path from 'path';

import { createTranslator } from 'next-intl';

import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';

const FILE = path.join(process.cwd(), 'lib', 'generated', 'product-ai-context.txt');
const CHANGELOG = path.join(process.cwd(), 'CHANGELOG.md');

function productAiT() {
  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  return createTranslator({ locale, messages, namespace: 'Admin.productAiContext' });
}

/**
 * Bloc texte factuel (commits, chemins, CHANGELOG) pour enrichir les prompts IA admin.
 * Ne contient pas de secrets. Vide si aucun fichier généré (lancer `npm run product:ai-context`).
 */
export function getProductAiContextText(maxChars = 14_000): string {
  const t = productAiT();
  let raw = '';
  try {
    if (fs.existsSync(FILE)) {
      raw = fs.readFileSync(FILE, 'utf8').trim();
    }
  } catch {
    raw = '';
  }
  if (!raw || raw.startsWith('(aucun contexte')) {
    try {
      if (fs.existsSync(CHANGELOG)) {
        raw = fs.readFileSync(CHANGELOG, 'utf8').trim();
      }
    } catch {
      raw = '';
    }
  }
  if (!raw) return '';
  return raw.length <= maxChars ? raw : `${raw.slice(0, maxChars)}\n${t('truncatedSuffix')}`;
}

/**
 * Formate pour injection dans un prompt utilisateur.
 */
export function appendProductContextSection(userMessage: string, maxChars = 12_000): string {
  const t = productAiT();
  const block = getProductAiContextText(maxChars);
  if (!block) return userMessage;
  return `${userMessage.trim()}\n\n---\n${t('promptInstructions')}\n\n${t('repoContextHeading')}\n${block}\n`;
}
