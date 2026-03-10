'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Loader2, Mic, Camera, Send, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

type AppSuggestion = {
  id: string;
  title: string;
  description: string;
  status: string;
  upvotes_count: number;
  created_at: string;
  user_has_upvoted: boolean;
  image_url?: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400',
  DONE: 'bg-emerald-500/10 text-emerald-400',
};

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SuggestionsPage() {
  const t = useTranslations('Suggestions');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<AppSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [suggestingTitle, setSuggestingTitle] = useState(false);
  const [upvoting, setUpvoting] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const fetchSuggestions = () => {
    fetch('/api/app-suggestions')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Erreur');
        return data.suggestions ?? [];
      })
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

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
          body: JSON.stringify({ title: title.trim(), description: description.trim() }),
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
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
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
          if (!res.ok) throw new Error(data.error ?? 'Erreur transcription');
          setDescription((prev) => prev + (prev ? '\n' : '') + (data.transcript ?? '').trim());
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Erreur transcription');
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    }).catch(() => toast.error('Micro non accessible'));
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

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
      if (!res.ok) throw new Error(data.error ?? 'Erreur analyse');
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
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                upvotes_count: data.upvotes_count ?? (s.user_has_upvoted ? s.upvotes_count - 1 : s.upvotes_count + 1),
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

  const getStatusBadge = (status: string) => {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING;
    const label = t(`list.status.${status}` as Parameters<typeof t>[0]);
    return <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${style}`}>{label}</span>;
  };

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-8 max-w-[1600px] mx-auto">
      <header>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-zinc-100 tracking-tight">
          {t('page.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          {t('page.intro')}
        </p>
      </header>

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
                className="flex-1 px-4 py-3 min-h-[44px] rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-indigo-500/50 focus:border-blue-500 dark:focus:border-indigo-500/50 transition-all duration-200"
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
                title="Joindre une photo (optionnel)"
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Photo jointe"
                  className="h-20 w-auto rounded-xl border border-slate-200 dark:border-slate-700 object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  aria-label="Retirer la photo"
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
                className="w-full px-4 py-3 pr-14 min-h-[120px] rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-indigo-500/50 focus:border-blue-500 dark:focus:border-indigo-500/50 resize-none transition-all duration-200"
              />
              <button
                type="button"
                onClick={handleMicToggle}
                disabled={transcribing}
                title="Cliquer pour enregistrer un vocal (Whisper)"
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
            className="inline-flex items-center justify-center gap-2 min-h-[44px] py-3 px-6 rounded-2xl font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-transform duration-200"
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

      <section className="mx-4 sm:mx-0 rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] overflow-hidden transition-colors duration-200">
        <h2 className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800/50 font-semibold text-slate-900 dark:text-zinc-100">
          {t('list.communityWall')}
        </h2>
        <div className="p-6">
          {loading ? (
            <ul className="space-y-4">
              {[1, 2, 3].map((i) => (
                <li key={i} className="p-5 rounded-2xl bg-slate-100 dark:bg-slate-800/50 animate-skeleton h-[100px]" />
              ))}
            </ul>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400 py-8">
              {t('list.communityEmpty')}
            </p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestions.map((s) => (
                <li
                  key={s.id}
                  className="p-5 rounded-xl border border-slate-100 dark:border-slate-800 dark:border-white/[0.05] bg-slate-50/50 dark:bg-slate-800/30 shadow-[4px_6px_0_rgba(0,0,0,0.04)] dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] transition-colors duration-200"
                >
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => handleUpvote(s.id)}
                      disabled={!!upvoting}
                      className={`shrink-0 flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors ${
                        s.user_has_upvoted
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
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
                    <div className="min-w-0 flex-1">
                      {s.image_url && (
                        <Image
                          src={s.image_url}
                          alt=""
                          width={400}
                          height={128}
                          className="mb-2 w-full max-h-32 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                          unoptimized
                        />
                      )}
                      <p className="font-medium text-slate-900 dark:text-zinc-100">{s.title}</p>
                      {s.description && (
                        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1 line-clamp-3">
                          {s.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-1000">
                        <span>{formatDate(s.created_at)}</span>
                        {getStatusBadge(s.status)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
