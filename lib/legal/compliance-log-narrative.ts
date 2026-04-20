/**

 * Formulations « fil de preuve » pour audit / autorités (admin), multilingues.

 */

export type ComplianceLogRow = {
  id: string;

  event_type: string;

  message: string | null;

  metadata: Record<string, unknown> | null;

  legal_version: number | null;

  created_at: string;
};

export const AUTHORITY_LABELS: Record<string, string> = {
  edpb: "EDPB",

  cnil: "CNIL",

  garante: "Garante Privacy",

  aepd: "AEPD",

  bfdi: "BfDI",

  ico: "ICO (UK)",

  uodo: "UODO",

  cnpd_pt: "CNPD (PT)",

  imy: "IMY",

  apd_be: "APD (BE)",

  datatilsynet_dk: "Datatilsynet",

  eu_portal: "EU",
};

type UILocale = "fr" | "en" | "es" | "it" | "de";

function normalizeUiLocale(raw: string): UILocale {
  const k = raw.slice(0, 2).toLowerCase();

  if (k === "fr" || k === "en" || k === "es" || k === "it" || k === "de")
    return k;

  return "en";
}

function listAuthorities(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const auth = meta.authorities_scanned;
  if (Array.isArray(auth) && auth.length) {
    return auth
      .slice(0, 10)
      .map((x) => {
        const s = typeof x === "string" ? x : String(x);
        const key = s.toLowerCase().replace(/[^a-z0-9_]/g, "");
        return AUTHORITY_LABELS[s] ?? AUTHORITY_LABELS[key] ?? s.toUpperCase();
      })
      .join(", ");
  }
  const urls = meta.sources_sample;
  if (Array.isArray(urls) && urls.length) {
    return urls
      .slice(0, 5)
      .map((x) => {
        const s = typeof x === "string" ? x : String(x);
        try {
          const h = new URL(s).hostname.replace(/^www\./, "");
          return h.length > 42 ? `${h.slice(0, 40)}…` : h;
        } catch {
          return s.length > 48 ? `${s.slice(0, 46)}…` : s;
        }
      })
      .join(", ");
  }
  return "";
}

const BCP47: Record<UILocale, string> = {
  fr: "fr-FR",

  en: "en-GB",

  es: "es-ES",

  it: "it-IT",

  de: "de-DE",
};

