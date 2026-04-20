'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {
  Loader2,
  Mic,
  Camera,
  Send,
  ThumbsUp,
  Check,
  Trash2,
  X,
  Sparkles,
  Megaphone,
  Languages,
} from 'lucide-react';
import { DeleteConfirmModal } from '@/components/dashboard/delete-confirm-modal';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import {
  countryCodeToFlagEmoji,
  countryCodeToLocalizedRegionName,
  publicSuggestionAuthorFirstName,
  resolveAuthorCountryCode,
} from '@/lib/i18n/suggestion-author-display';

/** Chargé uniquement au clic admin + hors SSR — évite conflits React / Suspense avec Turbopack. */
const AdminClientDetailSheet = dynamic(
  () =>
    import('@/components/admin/admin-client-detail-sheet').then((m) => m.AdminClientDetailSheet),
  { ssr: false }
);
type AppSuggestion = {
  id: string;
  title: string;
  description: string;
  status: string;
  upvotes_count: number;
  created_at: string;
  completed_at?: string | null;
  user_has_upvoted: boolean;
  image_url?: string | null;
  update_content?: string | null;
  author_locale?: string | null;
  author_full_name?: string | null;
  author_country_code?: string | null;
  /** Présent uniquement pour les admins (masqué côté API pour les autres). */
  user_id?: string;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-400/30',
  IN_PROGRESS: 'bg-[#2563eb]/15 text-[#2563eb] border border-[#2563eb]/30',
  DONE: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-400/30',
};

