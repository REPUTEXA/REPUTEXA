export type PilotageCashTerminalRow = {
  terminalId: string;
  ticketCount: number;
  revenueCents: number;
};

export type PilotageCashStaffRow = {
  staffName: string;
  ticketCount: number;
  revenueCents: number;
  /** Part des tickets avec matched_member_id (Wallet), 0-100. */
  capturePercent: number;
};

export function aggregateCashIngestionRows(
  rows: Array<{
    terminal_id?: string | null;
    staff_name?: string | null;
    matched_member_id?: string | null;
    amount?: string | number | null;
  }>,
  labels: { unknownTerminal: string; unnamedStaff: string }
): { terminals: PilotageCashTerminalRow[]; staff: PilotageCashStaffRow[] } {
  const byT = new Map<string, { n: number; cents: number }>();
  const byS = new Map<string, { n: number; cents: number; matched: number }>();

  for (const r of rows) {
    const eur = typeof r.amount === 'number' ? r.amount : Number(r.amount ?? 0);
    const cents = Number.isFinite(eur) ? Math.round(Math.max(0, eur) * 100) : 0;
    const tidRaw = r.terminal_id != null ? String(r.terminal_id).trim() : '';
    const tid = tidRaw || labels.unknownTerminal;
    const snRaw = r.staff_name != null ? String(r.staff_name).trim() : '';
    const sn = snRaw || labels.unnamedStaff;

    const te = byT.get(tid) ?? { n: 0, cents: 0 };
    te.n += 1;
    te.cents += cents;
    byT.set(tid, te);

    const se = byS.get(sn) ?? { n: 0, cents: 0, matched: 0 };
    se.n += 1;
    se.cents += cents;
    if (r.matched_member_id) se.matched += 1;
    byS.set(sn, se);
  }

  const terminals = [...byT.entries()]
    .map(([terminalId, v]) => ({
      terminalId,
      ticketCount: v.n,
      revenueCents: v.cents,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  const staff = [...byS.entries()]
    .map(([staffName, v]) => ({
      staffName,
      ticketCount: v.n,
      revenueCents: v.cents,
      capturePercent: v.n > 0 ? Math.round((v.matched / v.n) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  return { terminals, staff };
}