const TEMPLATE = {
  fr: {
    legalPublish: (d: string, v: string, trans: string) =>
      `${d} — Publication ${v} entrée en vigueur${trans ? ` (traductions : ${trans})` : ""}. Preuve horodatée (legal_compliance_logs).`,

    guardianRun: (d: string, summary: string, auth: string) =>
      `${d} — Veille Guardian : ${summary}${auth ? ` | Sources / autorités : ${auth}` : ""}.`,

    guardianDraft: (d: string, scope: string, locals: string) =>
      `${d} — Brouillon juridique préparé par l’IA${scope === "local" && locals ? ` (marché(s) : ${locals})` : scope === "eu_wide" ? " (portée UE)" : ""}. Révision humaine requise avant publication.`,

    guardianAlert: (d: string, msg: string) =>
      `${d} — Alerte conformité : ${msg}.`,

    aiAudit: (d: string, msg: string) => `${d} — Audit trace : ${msg}.`,

    fallback: (d: string, typ: string, msg: string) =>
      `${d} — [${typ}] ${msg}`.trim(),
  },

  en: {
    legalPublish: (d: string, v: string, trans: string) =>
      `${d} — Legal publication ${v} is in force${trans ? ` (translations: ${trans})` : ""}. Timestamped proof (legal_compliance_logs).`,

    guardianRun: (d: string, summary: string, auth: string) =>
      `${d} — Guardian monitoring: ${summary}${auth ? ` | Sources / authorities: ${auth}` : ""}.`,

    guardianDraft: (d: string, scope: string, locals: string) =>
      `${d} — Legal draft prepared by AI${scope === "local" && locals ? ` (market(s): ${locals})` : scope === "eu_wide" ? " (EU-wide)" : ""}. Human review required before publication.`,

    guardianAlert: (d: string, msg: string) =>
      `${d} — Compliance alert: ${msg}.`,

    aiAudit: (d: string, msg: string) =>
      `${d} — AI / sync audit trace: ${msg}.`,

    fallback: (d: string, typ: string, msg: string) =>
      `${d} — [${typ}] ${msg}`.trim(),
  },

  es: {
    legalPublish: (d: string, v: string, trans: string) =>
      `${d} — Publicación legal ${v} en vigor${trans ? ` (traducciones: ${trans})` : ""}. Prueba horaria (legal_compliance_logs).`,

    guardianRun: (d: string, summary: string, auth: string) =>
      `${d} — Ciclo Guardian: ${summary}${auth ? ` | Fuentes / autoridades: ${auth}` : ""}.`,

    guardianDraft: (d: string, scope: string, locals: string) =>
      `${d} — Borrador jurídico preparado por IA${scope === "local" && locals ? ` (mercado(s): ${locals})` : scope === "eu_wide" ? " (ámbito UE)" : ""}. Revisión humana obligatoria antes de publicar.`,

    guardianAlert: (d: string, msg: string) =>
      `${d} — Alerta de cumplimiento: ${msg}.`,

    aiAudit: (d: string, msg: string) =>
      `${d} — Traza de auditoría IA: ${msg}.`,

    fallback: (d: string, typ: string, msg: string) =>
      `${d} — [${typ}] ${msg}`.trim(),
  },

  it: {
    legalPublish: (d: string, v: string, trans: string) =>
      `${d} — Pubblicazione legale ${v} in vigore${trans ? ` (traduzioni: ${trans})` : ""}. Prova con timestamp (legal_compliance_logs).`,

    guardianRun: (d: string, summary: string, auth: string) =>
      `${d} — Ciclo Guardian: ${summary}${auth ? ` | Fonti / autorità: ${auth}` : ""}.`,

    guardianDraft: (d: string, scope: string, locals: string) =>
      `${d} — Bozza giuridica preparata dall’IA${scope === "local" && locals ? ` (mercati: ${locals})` : scope === "eu_wide" ? " (ambito UE)" : ""}. Revisione umana richiesta prima della pubblicazione.`,

    guardianAlert: (d: string, msg: string) =>
      `${d} — Avviso conformità: ${msg}.`,

    aiAudit: (d: string, msg: string) => `${d} — Traccia audit IA: ${msg}.`,

    fallback: (d: string, typ: string, msg: string) =>
      `${d} — [${typ}] ${msg}`.trim(),
  },

  de: {
    legalPublish: (d: string, v: string, trans: string) =>
      `${d} — Rechtsveröffentlichung ${v} in Kraft${trans ? ` (Übersetzungen: ${trans})` : ""}. Zeitgestempelter Nachweis (legal_compliance_logs).`,

    guardianRun: (d: string, summary: string, auth: string) =>
      `${d} — Guardian-Lauf: ${summary}${auth ? ` | Quellen / Behörden: ${auth}` : ""}.`,

    guardianDraft: (d: string, scope: string, locals: string) =>
      `${d} — Vom KI vorbereiteter Rechtsentwurf${scope === "local" && locals ? ` (Märkte: ${locals})` : scope === "eu_wide" ? " (EU-weit)" : ""}. Menschliche Prüfung vor Veröffentlichung erforderlich.`,

    guardianAlert: (d: string, msg: string) =>
      `${d} — Compliance-Hinweis: ${msg}.`,

    aiAudit: (d: string, msg: string) => `${d} — KI-/Sync-Audit: ${msg}.`,

    fallback: (d: string, typ: string, msg: string) =>
      `${d} — [${typ}] ${msg}`.trim(),
  },
} as const;

/** Narration courte pour affichage admin (langue UI = locale du dashboard). */

export function formatComplianceLogNarrative(
  row: ComplianceLogRow,
  uiLocale: string,
): string {
  const loc = normalizeUiLocale(uiLocale);

  const tpl = TEMPLATE[loc];

  const meta =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;

  const ts = new Date(row.created_at);

  const dateStr = ts.toLocaleString(BCP47[loc], {
    day: "2-digit",

    month: "2-digit",

    year: "numeric",

    hour: "2-digit",

    minute: "2-digit",
  });

  if (row.event_type === "legal_publish") {
    const doc = meta?.document_type
      ? String(meta.document_type)
      : loc === "en"
        ? "legal document"
        : "document légal";

    const v =
      row.legal_version != null
        ? `${doc} v${row.legal_version}`
        : loc === "en"
          ? "new version"
          : "nouvelle version";

    const trans = Array.isArray(meta?.translation_locales)
      ? (meta!.translation_locales as string[]).join(", ")
      : "";

    return tpl.legalPublish(dateStr, v, trans);
  }

  if (row.event_type === "guardian_run") {
    const auth = listAuthorities(meta);

    const summary = meta?.evidence_summary_fr
      ? String(meta.evidence_summary_fr)
      : (row.message ?? "Guardian");

    return tpl.guardianRun(dateStr, summary, auth);
  }

  if (row.event_type === "guardian_draft_created") {
    const scope = meta?.scope ? String(meta.scope) : "";

    const locals = Array.isArray(meta?.local_market_labels)
      ? (meta!.local_market_labels as string[]).join(", ")
      : "";

    return tpl.guardianDraft(dateStr, scope, locals);
  }

  if (row.event_type === "guardian_alert") {
    return tpl.guardianAlert(
      dateStr,
      row.message ?? (loc === "en" ? "see metadata" : "voir métadonnées"),
    );
  }

  if (row.event_type === "ai_audit") {
    return tpl.aiAudit(
      dateStr,
      row.message ?? (loc === "en" ? "AI event" : "événement IA"),
    );
  }

  return tpl.fallback(dateStr, row.event_type, row.message ?? "");
}
