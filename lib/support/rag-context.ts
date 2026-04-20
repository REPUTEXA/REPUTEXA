import type { SupabaseClient } from '@supabase/supabase-js';
import { embedText } from './embeddings';
import { toVectorParam } from './vector';
import { loadPublicDocsTruthForSupport } from './public-docs-truth';

export type LearningRow = {
  id: string;
  root_cause: string;
  effective_solution: string;
  prevention: string;
  similarity: number;
  is_gold_standard?: boolean;
  gold_standard_score?: number;
};

type FeedbackRow = {
  id: string;
  error_pattern: string;
  root_mistake: string;
  correct_approach: string;
  similarity: number;
};

type DynamicKbRow = {
  id: string;
  problem_summary: string;
  solution_summary: string;
  similarity: number;
};

export type CodeChunkRow = {
  id: string;
  file_path: string;
  content: string;
  similarity: number;
};

type LegalDocRow = {
  id: string;
  document_type: string;
  version: number;
  content: string;
  summary_of_changes: string;
  effective_date: string;
  status: string;
  similarity: number;
};

type DirectLegalDoc = Omit<LegalDocRow, 'similarity'>;

const LEGAL_DOC_LABELS: Record<string, string> = {
  cgu: "Conditions Générales d'Utilisation (CGU)",
  politique_confidentialite: 'Politique de Confidentialité',
  mentions_legales: 'Mentions Légales',
};

const LEGAL_DOC_TYPES = ['cgu', 'politique_confidentialite', 'mentions_legales'] as const;

/** Longueur utile : privilégie le champ `content` (HTML publié). */
function payloadChars(doc: DirectLegalDoc | null): number {
  if (!doc) return 0;
  const c = doc.content?.trim().length ?? 0;
  const s = doc.summary_of_changes?.trim().length ?? 0;
  return c + s;
}

export type LegalTypeSlot = {
  active: DirectLegalDoc | null;
  pending: DirectLegalDoc | null;
  /** Dernière ligne sans filtre statut (fallback si rien ou corps vide après filtre « ciblé »). */
  fallbackLatest: DirectLegalDoc | null;
};

export type LegalFetchResult = {
  byType: Record<string, LegalTypeSlot>;
  errors: string[];
  /** true si au moins une ligne utile a été lue */
  hasAnyDocument: boolean;
};

/** Active élargi : ACTIVE / active / NULL (lignes sans statut explicite post-migration). */
const OR_ACTIVE_STATUSES = 'status.eq.ACTIVE,status.eq.active,status.is.null';

/** PENDING insensible à la casse. */
const OR_PENDING_STATUSES = 'status.eq.PENDING,status.eq.pending';

function buildLegalDebugPayload(result: LegalFetchResult): Record<string, unknown> {
  return {
    errors: result.errors,
    hasAnyDocument: result.hasAnyDocument,
    byType: Object.fromEntries(
      LEGAL_DOC_TYPES.map((t) => {
        const b = result.byType[t];
        const snap = (d: DirectLegalDoc | null, role: string) =>
          !d
            ? null
            : {
                role,
                id: d.id,
                version: d.version,
                status: d.status ?? '(null)',
                effective_date: d.effective_date,
                content_length: d.content?.length ?? 0,
                summary_length: d.summary_of_changes?.length ?? 0,
                content_preview: (d.content ?? '').slice(0, 500),
                summary_preview: (d.summary_of_changes ?? '').slice(0, 200),
              };
        return [
          t,
          {
            active: snap(b.active, 'active'),
            pending: snap(b.pending, 'pending'),
            fallbackLatest: snap(b.fallbackLatest, 'fallback_all_statuses'),
          },
        ];
      })
    ),
  };
}

/**
 * PRIORITÉ ABSOLUE — Lecture systématique de legal_versioning (sans dépendre de l'embedding).
 * Par type : ACTIVE élargi + PENDING, puis fallback « dernière version » si aucune donnée exploitable.
 */
