'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { ImagePlus, Loader2, Sparkles, PlusCircle, Wand2, X, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import type { UpdateAttachment } from '@/components/dashboard/updates-list';

export function AdminUpdatesForm() {
  const ta = useTranslations('Dashboard.adminUpdatesForm');
  const locale = useLocale();
  const router = useRouter();
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState('');
  const [rawNotes, setRawNotes] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<UpdateAttachment[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [subliming, setSubliming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduleLocal, setScheduleLocal] = useState('');

  const addMediaFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setMediaUploading(true);
    try {
      let next = [...attachments];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/updates/upload', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? ta('toastMediaError'));
        next = [...next, { url: data.url as string, type: data.type as 'image' | 'video' }];
      }
      setAttachments(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ta('toastMediaError'));
    } finally {
      setMediaUploading(false);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const handleSublime = async () => {
    if (!title.trim() && !rawNotes.trim()) {
      toast.error(ta('toastTitleOrNotes'));
      return;
    }
    setSubliming(true);
    try {
      const res = await fetch('/api/admin/updates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          rawNotes: rawNotes.trim(),
          locale,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? ta('toastSublimeError'));
      setContent(data.content ?? '');
      toast.success(ta('toastSublimeOk'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ta('toastSublimeError'));
    } finally {
      setSubliming(false);
    }
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      toast.error(ta('toastTitleRequired'));
      return;
    }
    if (!content.trim()) {
      toast.error(ta('toastContentRequired'));
      return;
    }
    if (scheduleMode === 'scheduled') {
      if (!scheduleLocal.trim()) {
        toast.error(ta('toastSchedulePick'));
        return;
      }
      const t = new Date(scheduleLocal).getTime();
      if (Number.isNaN(t)) {
        toast.error(ta('toastScheduleInvalid'));
        return;
      }
    }
    setPublishing(true);
    try {
      const payload: {
        title: string;
        content: string;
        attachments: typeof attachments;
        publish_at?: string;
        source_locale: string;
      } = {
        title: title.trim(),
        content: content.trim(),
        attachments,
        source_locale: locale,
      };
      if (scheduleMode === 'scheduled') {
        payload.publish_at = new Date(scheduleLocal).toISOString();
      }

      const res = await fetch('/api/admin/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? ta('toastPublishError'));
      if (scheduleMode === 'scheduled' && scheduleLocal) {
        toast.success(
          ta('toastScheduledFor', {
            when: new Date(scheduleLocal).toLocaleString(siteLocaleToIntlDateTag(locale), {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
          })
        );
      } else {
        toast.success(ta('toastPublished'));
      }
      setTitle('');
      setRawNotes('');
      setContent('');
      setAttachments([]);
      setScheduleMode('now');
      setScheduleLocal('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ta('toastPublishError'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="rounded-2xl border border-violet-200 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/60 to-indigo-50/40 dark:from-violet-950/20 dark:to-indigo-950/10 p-6 shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 mb-5">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <PlusCircle className="w-4 h-4" />
        </span>
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-zinc-100">{ta('heading')}</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">{ta('subtitle')}</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-400/20 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          {ta('adminBadge')}
        </span>
      </div>

      <div className="space-y-4 max-w-2xl">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
            {ta('fieldTitle')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={ta('titlePlaceholder')}
            maxLength={200}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
          />
        </div>

        {/* Raw notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
            {ta('fieldRawNotes')}{' '}
            <span className="text-slate-400 dark:text-zinc-600 font-normal">{ta('optional')}</span>
          </label>
          <textarea
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            placeholder={ta('rawNotesPlaceholder')}
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 resize-none transition-all"
          />
          <button
            type="button"
            onClick={handleSublime}
            disabled={subliming}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {subliming ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            {subliming ? ta('sublimeRunning') : ta('sublimeCta')}
          </button>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">{ta('aiHint')}</p>
        </div>

        {/* Final content editor */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">{ta('contentLabel')}</label>
            {content && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {ta('labelSublimed')}
              </span>
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={ta('contentPlaceholder')}
            rows={6}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 resize-none transition-all text-sm leading-relaxed"
          />
          <p className="text-xs text-slate-400 dark:text-zinc-600 text-right mt-1">
            {ta('charCount', { count: String(content.length) })}
          </p>
        </div>

        {/* Médias (images / vidéos) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
            {ta('mediaHeading')}{' '}
            <span className="text-slate-400 dark:text-zinc-600 font-normal">{ta('optional')}</span>
          </label>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2">{ta('mediaHint')}</p>
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => addMediaFiles(e.target.files)}
          />
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              disabled={mediaUploading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 bg-white dark:bg-zinc-900 hover:bg-violet-50 dark:hover:bg-violet-950/40 disabled:opacity-50 transition-colors"
            >
              {mediaUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImagePlus className="w-3.5 h-3.5" />
              )}
              {mediaUploading ? ta('addMediaUploading') : ta('addMedia')}
            </button>
            {attachments.length > 0 ? (
              <span className="text-xs text-slate-400 dark:text-zinc-600">
                {ta('filesCount', { count: String(attachments.length) })}
              </span>
            ) : null}
          </div>
          {attachments.length > 0 ? (
            <ul className="flex flex-wrap gap-3">
              {attachments.map((a, i) => (
                <li
                  key={`${a.url}-${i}`}
                  className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-700 w-28 h-28 bg-slate-100 dark:bg-zinc-900"
                >
                  {a.type === 'image' ? (
                    <Image
                      src={a.url}
                      alt=""
                      width={112}
                      height={112}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-center px-1 text-slate-500 dark:text-zinc-400">
                      {ta('video')}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/65 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={ta('removeMediaAria')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-violet-800/40 bg-white/60 dark:bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-zinc-200">
            <CalendarClock className="w-4 h-4 text-violet-600 dark:text-violet-400" aria-hidden />
            {ta('scheduleTitle')}
          </div>
          <p
            className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: (ta as unknown as { raw: (k: string) => string }).raw('scheduleHelpHtml') }}
          />
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-zinc-300">
              <input
                type="radio"
                name="pub-mode"
                checked={scheduleMode === 'now'}
                onChange={() => setScheduleMode('now')}
                className="rounded-full border-violet-400 text-violet-600 focus:ring-violet-500/30"
              />
              {ta('publishNow')}
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-zinc-300">
              <input
                type="radio"
                name="pub-mode"
                checked={scheduleMode === 'scheduled'}
                onChange={() => setScheduleMode('scheduled')}
                className="rounded-full border-violet-400 text-violet-600 focus:ring-violet-500/30"
              />
              {ta('scheduleRadioLater')}
            </label>
          </div>
          {scheduleMode === 'scheduled' ? (
            <input
              type="datetime-local"
              value={scheduleLocal}
              onChange={(e) => setScheduleLocal(e.target.value)}
              className="w-full max-w-md px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-900 dark:text-zinc-100"
            />
          ) : null}
        </div>

        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing || !title.trim() || !content.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
        >
          {publishing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : scheduleMode === 'scheduled' ? (
            <CalendarClock className="w-4 h-4" />
          ) : (
            <PlusCircle className="w-4 h-4" />
          )}
          {publishing
            ? ta('publishSending')
            : scheduleMode === 'scheduled'
              ? ta('ctaSchedule')
              : ta('ctaPublish')}
        </button>
      </div>
    </section>
  );
}
