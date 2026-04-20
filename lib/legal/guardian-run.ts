import { createAdminClient } from '@/lib/supabase/admin';
import { generateText } from '@/lib/ai-service';
import OpenAI from 'openai';
import { digestTavilyResults, tavilySearch, type TavilySearchResult } from '@/lib/legal/tavily';
import { legalTodayUtc } from '@/lib/legal/dates';
import { GUARDIAN_TAVILY_QUERIES } from '@/lib/legal/guardian-queries';
import {
  type GuardianScope,
  deriveZoneMapFromGuardian,
} from '@/lib/legal/compliance-zones';
import { sendLegalGuardianAdminDigest } from '@/lib/legal/guardian-digest-email';
import { stripHtmlToPlain } from '@/lib/admin/strip-html-plain';

const LEGAL_ANTHROPIC_MODEL = process.env.LEGAL_ANTHROPIC_MODEL?.trim();

/** Étiquettes autorité pour preuve d’audit (fil de preuve BfDI, AEPD, etc.). */
function inferAuthoritiesFromUrls(results: TavilySearchResult[]): string[] {
  const tags = new Set<string>();
  for (const r of results) {
    const u = r.url.toLowerCase();
    if (u.includes('edpb.europa.eu') || u.includes('/edpb')) tags.add('edpb');
    if (u.includes('cnil.fr')) tags.add('cnil');
    if (u.includes('garanteprivacy') || u.includes('garante')) tags.add('garante');
    if (u.includes('aepd')) tags.add('aepd');
    if (u.includes('bfdi') || u.includes('bund.de')) tags.add('bfdi');
    if (u.includes('ico.org.uk')) tags.add('ico');
    if (u.includes('uodo')) tags.add('uodo');
    if (u.includes('cnpd.pt')) tags.add('cnpd_pt');
    if (u.includes('imy.se')) tags.add('imy');
    if (u.includes('gdpr.eu') || u.includes('europa.eu')) tags.add('eu_portal');
  }
  return Array.from(tags);
}

function guardianScanProofMetadata(
  results: TavilySearchResult[],
  searchDigest: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const authorities_scanned = inferAuthoritiesFromUrls(results);
  return {
    ...(authorities_scanned.length ? { authorities_scanned } : {}),
    sources_sample: results.slice(0, 14).map((r) => r.url),
    tavily_result_count: results.length,
    search_digest_preview: searchDigest.slice(0, 1200),
    ...extra,
  };
}

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

async function gpt4oVerify(
  claudeConclusion: string,
  searchDigest: string,
  policyExcerpt: string
): Promise<{ agrees: boolean; reason: string }> {
  const openai = getOpenAI();
  if (!openai) {
    return { agrees: true, reason: 'OpenAI indisponible — validation simple seule.' };
  }
  const system = `Tu es un revérificateur juridique RGPD (UE). On te donne des extraits de sources web et l'analyse d'un autre modèle.
Réponds UNIQUEMENT en JSON : { "agrees": boolean, "reason": string courte en français }
- agrees=true seulement si tu confirmes qu'un changement matériel des obligations (cookies, consentement, privacy) semble plausible à partir des extraits.
- agrees=false si les sources sont trop pauvres ou si l'analyse semble spéculative.`;

  const user = `EXTRAITS RECHERCHE (autorités UE / UK / EDPB) :\n${searchDigest.slice(0, 8000)}\n\nEXTRAIT POLITIQUE ACTUELLE REPUTEXA :\n${policyExcerpt.slice(0, 4000)}\n\nANALYSE CLAUDE :\n${claudeConclusion.slice(0, 4000)}\n\nValide ou infirme l'alerte.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : raw) as { agrees?: boolean; reason?: string };
    return {
      agrees: parsed.agrees === true,
      reason: String(parsed.reason ?? '').slice(0, 800),
    };
  } catch {
    return { agrees: false, reason: 'Erreur validation GPT-4o.' };
  }
}

export type GuardianRunResult = {
  status: 'ok' | 'review_needed' | 'error' | 'skipped';
  summary: string;
  draftId?: string;
};

const CLAUDE_GUARDIAN_JSON_RULES = `Tu es le "REPUTEXA Legal Guardian". Tu couvres les marchés : FR, IT, ES, DE, UK (ICO), Benelux, Scandinavie, Pologne, Portugal, et le cadre **EDPB** (orientations UE).

À partir des extraits (EDPB, CNIL, Garante, AEPD, BfDI, ICO, AP Benelux, IMY, UODO, CNPD, etc.) et de la politique actuelle :

1) Si changement **au niveau européen** (directive, lignes directrices EDPB, projet ePrivacy qui engage tous les États) → scope **eu_wide**.
2) Si évolution **principalement locale** (ex. doctrine, amendes record, loi nationale spécifique) → scope **local** et précise **local_market_labels** en français (ex. "Allemagne", "Royaume-Uni").

