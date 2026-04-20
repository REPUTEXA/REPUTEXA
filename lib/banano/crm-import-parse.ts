import type * as XLSXNS from 'xlsx';
import { normalizePhoneE164 } from '@/lib/banano/phone';

/** Parse le premier onglet (Excel ou CSV via xlsx). */
export function parseSpreadsheetBuffer(buf: ArrayBuffer, xlsx: typeof XLSXNS): string[][] {
  const wb = xlsx.read(buf, { type: 'array', cellDates: true });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const sheet = wb.Sheets[name];
  if (!sheet) return [];
  const raw = xlsx.utils.sheet_to_json<(string | number | Date | null | boolean)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  return raw.map((row) =>
    (Array.isArray(row) ? row : []).map((c) => {
      if (c == null || c === '') return '';
      if (c instanceof Date && !Number.isNaN(c.getTime())) return c.toISOString().slice(0, 10);
      return String(c).trim();
    })
  );
}

/**
 * Si la première ligne ressemble surtout à des numéros (pas un en-tête), on fabrique des libellés.
 */
export function detectHeaderAndData(grid: string[][]): { headers: string[]; dataRows: string[][] } {
  if (!grid.length) return { headers: [], dataRows: [] };
  const width = Math.max(...grid.map((r) => r.length), 0);
  const padRow = (r: string[]) => {
    const o = [...r];
    while (o.length < width) o.push('');
    return o.slice(0, width);
  };
  const rows = grid.map(padRow);

  const row0 = rows[0] ?? [];
  let phoneLike = 0;
  for (const c of row0) {
    if (normalizePhoneE164(c)) phoneLike++;
  }
  const textLabels = row0.filter(
    (c) => c.length >= 2 && !normalizePhoneE164(c) && !/^\d+([.,]\d+)?$/.test(c.replace(/\s/g, ''))
  ).length;

  if (phoneLike >= 2 && textLabels <= 1) {
    const headers = Array.from({ length: width }, (_, i) => `Colonne ${i + 1}`);
    return { headers, dataRows: rows.filter((r) => r.some((c) => c)) };
  }

  const headers = row0.map((c, i) => (c ? c : `Colonne ${i + 1}`));
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c));
  return { headers, dataRows };
}
