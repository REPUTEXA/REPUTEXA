'use strict';

/**
 * Envoie le montant et l'horodatage vers l'API pilotage.
 * @param {{
 *   baseUrl: string;
 *   apiKey: string;
 *   amount: number;
 *   timestamp: string;
 *   source?: string;
 *   rawData?: string;
 *   ticketFileName?: string;
 *   terminalId?: string;
 *   staffName?: string;
 * }} data
 * @returns {Promise<{ ok: boolean; status: number; body?: string; ticketRef?: string | null }>}
 */
async function sendTicketToCloud(data) {
  const { baseUrl, apiKey, amount, timestamp, source, rawData, ticketFileName, terminalId, staffName } =
    data;
  const url = `${baseUrl.replace(/\/$/, '')}/api/banano/pilotage/ingest`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      amount,
      timestamp,
      ...(source ? { source } : {}),
      ...(rawData != null && rawData !== '' ? { raw_data: rawData } : {}),
      ...(ticketFileName ? { ticket_file_name: ticketFileName } : {}),
      ...(terminalId != null && String(terminalId).trim() !== ''
        ? { terminal_id: String(terminalId).trim().slice(0, 64) }
        : {}),
      ...(staffName != null && String(staffName).trim() !== ''
        ? { staff_name: String(staffName).trim().slice(0, 120) }
        : {}),
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: text.slice(0, 500), ticketRef: null };
  }
  /** @type {string | null} */
  let ticketRef = null;
  try {
    const j = JSON.parse(text);
    if (j && typeof j.ticket_ref === 'string') ticketRef = j.ticket_ref;
  } catch {
    /* ignore */
  }
  return { ok: true, status: res.status, body: text, ticketRef };
}

module.exports = { sendTicketToCloud };