function formatDate(s: string, locale: string): string {
  return new Date(s).toLocaleDateString(siteLocaleToIntlDateTag(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------
function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const tl = useTranslations('Suggestions.lightbox');
  const imageAlt = tl('alt');
  const closeButtonAria = tl('closeAria');
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div
        className="relative z-10 w-full max-w-5xl h-[min(85vh,900px)] min-h-[200px]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={url}
          alt={imageAlt}
          fill
          className="object-contain rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)]"
          sizes="100vw"
          unoptimized
        />
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-colors"
          aria-label={closeButtonAria}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DONE publication modal (admin only)
// ---------------------------------------------------------------------------
function DoneModal({
  suggestion,
  onClose,
  onPublished,
  locale,
}: {
  suggestion: AppSuggestion;
  onClose: () => void;
  onPublished: (id: string, completedAt: string, content: string) => void;
  locale: string;
}) {
  const td = useTranslations('Suggestions.doneModal');
  const [content, setContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/app-suggestions/${suggestion.id}/generate-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: suggestion.title,
          description: suggestion.description,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? td('errAi'));
      setContent(data.content ?? '');
      toast.success(td('toastGenerated'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : td('errGen'));
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!content.trim()) {
      toast.error(td('errPublishEmpty'));
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch(`/api/app-suggestions/${suggestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE', update_content: content, source_locale: locale }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? td('errAi'));
      onPublished(
        suggestion.id,
        data.suggestion.completed_at ?? new Date().toISOString(),
        content
      );
      toast.success(td('toastPublished'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : td('errPublish'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#0a0a0b] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Megaphone className="w-4 h-4" />
              </span>
              <h2 className="font-semibold text-slate-900 dark:text-zinc-100 text-lg">
                {td('title')}
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {td('subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={td('closeAria')}
            className="ml-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Suggestion preview */}
        <div className="mx-6 mt-5 mb-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800">
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wide mb-1">
            {td('sourceLabel')}
          </p>
          <p className="font-semibold text-slate-900 dark:text-zinc-100">{suggestion.title}</p>
          {suggestion.description && (
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400 line-clamp-3">
              {suggestion.description}
            </p>
          )}
        </div>

        {/* Announcement editor */}
        <div className="px-6 pb-2 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              {td('officialLabel')}
            </label>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {generating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {generating ? td('generating') : td('generateWithAi')}
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder={td('placeholder')}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-600 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 resize-none transition-all"
          />
          <p className="text-xs text-slate-400 dark:text-zinc-600 text-right">
            {td('charCount', { count: content.length })}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-zinc-800 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
          >
            {td('cancel')}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || !content.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm"
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" strokeWidth={2.5} />
            )}
            {publishing ? td('publishing') : td('publish')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SuggestionsPage() {
  const t = useTranslations('Suggestions');
  const locale = useLocale();
  const [isAdmin, setIsAdmin] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<AppSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [suggestingTitle, setSuggestingTitle] = useState(false);
  const [upvoting, setUpvoting] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [doneModal, setDoneModal] = useState<AppSuggestion | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [translationById, setTranslationById] = useState<
    Record<string, { title: string; description: string }>
  >({});
  const [translateLoadingId, setTranslateLoadingId] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState<Record<string, boolean>>({});
  const [adminDetailUserId, setAdminDetailUserId] = useState<string | null>(null);
  const [adminDetailEstablishmentLabel, setAdminDetailEstablishmentLabel] = useState<string | null>(
    null
  );

  const fetchSuggestions = useCallback(() => {
    fetch('/api/app-suggestions')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? t('list.errLoadList'));
        return data.suggestions ?? [];
      })
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchSuggestions();
    fetch('/api/auth/role')
      .then((r) => r.json())
      .then((d) => setIsAdmin(d?.role === 'admin'))
      .catch(() => {});
  }, [fetchSuggestions]);

  useEffect(() => {
    setTranslationById({});
    setShowTranslated({});
  }, [locale]);

  const handleTranslate = async (id: string) => {
    setTranslateLoadingId(id);
    try {
      const res = await fetch(`/api/app-suggestions/${id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_locale: locale }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('list.translateError'));
      setTranslationById((prev) => ({
        ...prev,
        [id]: { title: String(data.title ?? ''), description: String(data.description ?? '') },
      }));
      setShowTranslated((prev) => ({ ...prev, [id]: true }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('list.translateError'));
    } finally {
      setTranslateLoadingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t('form.titleRequired'));
      return;
    }
    setSubmitting(true);
    try {
      let res: Response;
      if (imageFile) {
        const form = new FormData();
        form.append('title', title.trim());
        form.append('description', description.trim());
        form.append('author_locale', locale);
        form.append('image', imageFile);
        res = await fetch('/api/app-suggestions', {
          method: 'POST',
          body: form,
          credentials: 'include',
        });
      } else {
        res = await fetch('/api/app-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            author_locale: locale,
          }),
          credentials: 'include',
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('form.genericError'));
      toast.success(t('form.submitSuccess'));
      setTitle('');
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
      setSuggestions((prev) => [data.suggestion, ...prev]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('form.genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMicToggle = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setRecording(false);
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = async () => {
          if (chunksRef.current.length === 0) return;
          setTranscribing(true);
          try {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const form = new FormData();
            form.append('audio', blob);
            const res = await fetch('/api/suggestions/transcribe', {
              method: 'POST',
              body: form,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? t('form.errTranscription'));
            setDescription((prev) => prev + (prev ? '\n' : '') + (data.transcript ?? '').trim());
          } catch (err) {
            toast.error(err instanceof Error ? err.message : t('form.errTranscription'));
          } finally {
            setTranscribing(false);
          }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setRecording(true);
      })
      .catch(() => toast.error(t('form.errMic')));
  };

  const handleCameraClick = () => fileInputRef.current?.click();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setSuggestingTitle(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch('/api/suggestions/suggest-title', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('form.genericError'));
      if (data.title) setTitle(data.title);
    } catch {
      // Silently ignore AI suggestion failure; photo is still attached
    } finally {
      setSuggestingTitle(false);
      e.target.value = '';
    }
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleUpvote = async (id: string) => {
    setUpvoting(id);
    try {
      const res = await fetch(`/api/app-suggestions/${id}/upvote`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('list.errUpvote'));
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                upvotes_count:
                  data.upvotes_count ??
                  (s.user_has_upvoted ? s.upvotes_count - 1 : s.upvotes_count + 1),
                user_has_upvoted: data.upvoted ?? !s.user_has_upvoted,
              }
            : s
        )
      );
    } catch {
      // silent
    } finally {
      setUpvoting(null);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (newStatus === 'DONE' && isAdmin) {
      const suggestion = suggestions.find((s) => s.id === id);
      if (suggestion) setDoneModal(suggestion);
      return;
    }

    setStatusUpdating(id);
    try {
      const res = await fetch(`/api/app-suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('list.errStatus'));
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: data.suggestion.status, completed_at: data.suggestion.completed_at ?? null }
            : s
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('list.errStatus'));
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleDelete = (id: string, title: string) => {
    setDeleteTarget({ id, title });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleting(id);
    try {
      const res = await fetch(`/api/app-suggestions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('list.errStatus'));
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setDeleteTarget(null);
      toast.success(t('toasts.suggestionDeleted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toasts.errDelete'));
    } finally {
      setDeleting(null);
    }
  };

  const handleDonePublished = (id: string, completedAt: string, content: string) => {
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: 'DONE', completed_at: completedAt, update_content: content } : s
      )
    );
    setDoneModal(null);
  };

  const getStatusBadge = (status: string) => {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING;
    const label = t(`list.status.${status}` as Parameters<typeof t>[0]);
    const isDone = status === 'DONE';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${style}`}
      >
        {isDone && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
        {label}
      </span>
    );
  };

  return (
    <>
      {/* Lightbox */}
      {lightboxUrl && (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      {/* Delete confirmation modal — même design que Mises à jour */}
      {deleteTarget && (
        <DeleteConfirmModal
          open
          headline={t('deleteModal.headline')}
          titleId="delete-suggestion-title"
          descId="delete-suggestion-desc"
          preview={{ label: t('deleteModal.previewLabel'), title: deleteTarget.title }}
          confirming={deleting === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        >
          <p>
            {t('deleteModal.bodyBefore')}
            <strong className="text-slate-800 dark:text-zinc-200">{t('deleteModal.bodyStrong')}</strong>
            {t('deleteModal.bodyAfter')}
          </p>
        </DeleteConfirmModal>
      )}

      {/* DONE publication modal */}
      {doneModal && (
        <DoneModal
          suggestion={doneModal}
          onClose={() => setDoneModal(null)}
          onPublished={handleDonePublished}
          locale={locale}
        />
      )}

      {isAdmin && adminDetailUserId ? (
        <AdminClientDetailSheet
          clientId={adminDetailUserId}
          establishmentLabel={adminDetailEstablishmentLabel}
          onClose={() => {
            setAdminDetailUserId(null);
            setAdminDetailEstablishmentLabel(null);
          }}
        />
      ) : null}

      <div className="px-4 sm:px-6 md:px-8 py-6 space-y-8 max-w-[1600px] mx-auto">
        <header>
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-zinc-100 tracking-tight">
            {t('page.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">{t('page.intro')}</p>
        </header>

        {/* Submission form */}
        <section className="mx-4 sm:mx-0 rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] p-6 transition-colors duration-200">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
            <div>
              <label
                htmlFor="suggestion-title"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {t('form.titleLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  id="suggestion-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('form.placeholderTitle')}
                  maxLength={200}
                  className="flex-1 px-4 py-3 min-h-[44px] rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/50 focus:border-primary dark:focus:border-indigo-500/50 transition-all duration-200"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <button
                  type="button"
                  onClick={handleCameraClick}
                  disabled={suggestingTitle}
                  title={t('list.attachPhotoTitle')}
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-slate-50 dark:bg-[#09090b] text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-[0.98] transition-transform disabled:opacity-50 transition-colors"
                >
                  {suggestingTitle ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                </button>
              </div>
              {imagePreview && (
                <div className="relative mt-2 inline-block">
                  <Image
                    src={imagePreview}
                    alt={t('list.attachmentAlt')}
                    width={80}
                    height={80}
                    className="h-20 w-auto max-w-full rounded-xl border border-slate-200 dark:border-slate-700 object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    aria-label={t('list.removePhotoAria')}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            <div>
              <label
                htmlFor="suggestion-description"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {t('form.descriptionLabel')}
              </label>
              <div className="relative">
                <textarea
                  id="suggestion-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('form.placeholderDescription')}
                  rows={5}
                  className="w-full px-4 py-3 pr-14 min-h-[120px] rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/50 focus:border-primary dark:focus:border-indigo-500/50 resize-none transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={handleMicToggle}
                  disabled={transcribing}
                  title={t('list.micRecordTitle')}
                  className={`absolute right-2 bottom-2 p-2 rounded-lg transition-colors ${
                    recording
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 animate-pulse'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/5'
                  } disabled:opacity-50`}
                >
                  {transcribing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] py-3 px-6 rounded-2xl font-semibold text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-transform duration-200"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('form.submitting')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('form.submitLabel')}
                </>
              )}
            </button>
          </form>
        </section>

        {/* Suggestions list */}
        <section className="mx-4 sm:mx-0 rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] overflow-hidden transition-colors duration-200">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-zinc-100">
              {t('list.communityWall')}
            </h2>
            {isAdmin && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-400/20 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                {t('list.adminModeBadge')}
              </span>
            )}
          </div>
          <div className="p-6">
            {loading ? (
              <ul className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <li
                    key={i}
                    className="p-5 rounded-2xl bg-slate-100 dark:bg-slate-800/50 animate-skeleton h-[100px]"
                  />
                ))}
              </ul>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400 py-8">
                {t('list.communityEmpty')}
              </p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestions.map((s) => {
                  const isDone = s.status === 'DONE';
                  const countryCode = resolveAuthorCountryCode(
                    s.author_country_code,
                    s.author_locale,
                    undefined
                  );
                  const flagEmoji = countryCodeToFlagEmoji(countryCode);
                  const storedAuthorName = s.author_full_name?.trim() ?? '';
                  const publicAuthorLabel =
                    publicSuggestionAuthorFirstName(storedAuthorName) ||
                    t('list.authorAnonymous');
                  const regionName = countryCodeToLocalizedRegionName(countryCode, locale);
                  const showRegionLine = Boolean(regionName);
                  const tr = translationById[s.id];
                  const useTr = Boolean(tr && showTranslated[s.id]);
                  const displayTitle = useTr && tr ? tr.title || s.title : s.title;
                  const displayDescription =
                    useTr && tr ? tr.description || s.description : s.description;
                  return (
                    <li
                      key={s.id}
                      className={`p-5 rounded-xl border transition-all duration-200 ${
                        isDone
                          ? 'border-slate-200/80 dark:border-zinc-700/80 bg-slate-50/80 dark:bg-slate-800/20 opacity-90'
                          : 'border-slate-100 dark:border-slate-800 dark:border-white/[0.05] bg-slate-50/50 dark:bg-slate-800/30 shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)]'
                      }`}
                    >
                      <div className="flex gap-4">
                        {/* Upvote */}
                        <button
                          type="button"
                          onClick={() => handleUpvote(s.id)}
                          disabled={!!upvoting}
                          className={`shrink-0 flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors ${
                            s.user_has_upvoted
                              ? 'bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-[#2563eb]'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/5'
                          }`}
                        >
                          {upvoting === s.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <ThumbsUp className="w-5 h-5" />
                          )}
                          <span className="text-xs font-semibold">{s.upvotes_count}</span>
                        </button>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2 mb-2 min-w-0">
                            <span
                              className="text-lg leading-none shrink-0 pt-0.5"
                              title={
                                showRegionLine
                                  ? t('list.authorFromRegion', { region: regionName })
                                  : countryCode
                              }
                              aria-hidden
                            >
                              {flagEmoji}
                            </span>
                            <div className="min-w-0 flex-1">
                              {isAdmin && s.user_id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdminDetailUserId(s.user_id ?? null);
                                    setAdminDetailEstablishmentLabel(
                                      storedAuthorName || s.title || null
                                    );
                                  }}
                                  className="text-left w-full rounded-lg -mx-1 px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40"
                                  aria-label={t('list.adminViewAccountHint')}
                                >
                                  <span className="text-xs font-medium text-slate-700 dark:text-zinc-300 block truncate">
                                    {publicAuthorLabel}
                                  </span>
                                  {showRegionLine ? (
                                    <span className="block text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">
                                      {t('list.authorFromRegion', { region: regionName })}
                                    </span>
                                  ) : null}
                                  <span className="block text-[10px] font-semibold text-violet-600 dark:text-violet-400 mt-1">
                                    {t('list.adminViewAccount')}
                                  </span>
                                </button>
                              ) : (
                                <>
                                  <span className="text-xs font-medium text-slate-600 dark:text-zinc-400 truncate block">
                                    {publicAuthorLabel}
                                  </span>
                                  {showRegionLine ? (
                                    <span className="block text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">
                                      {t('list.authorFromRegion', { region: regionName })}
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                          {/* Image with lightbox */}
                          {s.image_url && (
                            <button
                              type="button"
                              onClick={() => setLightboxUrl(s.image_url!)}
                              className="w-full mb-2 group relative rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
                              title={t('list.enlargeTitle')}
                            >
                              <Image
                                src={s.image_url}
                                alt=""
                                width={400}
                                height={128}
                                className="w-full max-h-32 object-cover border border-slate-200 dark:border-slate-700 group-hover:brightness-90 transition-all"
                                unoptimized
                              />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="px-2 py-1 rounded-md bg-black/50 text-white text-xs backdrop-blur-sm">
                                  {t('list.enlargeLabel')}
                                </span>
                              </div>
                            </button>
                          )}

                          <p
                            className={`font-medium text-slate-900 dark:text-zinc-100 ${
                              isDone ? 'line-through decoration-slate-400 dark:decoration-zinc-500' : ''
                            }`}
                          >
                            {displayTitle}
                          </p>
                          {displayDescription ? (
                            <p
                              className={`text-sm text-slate-600 dark:text-zinc-400 mt-1 line-clamp-3 ${
                                isDone ? 'opacity-75' : ''
                              }`}
                            >
                              {displayDescription}
                            </p>
                          ) : null}

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {!tr ? (
                              <button
                                type="button"
                                onClick={() => void handleTranslate(s.id)}
                                disabled={translateLoadingId === s.id}
                                aria-label={t('list.translateAria')}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                              >
                                {translateLoadingId === s.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Languages className="w-3.5 h-3.5" />
                                )}
                                {translateLoadingId === s.id
                                  ? t('list.translateLoading')
                                  : t('list.translateCta')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowTranslated((prev) => ({
                                    ...prev,
                                    [s.id]: !prev[s.id],
                                  }))
                                }
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                              >
                                {useTr ? t('list.showOriginal') : t('list.showTranslation')}
                              </button>
                            )}
                          </div>

                          {/* Badges + admin controls */}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                            <span>{formatDate(s.created_at, locale)}</span>
                            {getStatusBadge(s.status)}

                            {/* Admin: status selector */}
                            {isAdmin && (
                              <select
                                value={s.status}
                                onChange={(e) => handleStatusChange(s.id, e.target.value)}
                                disabled={!!statusUpdating || !!deleting}
                                className="ml-auto px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 disabled:opacity-50"
                              >
                                <option value="PENDING">{t('list.status.PENDING')}</option>
                                <option value="IN_PROGRESS">{t('list.status.IN_PROGRESS')}</option>
                                <option value="DONE">{t('list.status.DONE')}</option>
                              </select>
                            )}

                            {/* Admin: delete button */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDelete(s.id, s.title)}
                                disabled={deleting === s.id}
                                title={t('list.deleteSuggestionTitle')}
                                className="p-1.5 rounded-lg text-rose-500/70 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-40 transition-colors"
                              >
                                {deleting === s.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
