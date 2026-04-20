'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ImagePlus, Loader2, Pencil, Trash2, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '@/components/dashboard/delete-confirm-modal';
import {
  normalizeAttachments as normalizeAttachmentsImpl,
  type UpdateAttachment,
} from '@/lib/updates/normalize-attachments';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

const DELETE_UPDATE_MODAL_TITLE_ID = 'delete-update-title';
const DELETE_UPDATE_MODAL_DESC_ID = 'delete-update-desc';

export type { UpdateAttachment };

export type Update = {
  id: string;
  title: string;
  content?: string | null;
  attachments?: UpdateAttachment[];
  completedAt: string;
  /** ISO — communiqués manuels : instant de visibilité publique (peut être futur pour l’admin). */
  publishAt?: string;
  source: 'suggestion' | 'manual';
};

export function normalizeAttachments(raw: unknown): UpdateAttachment[] {
  return normalizeAttachmentsImpl(raw);
}

export function UpdateAttachmentsMedia({ items }: { items: UpdateAttachment[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 flex flex-col gap-3">
      {items.map((a, idx) => (
        <div
          key={`${a.url}-${idx}`}
          className="rounded-xl border border-slate-200/80 dark:border-zinc-700 overflow-hidden bg-slate-50/50 dark:bg-zinc-950/40"
        >
          {a.type === 'image' ? (
            <Image
              src={a.url}
              alt=""
              width={800}
              height={288}
              className="max-h-72 w-full object-contain"
              sizes="(max-width: 768px) 100vw, 800px"
              loading="lazy"
              unoptimized
            />
          ) : (
            <video src={a.url} controls className="max-h-72 w-full" preload="metadata" />
          )}
        </div>
      ))}
    </div>
  );
}

type Props = {
  updates: Update[];
  locale: string;
  /** Affiche Modifier / Supprimer sur les communiqués manuels */
  isAdmin?: boolean;
};

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(siteLocaleToIntlDateTag(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(siteLocaleToIntlDateTag(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function UpdatesList({ updates, locale, isAdmin = false }: Props) {
  const tu = useTranslations('Dashboard.updatesList');
  const dashboardLocale = useLocale();
  const router = useRouter();
  const editMediaInputRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editAttachments, setEditAttachments] = useState<UpdateAttachment[]>([]);
  const [editMediaUploading, setEditMediaUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /** Modale de confirmation suppression */
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const closeDeleteModal = useCallback(() => {
    if (deletingId) return;
    setDeleteTarget(null);
  }, [deletingId]);

  const startEdit = (u: Update) => {
    setEditingId(u.id);
    setEditTitle(u.title);
    setEditContent(u.content ?? '');
    setEditAttachments(normalizeAttachments(u.attachments));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditAttachments([]);
  };

  const uploadEditMedia = async (files: FileList | null) => {
    if (!files?.length) return;
    setEditMediaUploading(true);
    try {
      let next = [...editAttachments];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/updates/upload', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? tu('errUploadFallback'));
        next = [...next, { url: data.url as string, type: data.type as 'image' | 'video' }];
      }
      setEditAttachments(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tu('toastUploadErr'));
    } finally {
      setEditMediaUploading(false);
      if (editMediaInputRef.current) editMediaInputRef.current.value = '';
    }
  };

  const saveEdit = async (id: string) => {
    const title = editTitle.trim();
    const content = editContent.trim();
    if (!title || !content) {
      toast.error(tu('toastTitleContentRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/updates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title,
          content,
          attachments: editAttachments,
          source_locale: dashboardLocale,
        }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? tu('errGenericFallback'));
      toast.success(tu('toastSaved'));
      cancelEdit();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tu('toastSaveErr'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/updates?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? tu('errGenericFallback'));
      toast.success(tu('toastDeleted'));
      setDeleteTarget(null);
      if (editingId === id) cancelEdit();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tu('toastDeleteErr'));
    } finally {
      setDeletingId(null);
    }
  };

  const nowMs = Date.now();

  if (updates.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          {tu('empty')}
        </p>
      </div>
    );
  }

  return (
    <>
      {deleteTarget && (
        <DeleteConfirmModal
          open
          headline={tu('deleteHeadline')}
          titleId={DELETE_UPDATE_MODAL_TITLE_ID}
          descId={DELETE_UPDATE_MODAL_DESC_ID}
          preview={{ label: tu('deletePreviewLabel'), title: deleteTarget.title }}
          confirming={!!deletingId}
          onCancel={closeDeleteModal}
          onConfirm={confirmDelete}
        >
          <p>{tu('deleteBody')}</p>
        </DeleteConfirmModal>
      )}

    <ul className="space-y-4">
      {updates.map((u) => {
        const publishIso = u.source === 'manual' ? (u.publishAt ?? u.completedAt) : u.completedAt;
        const isScheduledManual =
          u.source === 'manual' && isAdmin && new Date(publishIso).getTime() > nowMs;

        return (
        <li
          key={`${u.source}-${u.id}`}
          className="rounded-xl border border-slate-200/80 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] p-5 sm:p-6 shadow-[2px_2px_0_rgba(0,0,0,0.03)] dark:shadow-[2px_2px_0_rgba(0,0,0,0.2)] transition-colors hover:border-slate-300/80 dark:hover:border-zinc-700/50"
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                u.source === 'manual'
                  ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {u.source === 'manual' ? (
                <Zap className="w-4 h-4" strokeWidth={2} />
              ) : (
                <Check className="w-4 h-4" strokeWidth={2.5} />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {u.source === 'manual' && isAdmin && editingId === u.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="font-semibold text-slate-900 dark:text-zinc-100 w-full max-w-md px-3 py-1.5 rounded-lg border border-violet-300 dark:border-violet-700 bg-white dark:bg-zinc-900 text-sm"
                    maxLength={200}
                  />
                ) : (
                  <p className="font-semibold text-slate-900 dark:text-zinc-100">{u.title}</p>
                )}

                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {u.source === 'manual' && isAdmin && editingId !== u.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-violet-700 dark:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-400/20 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {tu('editLabel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: u.id, title: u.title })}
                        disabled={deletingId === u.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-700 dark:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-400/20 transition-colors disabled:opacity-50"
                      >
                        {deletingId === u.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        {tu('deleteLabel')}
                      </button>
                    </>
                  )}
                  {isScheduledManual ? (
                    <span className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 inline-flex flex-col items-end gap-0.5">
                      <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                        {tu('scheduledWithDate', { date: formatDateTime(publishIso, locale) })}
                      </span>
                    </span>
                  ) : (
                    <time className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                      {formatDate(u.completedAt, locale)}
                    </time>
                  )}
                </div>
              </div>

              {u.source === 'manual' && isAdmin && editingId === u.id ? (
                <div className="mt-3 space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 leading-relaxed resize-y min-h-[120px]"
                  />
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-zinc-400 mb-2">{tu('editMediaHeading')}</p>
                    <input
                      ref={editMediaInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={(e) => uploadEditMedia(e.target.files)}
                    />
                    <div className="flex flex-wrap gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => editMediaInputRef.current?.click()}
                        disabled={editMediaUploading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
                      >
                        {editMediaUploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="w-3.5 h-3.5" />
                        )}
                        {tu('addMedia')}
                      </button>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 self-center">
                        {tu('mediaCountAdmin', { count: editAttachments.length })}
                      </span>
                    </div>
                    {editAttachments.length > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {editAttachments.map((a, i) => (
                          <li
                            key={`${a.url}-${i}`}
                            className="relative group rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden w-24 h-24 bg-slate-100 dark:bg-zinc-900"
                          >
                            {a.type === 'image' ? (
                              <Image
                                src={a.url}
                                alt=""
                                width={96}
                                height={96}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-center px-1 text-slate-500">
                                {tu('video')}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditAttachments((prev) => prev.filter((_, j) => j !== i))}
                              className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label={tu('removeAttachmentAria')}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(u.id)}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {tu('save')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    >
                      {tu('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {u.content && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                      {u.content}
                    </p>
                  )}
                  {u.source === 'manual' && u.attachments && u.attachments.length > 0 ? (
                    <UpdateAttachmentsMedia items={u.attachments} />
                  ) : null}

                  {!u.content && (
                    <p className="mt-1.5 text-sm text-slate-500 dark:text-zinc-400">
                      {tu('noContentFallback', { title: u.title })}
                    </p>
                  )}
                </>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${
                    u.source === 'manual'
                      ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-400/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-400/20'
                  }`}
                >
                  {u.source === 'manual' ? tu('badgeManual') : tu('badgeSuggestion')}
                </span>
              </div>
            </div>
          </div>
        </li>
        );
      })}
    </ul>
    </>
  );
}
