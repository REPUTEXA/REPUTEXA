import { MessagesSquare } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { DateTimeFormatOptions } from 'use-intl';
import { AdminCouncilDigestSeedButton } from '@/components/admin/admin-council-digest-seed-button';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

/** Intl options — module const avoids i18next/no-literal-string in JSX. */
const DIGEST_ROW_DATETIME_OPTS: DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'short',
};

type Turn = {
  agent_key: string;
  label: string;
  message: string;
};

export type CouncilDigestRow = {
  id: string;
  created_at: string;
  transcript: Turn[];
  consensus_note: string | null;
};

export async function AdminCouncilDigestPanel({
  rows,
  locale,
}: {
  rows: CouncilDigestRow[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: 'Dashboard.adminCouncilDigest' });
  const dateTag = siteLocaleToIntlDateTag(locale);

  if (!rows.length) {
    return (
      <section
        className="rounded-2xl border border-zinc-800/80 bg-zinc-900/25 p-5"
        aria-labelledby="council-digest-heading"
      >
        <div className="flex items-center gap-2 mb-2">
          <MessagesSquare className="h-5 w-5 text-cyan-400/90" aria-hidden />
          <h2 id="council-digest-heading" className="text-sm font-semibold text-zinc-100">
            {t('emptyTitle')}
          </h2>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          {t.rich('introRich', {
            brief: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
            notdebate: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
            jobs: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
          })}
        </p>
        <p className="text-xs text-zinc-500 leading-relaxed mt-2">
          {t.rich('cronHintRich', {
            cronPath: (chunks) => <code className="text-zinc-400">{chunks}</code>,
            cronSecret: (chunks) => <code className="text-zinc-400">{chunks}</code>,
            firstLine: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
          })}
        </p>
        <AdminCouncilDigestSeedButton />
        <p className="text-[10px] text-zinc-600 mt-3 leading-relaxed">
          {t.rich('prereqRich', {
            migration: (chunks) => <code className="text-zinc-500">{chunks}</code>,
          })}
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-zinc-800/80 bg-zinc-900/25 p-5 space-y-4"
      aria-labelledby="council-digest-heading"
    >
      <div className="flex items-center gap-2">
        <MessagesSquare className="h-5 w-5 text-cyan-400/90" aria-hidden />
        <h2 id="council-digest-heading" className="text-sm font-semibold text-zinc-100">
          {t('dataTitle')}
        </h2>
      </div>
      <p className="text-[11px] text-zinc-400 leading-relaxed">
        {t.rich('dataIntroRich', {
          photos: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
        })}
      </p>
      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 space-y-2">
            <p className="text-[10px] font-mono text-zinc-500">
              {new Date(row.created_at).toLocaleString(dateTag, DIGEST_ROW_DATETIME_OPTS)}
            </p>
            {row.consensus_note ? (
              <p className="text-xs font-medium text-cyan-200/90">{row.consensus_note}</p>
            ) : null}
            <ul className="space-y-2 pl-0 list-none">
              {(row.transcript ?? []).map((turn, i) => (
                <li
                  key={`${row.id}-${i}`}
                  className="text-xs text-zinc-400 leading-relaxed border-l-2 border-zinc-700 pl-3"
                >
                  <span className="text-zinc-300 font-semibold">{turn.label}</span>
                  <span className="text-zinc-600"> · </span>
                  {turn.message}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