export async function fetchLegalVersioningForSupport(
  admin: SupabaseClient
): Promise<LegalFetchResult> {
  const errors: string[] = [];
  const byType: LegalFetchResult['byType'] = {} as LegalFetchResult['byType'];
  let hasAnyDocument = false;

  const selectCols =
    'id, document_type, version, content, summary_of_changes, effective_date, status';

  await Promise.all(
    LEGAL_DOC_TYPES.map(async (docType) => {
      byType[docType] = { active: null, pending: null, fallbackLatest: null };

      const { data: activeList, error: eActive } = await admin
        .from('legal_versioning')
        .select(selectCols)
        .eq('document_type', docType)
        .or(OR_ACTIVE_STATUSES)
        .order('version', { ascending: false })
        .limit(1);

      if (eActive) {
        errors.push(`[legal_versioning] ${docType} ACTIVE: ${eActive.message} (${eActive.code ?? 'no code'})`);
      } else if (activeList?.[0]) {
        byType[docType].active = activeList[0] as DirectLegalDoc;
        hasAnyDocument = true;
      }

      const { data: pendingList, error: ePending } = await admin
        .from('legal_versioning')
        .select(selectCols)
        .eq('document_type', docType)
        .or(OR_PENDING_STATUSES)
        .order('version', { ascending: false })
        .limit(1);

      if (ePending) {
        errors.push(`[legal_versioning] ${docType} PENDING: ${ePending.message} (${ePending.code ?? 'no code'})`);
      } else if (pendingList?.[0]) {
        byType[docType].pending = pendingList[0] as DirectLegalDoc;
        hasAnyDocument = true;
      }
    })
  );

  // Fallback élargi : parmi les ~15 dernières versions du type, prendre la 1re avec corps non vide,
  // sinon la toute dernière (équivalent « sans filtre langue/statut » sur ce type).
  for (const docType of LEGAL_DOC_TYPES) {
    const b = byType[docType];
    const hasRow = !!(b.active || b.pending);
    const hasPayload = payloadChars(b.active) > 0 || payloadChars(b.pending) > 0;
    const needFallback = !hasRow || !hasPayload;

    if (!needFallback) continue;

    const { data: candidates, error: eLatest } = await admin
      .from('legal_versioning')
      .select(selectCols)
      .eq('document_type', docType)
      .order('version', { ascending: false })
      .limit(15);

    if (eLatest) {
      errors.push(`[legal_versioning] ${docType} FALLBACK: ${eLatest.message} (${eLatest.code ?? 'no code'})`);
      continue;
    }
    const rows = (candidates ?? []) as DirectLegalDoc[];
    const best = rows.find((r) => payloadChars(r) > 0) ?? rows[0];
    if (!best) continue;

    const alreadyShown =
      (b.active && best.id === b.active.id) || (b.pending && best.id === b.pending.id);
    if (alreadyShown && payloadChars(best) === 0) continue;

    b.fallbackLatest = best;
    hasAnyDocument = true;
  }

  const legalData = { byType, errors, hasAnyDocument };
  console.log('[DEBUG-DATA]', JSON.stringify(buildLegalDebugPayload(legalData)));

  return legalData;
}

/** Synthèse d’abord (essentiel, ex. 30 jours), puis texte complet HTML pour le détail. */
function appendContentThenSummary(
  sections: string[],
  doc: DirectLegalDoc,
  maxContentChars: number
): void {
  const rawContent = doc.content?.trim() ?? '';
  const summary = doc.summary_of_changes?.trim() || '—';
  sections.push(
    '**Synthèse contractuelle (lire en premier — points clés, délais, remboursements, ex. logique 30 jours si mentionnée)** :'
  );
  sections.push(summary);
  sections.push('');
  sections.push('**Texte juridique complet (détail des clauses ; si trop long, la synthèse ci-dessus fait foi pour l’essentiel)** :');
  if (rawContent) {
    sections.push(
      rawContent.length <= maxContentChars
        ? rawContent
        : `${rawContent.slice(0, maxContentChars)}…`
    );
  } else {
    sections.push(
      '_(non renseigné — s’appuyer sur la synthèse ou sur une autre version.)_'
    );
  }
  sections.push('');
}

