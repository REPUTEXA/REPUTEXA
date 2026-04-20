'use strict';

/**
 * Extrait montant + horodatage depuis le contenu d'un ticket.
 * JSON : amount | montant | total ; timestamp | horodatage | date | at
 * Texte : tente JSON, sinon premier nombre décimal plausible.
 * @param {string} content
 * @param {'.json' | '.txt' | string} ext
 * @param {number} fileMtimeMs
 * @returns {{ amount: number; timestamp: string } | null}
 */
function parseTicketContent(content, ext, fileMtimeMs) {
  const trimmed = content.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return null;

  if (ext.toLowerCase() === '.json' || trimmed.startsWith('{')) {
    try {
      const o = JSON.parse(trimmed);
      if (typeof o !== 'object' || o === null || Array.isArray(o)) return null;
      const amount = pickAmount(/** @type {Record<string, unknown>} */ (o));
      const timestamp = pickTimestamp(/** @type {Record<string, unknown>} */ (o), fileMtimeMs);
      if (amount == null || timestamp == null) return null;
      return { amount, timestamp };
    } catch {
      return null;
    }
  }

  try {
    const o = JSON.parse(trimmed);
    if (typeof o === 'object' && o !== null && !Array.isArray(o)) {
      const amount = pickAmount(/** @type {Record<string, unknown>} */ (o));
      const timestamp = pickTimestamp(/** @type {Record<string, unknown>} */ (o), fileMtimeMs);
      if (amount != null && timestamp != null) return { amount, timestamp };
    }
  } catch {
    /* fall through */
  }

  const amount = parseAmountFromPlainText(trimmed);
  if (amount == null) return null;
  return {
    amount,
    timestamp: new Date(fileMtimeMs).toISOString(),
  };
}

/** @param {Record<string, unknown>} o */
function pickAmount(o) {
  const keys = ['amount', 'montant', 'total', 'prix', 'value'];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** @param {Record<string, unknown>} o */
function pickTimestamp(o, fileMtimeMs) {
  const keys = ['timestamp', 'horodatage', 'date', 'at', 'emitted_at'];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) {
      const d = Date.parse(v);
      if (!Number.isNaN(d)) return new Date(d).toISOString();
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      return new Date(v).toISOString();
    }
  }
  return new Date(fileMtimeMs).toISOString();
}

/**
 * @param {string} text
 * @returns {number | null}
 */
function parseAmountFromPlainText(text) {
  const m = text.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

module.exports = { parseTicketContent };