Si mise à jour matérielle recommandée, réponds en JSON strict :
{
  "alert": true,
  "scope": "eu_wide" | "local",
  "regions": ["FR","DE","EU"],
  "local_market_labels": ["Allemagne"],
  "severity": "low"|"medium"|"high",
  "rationale": "texte court",
  "proposed_summary_fr": "résumé pour email clients",
  "proposed_html_fragment": "HTML h2/h3/p uniquement — sans html/head/body",
  "cookie_names_suggested": ["_ga","__stripe_mid"]
}

Si aucune alerte : { "alert": false, "scope": "none", "rationale": "..." }`;

/**
 * Exécution complète du Guardian : recherche étendue, Claude, GPT-4o, brouillon + e-mail si accord.
 */
export async function runLegalGuardian(): Promise<GuardianRunResult> {
  const admin = createAdminClient();
  if (!admin) {
    return { status: 'error', summary: 'Supabase admin non configuré.' };
  }

  const today = legalTodayUtc();
  const allResults: Awaited<ReturnType<typeof tavilySearch>> = [];

  for (const q of GUARDIAN_TAVILY_QUERIES) {
    const r = await tavilySearch(q, 2);
    allResults.push(...r);
  }

  const uniqueByUrl = new Map<string, (typeof allResults)[0]>();
  for (const r of allResults) {
    if (!uniqueByUrl.has(r.url)) uniqueByUrl.set(r.url, r);
  }
  const results = Array.from(uniqueByUrl.values()).slice(0, 28);
  const searchDigest = digestTavilyResults(results);

  const nowIso = new Date().toISOString();
  let polRow: { content: string | null; version: number | null } | null = null;
  const resPol = await admin
    .from('legal_versioning')
    .select('content, version')
    .eq('document_type', 'politique_confidentialite')
    .lte('effective_at', nowIso)
    .or('status.eq.ACTIVE,status.eq.active,status.is.null')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (resPol.error && String(resPol.error.message || '').includes('effective_at')) {
    const legacy = await admin
      .from('legal_versioning')
      .select('content, version')
      .eq('document_type', 'politique_confidentialite')
      .lte('effective_date', today)
      .or('status.eq.ACTIVE,status.eq.active,status.is.null')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    polRow = legacy.data;
  } else {
    polRow = resPol.data;
  }

  const policyExcerpt =
    String(polRow?.content ?? '').slice(0, 6000) || '(Aucune politique publiée en base.)';

  let claudeRaw: string;
  try {
    claudeRaw = await generateText({
      systemPrompt: CLAUDE_GUARDIAN_JSON_RULES,
      userContent: `EXTRAITS :\n${searchDigest}\n\nPOLITIQUE ACTUELLE :\n${policyExcerpt}`,
      temperature: 0.15,
      maxTokens: 4096,
      anthropicModel: LEGAL_ANTHROPIC_MODEL,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const errZones = deriveZoneMapFromGuardian('error', [], 'none', []);
    await admin.from('legal_guardian_state').upsert({
      id: 1,
      last_run_at: new Date().toISOString(),
      last_status: 'error',
      last_summary: msg,
      compliance_zones: errZones,
      updated_at: new Date().toISOString(),
    });
    await admin.from('legal_compliance_logs').insert({
      event_type: 'guardian_run',
      message: msg,
      metadata: guardianScanProofMetadata(results, searchDigest, { error_stage: 'claude_or_openai' }),
    });
    await sendLegalGuardianAdminDigest(admin, {
      kind: 'error',
      summary: 'Le cycle Guardian a échoué (Claude / moteur IA).',
      errorDetail: msg,
      sourcesCount: results.length,
    });
    return { status: 'error', summary: msg };
  }

  const jsonMatch = claudeRaw.match(/\{[\s\S]*\}/);
  let parsed: {
    alert?: boolean;
    scope?: string;
    regions?: string[];
    local_market_labels?: string[];
    severity?: string;
    rationale?: string;
    proposed_summary_fr?: string;
    proposed_html_fragment?: string;
    cookie_names_suggested?: string[];
  } = {};
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : claudeRaw);
  } catch {
    parsed = { alert: false, scope: 'none', rationale: 'Parse JSON échoué — sortie Claude non structurée.' };
  }

  const scope: GuardianScope =
    parsed.scope === 'eu_wide' || parsed.scope === 'local' ? parsed.scope : 'none';
  const localLabels = Array.isArray(parsed.local_market_labels)
    ? parsed.local_market_labels.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const dual = await gpt4oVerify(claudeRaw, searchDigest, policyExcerpt);
  const cookieInventory = Array.isArray(parsed.cookie_names_suggested)
    ? parsed.cookie_names_suggested.map((n) => ({ name: String(n), source: 'guardian_suggestion' }))
    : [];

  if (!parsed.alert) {
    const okZones = deriveZoneMapFromGuardian('ok', [], 'none', []);
    await admin.from('legal_guardian_state').upsert({
      id: 1,
      last_run_at: new Date().toISOString(),
      last_status: 'ok',
      last_summary: String(parsed.rationale ?? 'Pas d\'alerte.'),
      cookie_inventory: cookieInventory.length ? cookieInventory : [],
      regions_flagged: [],
      compliance_zones: okZones,
      dual_validation: { gpt4o: dual },
      updated_at: new Date().toISOString(),
    });
    await admin.from('legal_compliance_logs').insert({
      event_type: 'guardian_run',
      message: 'Cycle terminé — pas d’alerte.',
      metadata: guardianScanProofMetadata(results, searchDigest, {
        dual,
        evidence_summary_fr: String(parsed.rationale ?? 'Pas d’alerte.').slice(0, 2000),
      }),
    });
    await admin.from('legal_config').upsert({
      key: 'cookie_inventory_last_scan',
      value: { at: new Date().toISOString(), items: cookieInventory },
      base_language: 'en',
      updated_at: new Date().toISOString(),
    });
    if (process.env.LEGAL_GUARDIAN_SILENT_OK !== '1') {
      await sendLegalGuardianAdminDigest(admin, {
        kind: 'ok',
        summary: String(parsed.rationale ?? 'Aucune évolution matérielle détectée ; veille enregistrée.'),
        sourcesCount: results.length,
      });
    }
    return { status: 'ok', summary: String(parsed.rationale ?? '') };
  }

  const regions = (parsed.regions ?? []).map(String);

  if (!dual.agrees) {
    const watchZones = deriveZoneMapFromGuardian('ok', regions, 'none', []);
    await admin.from('legal_guardian_state').upsert({
      id: 1,
      last_run_at: new Date().toISOString(),
      last_status: 'ok',
      last_summary: `Alerte Claude non confirmée par GPT-4o : ${dual.reason}`,
      cookie_inventory: cookieInventory,
      regions_flagged: regions,
      compliance_zones: watchZones,
      dual_validation: { gpt4o: dual, claude: parsed },
      updated_at: new Date().toISOString(),
    });
    await admin.from('legal_compliance_logs').insert({
      event_type: 'guardian_run',
      message: 'Faux positif filtré (désaccord GPT-4o).',
      metadata: guardianScanProofMetadata(results, searchDigest, { dual, claude: parsed }),
    });
    await sendLegalGuardianAdminDigest(admin, {
      kind: 'filtered',
      summary: `Alerte Claude non confirmée par GPT-4o : ${dual.reason}`,
      sourcesCount: results.length,
    });
    return { status: 'ok', summary: dual.reason };
  }

  const alertScope: GuardianScope = scope === 'local' ? 'local' : 'eu_wide';
  const zoneMap = deriveZoneMapFromGuardian('review_needed', regions, alertScope, localLabels);

  const { data: draft, error: draftErr } = await admin
    .from('legal_guardian_drafts')
    .insert({
      document_type: 'politique_confidentialite',
      content_html: String(parsed.proposed_html_fragment ?? '').slice(0, 80000),
      summary_of_changes: String(parsed.proposed_summary_fr ?? parsed.rationale ?? '').slice(0, 8000),
      client_email_draft: null,
      detected_regions: regions.length ? regions : ['EU'],
      search_digest: searchDigest.slice(0, 12000),
      dual_validation: { claude: parsed, gpt4o: dual, scope: alertScope, local_market_labels: localLabels },
      status: 'pending_admin',
    })
    .select('id')
    .single();

  if (draftErr) {
    await admin.from('legal_compliance_logs').insert({
      event_type: 'guardian_run',
      message: `Draft insert: ${draftErr.message}`,
      metadata: guardianScanProofMetadata(results, searchDigest, { error: true, draft_error: draftErr.message }),
    });
    await sendLegalGuardianAdminDigest(admin, {
      kind: 'error',
      summary: 'Impossible d’enregistrer le brouillon Guardian en base.',
      errorDetail: draftErr.message,
      sourcesCount: results.length,
    });
    return { status: 'error', summary: draftErr.message };
  }

  await admin.from('legal_guardian_state').upsert({
    id: 1,
    last_run_at: new Date().toISOString(),
    last_status: 'review_needed',
    last_summary: String(parsed.rationale ?? 'Mise à jour suggérée.'),
    cookie_inventory: cookieInventory,
    regions_flagged: regions.length ? regions : ['EU'],
    compliance_zones: zoneMap,
    dual_validation: { claude: parsed, gpt4o: dual, scope: alertScope, local_market_labels: localLabels },
    updated_at: new Date().toISOString(),
  });

  await admin.from('legal_compliance_logs').insert({
    event_type: 'guardian_draft_created',
    message: 'Brouillon Guardian créé — validation admin requise.',
    metadata: {
      ...guardianScanProofMetadata(results, searchDigest, {
        evidence_summary_fr: String(parsed.proposed_summary_fr ?? parsed.rationale ?? '').slice(0, 2000),
      }),
      draft_id: draft?.id,
      regions,
      severity: parsed.severity,
      scope: alertScope,
      local_market_labels: localLabels,
      dual_validation: { claude: parsed, gpt4o: dual },
    },
    legal_version: typeof polRow?.version === 'number' ? polRow.version : null,
  });

  let scopeNotice = '';
  if (alertScope === 'eu_wide') {
    scopeNotice = `<p><strong>Brouillon global UE</strong> — évolution susceptibles d’impacter <em>tous</em> les marchés (cadre EDPB / européen).</p>`;
  } else {
    const labs = localLabels.length ? localLabels.join(', ') : regions.join(', ');
    scopeNotice = `<p style="border-left:4px solid #f59e0b;padding:12px 14px;margin:16px 0;background:#fffbeb;color:#78350f;border-radius:8px"><strong>Attention :</strong> Mise à jour spécifique requise pour le(s) marché(s) : <strong>${labs || 'voir rapport'}</strong>.</p>`;
  }

  const reviewLead = `${scopeNotice}
<p>Le Guardian a détecté une évolution matérielle (cookies / confidentialité). Les modèles <strong>Claude</strong> et <strong>GPT-4o</strong> sont alignés.</p>
<p><strong>Prochaine étape :</strong> panneau Admin → section publication → <em>Importer le brouillon Guardian</em>, puis vérifie les sources sur Compliance avant de publier.</p>`;

  const draftTextPreview = stripHtmlToPlain(String(parsed.proposed_html_fragment ?? ''), 3500);

  await sendLegalGuardianAdminDigest(admin, {
    kind: 'review_needed',
    summary: String(parsed.proposed_summary_fr ?? parsed.rationale ?? 'Mise à jour suggérée.'),
    draftId: draft?.id,
    sourcesCount: results.length,
    htmlLead: reviewLead,
    draftTextPreview,
  });

  return {
    status: 'review_needed',
    summary: String(parsed.proposed_summary_fr ?? parsed.rationale ?? ''),
    draftId: draft?.id,
  };
}