function formatLegalBlockMarkdown(result: LegalFetchResult): string {
  const sections: string[] = [
    '# ⚖️ Documents légaux officiels REPUTEXA',
    '',
    '**(Usage interne — ne pas répéter au client)** : Si le texte complet est volumineux, s’appuyer d’abord sur la **Synthèse contractuelle** pour l’essentiel (délais, remboursement, dont la logique des 30 jours quand elle y figure). Avant toute impasse, relire **### Conditions Légales** ; si « Remboursement » / « remboursement » y apparaît, l’utiliser. Distinction « règle en vigueur » vs « règle à venir » si les deux sont fournis.',
    '',
    '### Conditions Légales',
    '',
  ];

  for (const docType of LEGAL_DOC_TYPES) {
    const label = LEGAL_DOC_LABELS[docType] ?? docType;
    const slot = result.byType[docType] ?? {
      active: null,
      pending: null,
      fallbackLatest: null,
    };
    const { active, pending, fallbackLatest } = slot;

    if (!active && !pending && !fallbackLatest) continue;

    sections.push(`## ${label}`);
    sections.push('');

    if (active) {
      const dateStr = new Date(active.effective_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
      sections.push(
        `### RÈGLE EN VIGUEUR (version ${active.version}, statut ${active.status ?? 'NULL|ACTIVE'}, effet : ${dateStr})`
      );
      sections.push('');
      appendContentThenSummary(sections, active, 12000);
    }

    if (pending) {
      const dateStr = new Date(pending.effective_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
      sections.push(`### RÈGLE À VENIR (Prendra effet le ${dateStr})`);
      sections.push('');
      sections.push(`- Version **${pending.version}**, statut **PENDING** jusqu’à cette date.`);
      sections.push('');
      appendContentThenSummary(sections, pending, 12000);
      sections.push(
        '> Anticipe : « Actuellement, [RÈGLE EN VIGUEUR / content]. À compter du **' +
          dateStr +
          '**, [RÈGLE À VENIR / content]. »'
      );
      sections.push('');
    }

    if (
      fallbackLatest &&
      fallbackLatest.id !== active?.id &&
      fallbackLatest.id !== pending?.id
    ) {
      const dateStr = new Date(fallbackLatest.effective_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
      sections.push(
        `### DOCUMENT (recherche élargie — dernière version utile pour ce type, sans filtre statut / « toutes langues » côté schéma)`
      );
      sections.push('');
      sections.push(
        `Dernière entrée retenue : v${fallbackLatest.version}, statut **${fallbackLatest.status ?? '—'}**, date ${dateStr}. Utiliser si les blocs ci-dessus n’avaient pas de **content** exploitable.`
      );
      sections.push('');
      appendContentThenSummary(sections, fallbackLatest, 12000);
    }
  }

  if (!result.hasAnyDocument) {
    sections.push(
      '_Aucune ligne trouvée dans `legal_versioning` pour les types CGU / confidentialité / mentions (ou requête en erreur — voir logs `[DEBUG-DATA]` et `[rag-context]`)._'
    );
  }

  return sections.join('\n');
}

/** Logs serveur pour diagnostiquer un contexte légal absent ou une requête en échec. */
function logLegalFetchIssues(result: LegalFetchResult): void {
  const perType = Object.fromEntries(
    LEGAL_DOC_TYPES.map((t) => {
      const b = result.byType[t];
      return [t, { activeId: b?.active?.id ?? null, pendingId: b?.pending?.id ?? null }];
    })
  );

  if (result.errors.length > 0) {
    console.warn('[rag-context] Erreur(s) sur la table `legal_versioning` (requête Supabase)', {
      errors: result.errors,
      perType,
    });
  }

  if (!result.hasAnyDocument) {
    console.warn(
      '[rag-context] Bloc légal vide — aucun enregistrement ACTIVE/PENDING trouvé pour les types cgu, politique_confidentialite, mentions_legales. Vérifier : migration 074 (colonne status), politiques RLS (insert via service_role), publications Legal-AI.',
      { perType }
    );
  }
}

/**
 * Détecte si la question justifie une recherche vectorielle sur les docs légaux (enrichissement).
 */
function needsDeepLegalSearch(query: string): boolean {
  const q = query.toLowerCase();
  return (
    q.includes('cgu') ||
    q.includes('condition') ||
    q.includes('confidentialité') ||
    q.includes('confidentialite') ||
    q.includes('rgpd') ||
    q.includes('legal') ||
    q.includes('légal') ||
    q.includes('données') ||
    q.includes('donnees') ||
    q.includes('mention') ||
    q.includes('règle') ||
    q.includes('regle') ||
    q.includes('clause') ||
    q.includes('consentement') ||
    q.includes('cookie') ||
    q.includes('droit') ||
    q.includes('politique') ||
    q.includes('remboursement') ||
    q.includes('résiliation') ||
    q.includes('resiliation') ||
    q.includes('annulation') ||
    q.includes('abonnement') ||
    q.includes('facturation') ||
    q.includes('paiement') ||
    q.includes('essai') ||
    q.includes('gratuit') ||
    q.includes('prix') ||
    q.includes('offre') ||
    q.includes('contrat') ||
    q.includes('responsabilité') ||
    q.includes('responsabilite') ||
    q.includes('garantie') ||
    q.includes('litige') ||
    q.includes('contestation') ||
    q.includes('suppression') ||
    q.includes('compte') ||
    q.includes('résidence') ||
    q.includes('juridiction') ||
    q.includes('applicable')
  );
}

export async function fetchRagContext(
  admin: SupabaseClient,
  userQuery: string
): Promise<{ learningBlock: string; codeBlock: string; legalBlock: string }> {
  // ── 1. PRIORITE ABSOLUE : vérités `/public/docs` + legal_versioning (hors embedding) ──
  const legalResult = await fetchLegalVersioningForSupport(admin);
  let legalBlock = formatLegalBlockMarkdown(legalResult);
  logLegalFetchIssues(legalResult);

  try {
    const publicTruth = await loadPublicDocsTruthForSupport();
    legalBlock = `${publicTruth}\n\n---\n\n${legalBlock}`;
  } catch (e) {
    console.warn('[rag-context] public-docs truth indisponible', e);
  }

  const q = userQuery.trim();
  if (!q) {
    return {
      learningBlock: '(aucune requete utilisateur -- memoire code non interrogee)',
      codeBlock: '(idem)',
      legalBlock,
    };
  }

  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await embedText(q);
  } catch (e) {
    console.warn('[rag-context] Embedding indisponible', e);
  }

  if (!queryEmbedding) {
    return {
      learningBlock:
        '_(Recherche semantique indisponible. Les documents legaux restent prioritaires.)_',
      codeBlock: '_(Idem -- pas extrait code par embedding.)_',
      legalBlock,
    };
  }

  const vec = toVectorParam(queryEmbedding);
  const deepLegalSearch = needsDeepLegalSearch(q);

  // ── Requetes paralleles (knowledge + code + legal + feedback + memoire dynamique)
  const [learningRes, codeRes, legalVectorRes, feedbackRes, dynamicKbRes] = await Promise.all([
    admin.rpc('match_ai_learning_knowledge', { query_embedding: vec, match_count: 8 }),
    admin.rpc('match_code_kb_chunks', { query_embedding: vec, match_count: 14 }),
    deepLegalSearch
      ? admin.rpc('match_legal_documents', { query_embedding: vec, match_count: 6 })
      : Promise.resolve({ data: null }),
    Promise.resolve(admin.rpc('match_ai_learning_feedback', { query_embedding: vec, match_count: 5 }))
      .catch(() => ({ data: null })),
    Promise.resolve(
      admin.rpc('match_knowledge_base_dynamic', { query_embedding: vec, match_count: 8 })
    ).catch(() => ({ data: null })),
  ]);

  const learningRaw = (learningRes.data ?? []) as LearningRow[];
  const codeRaw     = (codeRes.data ?? []) as CodeChunkRow[];
  const feedbackRaw = ((feedbackRes as { data: unknown }).data ?? []) as FeedbackRow[];
  const dynamicRaw  = ((dynamicKbRes as { data: unknown }).data ?? []) as DynamicKbRow[];
  const learning = learningRaw.filter((r) => (r.similarity ?? 0) > 0.25);
  const chunks   = codeRaw.filter((r) => (r.similarity ?? 0) > 0.2);
  const feedback = feedbackRaw.filter((r) => (r.similarity ?? 0) > 0.20);
  const dynamicKb = dynamicRaw.filter((r) => (r.similarity ?? 0) > 0.22);

  // ── Gold Standards (les 5 meilleures methodes eprouvees) ──────────────────
  const { data: goldRows } = await admin
    .from('ai_learning_knowledge')
    .select('id, root_cause, effective_solution, prevention, gold_standard_score, tool_used')
    .eq('is_gold_standard', true)
    .order('gold_standard_score', { ascending: false })
    .limit(5);

  // ── 10 lecons les plus recentes (contexte dynamique) ─────────────────────
  const { data: recentRows } = await admin
    .from('ai_learning_knowledge')
    .select('id, root_cause, effective_solution, prevention, is_gold_standard, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  const seenIds = new Set([
    ...learning.map((l) => l.id),
    ...((goldRows ?? []).map((g) => g.id as string)),
  ]);
  const recentExtra: NonNullable<typeof recentRows> = [];
  for (const r of recentRows ?? []) {
    const id = r.id as string | undefined;
    if (!id || seenIds.has(id)) continue;
    recentExtra.push(r);
    if (recentExtra.length >= 6) break;
  }

  // ── Bloc Gold Standards ───────────────────────────────────────────────────
  const goldSection =
    (goldRows ?? []).length === 0
      ? ''
      : [
          '### STANDARDS D OR -- Methodes eprouvees (score >= 8/10)',
          '(Applique ces solutions en priorite si le cas correspond.)',
          '',
          ...(goldRows ?? []).map(
            (g, i) =>
              `#### Gold Standard ${i + 1}${g.gold_standard_score ? ` (score ${g.gold_standard_score}/10)` : ''}\n` +
              `- Probleme type : ${g.root_cause}\n` +
              `- Solution : ${g.effective_solution}\n` +
              `- Prevention : ${g.prevention}` +
              ((g.tool_used as string | null) ? `\n- Outil utilise : ${g.tool_used as string}` : '')
          ),
        ].join('\n');

  // ── Bloc similarite ───────────────────────────────────────────────────────
  const similarSection =
    learning.length === 0
      ? '_(Aucun cas a forte similarite semantique.)_'
      : learning
          .map(
            (l, i) =>
              `### Cas similaire ${i + 1} (${(l.similarity * 100).toFixed(0)}%)` +
              (l.is_gold_standard ? ' [GOLD]' : '') +
              `\n- Cause : ${l.root_cause}\n- Solution : ${l.effective_solution}\n- Prevention : ${l.prevention}`
          )
          .join('\n\n');

  // ── Bloc 10 lecons recentes ───────────────────────────────────────────────
  const recentSection =
    recentExtra.length === 0
      ? '_(Les dernieres fiches sont deja couvertes dans les blocs ci-dessus.)_'
      : recentExtra
          .map(
            (r, i) =>
              `### Lecon recente ${i + 1}\n` +
              `- Cause : ${r.root_cause}\n` +
              `- Solution : ${r.effective_solution}\n` +
              `- Prevention : ${r.prevention}`
          )
          .join('\n\n');

  // ── Bloc memoire negative ─────────────────────────────────────────────────
  const feedbackSection =
    feedback.length === 0
      ? ''
      : [
          '',
          '### MEMOIRE NEGATIVE -- Erreurs corrigees (ne pas repeter)',
          '',
          ...feedback.map(
            (f, i) =>
              `#### Erreur corrigee ${i + 1} (${(f.similarity * 100).toFixed(0)}%)\n` +
              `- Schema d erreur : ${f.error_pattern}\n` +
              `- Erreur commise : ${f.root_mistake}\n` +
              `- Bonne approche : ${f.correct_approach}`
          ),
        ].join('\n');

  const dynamicKbSection =
    dynamicKb.length === 0
      ? '_(Aucune fiche « probleme / solution » tres proche dans les tickets resoles recents.)_'
      : dynamicKb
          .map(
            (d, i) =>
              `#### Experience fraiche ${i + 1} (${(d.similarity * 100).toFixed(0)}%)\n` +
              `- Probleme (type) : ${d.problem_summary}\n` +
              `- Solution : ${d.solution_summary}`
          )
          .join('\n\n');

  const learningBlock = [
    '## Memoire interne -- Genesis v2 (Gold Standards + Similarite + 10 Lecons + Memoire Negative)',
    '',
    '### MEMOIRE COLLECTIVE TEMPS REEL (tickets resoles recents — knowledge_base_dynamic)',
    '',
    dynamicKbSection,
    '',
    goldSection,
    '',
    '### Par similarite semantique',
    similarSection,
    '',
    '### 10 lecons les plus recentes',
    recentSection,
    feedbackSection,
  ].join('\n');

  const codeBlock =
    chunks.length === 0
      ? 'Aucun extrait de code projet suffisamment proche.'
      : chunks
          .map(
            (c) =>
              `#### Fichier \`${c.file_path}\` (pertinence ${(c.similarity * 100).toFixed(0)}%)\n` +
              '```\n' +
              c.content +
              '\n```'
          )
          .join('\n\n');

  // Enrichissement vectoriel legal
  const vectorDocs = ((legalVectorRes.data ?? []) as LegalDocRow[]).filter(
    (r) => (r.similarity ?? 0) > 0.2
  );
  if (vectorDocs.length > 0) {
    const extra = ['', '### Enrichissement semantique (passages les plus proches)'];
    vectorDocs.slice(0, 4).forEach((doc) => {
      const label = LEGAL_DOC_LABELS[doc.document_type] ?? doc.document_type;
      const dateStr = new Date(doc.effective_date).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
      extra.push(
        `- **${label}** v${doc.version} (${doc.status}) -- ${dateStr} -- pertinence ${(doc.similarity * 100).toFixed(0)}%\n` +
          (doc.summary_of_changes?.trim()
            ? doc.summary_of_changes.trim().slice(0, 800)
            : doc.content?.slice(0, 1200) || '--')
      );
    });
    legalBlock += '\n' + extra.join('\n');
  }

  return { learningBlock, codeBlock, legalBlock };
}