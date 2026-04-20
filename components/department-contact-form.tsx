'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  Mail,
  Send,
  CheckCircle2,
  Paperclip,
  X,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type SelectOption = { value: string; label: string };

export type ExtraField =
  | {
      id: string;
      label: string;
      type: 'text' | 'url';
      placeholder?: string;
      required?: boolean;
    }
  | {
      id: string;
      label: string;
      type: 'select';
      placeholder?: string;
      required?: boolean;
      options: SelectOption[];
    };

export type DepartmentContactFormProps = {
  /** API department key — must match DEPARTMENT_EMAILS in the route */
  department: 'investors' | 'careers' | 'legal';
  /** Display alias shown in the card header */
  recipientEmail: string;
  /** Card heading */
  heading: string;
  /** Subtitle below the heading */
  description: string;
  /** Label for the team that will reply, e.g. "Notre équipe Investisseurs" */
  teamLabel?: string;
  /** Additional fields rendered between email and message */
  extraFields?: ExtraField[];
  /** Allow file attachments (PDF, DOC, images). Intended for careers forms. */
  allowAttachments?: boolean;
  attachmentLabel?: string;
  messagePlaceholder?: string;
  /** Label shown on the submit button */
  submitLabel?: string;
};

/* ─── Input class helpers ────────────────────────────────────────────────── */

const INPUT_BASE =
  'w-full px-4 py-2.5 rounded-xl border border-white/10 bg-slate-800/60 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 focus:border-[#2563eb] transition-colors text-sm';

const LABEL_BASE = 'block text-sm font-medium text-gray-300 mb-1.5';

const ALLOWED_ATTACHMENT_TYPES =
  '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp';

const MAX_FILES = 3;
const MAX_FILE_SIZE_MB = 10;

type FilePreview = { file: File; id: string };

/* ─── Success screen ─────────────────────────────────────────────────────── */

function SuccessScreen({
  teamLabel,
  onReset,
}: {
  teamLabel: string;
  onReset: () => void;
}) {
  const t = useTranslations('DepartmentContactForm');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } flex flex-col items-center justify-center py-14 px-6 text-center`}
    >
      {/* Animated ring + icon */}
      <div className="relative flex h-24 w-24 items-center justify-center mb-7">
        <span
          className="absolute inset-0 rounded-full bg-emerald-500/20"
          style={{
            animation: 'ping 0.7s cubic-bezier(0, 0, 0.2, 1) 1 forwards',
          }}
        />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/30">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
      </div>

      <h3 className="font-display text-xl font-bold text-white mb-2">{t('successTitle')}</h3>
      <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
        {t('successBody', { teamLabel })}
      </p>

      <button
        type="button"
        onClick={onReset}
        className="mt-8 text-sm font-medium text-[#2563eb] hover:underline underline-offset-2 transition-colors"
      >
        {t('successResetCta')}
      </button>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export function DepartmentContactForm({
  department,
  recipientEmail,
  heading,
  description,
  teamLabel = 'REPUTEXA',
  extraFields = [],
  allowAttachments = false,
  attachmentLabel = 'Attachments (optional)',
  messagePlaceholder = 'Describe your request in detail…',
  submitLabel = 'Send message',
}: DepartmentContactFormProps) {
  const t = useTranslations('DepartmentContactForm');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const setExtra = useCallback((id: string, value: string) => {
    setExtraValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => {
      const next = [...prev];
      for (const f of selected) {
        if (next.length >= MAX_FILES) break;
        if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          toast.error(t('toastFileTooBig', { name: f.name, maxMb: MAX_FILE_SIZE_MB }));
          continue;
        }
        if (!next.some((p) => p.file.name === f.name && p.file.size === f.size)) {
          next.push({ file: f, id: crypto.randomUUID() });
        }
      }
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [t]);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer?.files ?? []);
    setFiles((prev) => {
      const next = [...prev];
      for (const f of dropped) {
        if (next.length >= MAX_FILES) break;
        if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) continue;
        if (!next.some((p) => p.file.name === f.name && p.file.size === f.size)) {
          next.push({ file: f, id: crypto.randomUUID() });
        }
      }
      return next;
    });
  }, []);

  const reset = () => {
    setSent(false);
    setName('');
    setEmail('');
    setMessage('');
    setExtraValues({});
    setFiles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Required field validation
    const requiredExtras = extraFields.filter((f) => f.required !== false);
    for (const field of requiredExtras) {
      if (!extraValues[field.id]?.trim()) {
        toast.error(t('toastFieldRequired', { field: field.label }));
        return;
      }
    }

    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error(t('toastAllRequired'));
      return;
    }

    setSending(true);
    try {
      // Build labels map for the API
      const extraLabelled: Record<string, string> = {};
      for (const field of extraFields) {
        const val = extraValues[field.id]?.trim();
        if (val) extraLabelled[field.label] = val;
      }

      const form = new FormData();
      form.append('name', name.trim());
      form.append('email', email.trim());
      form.append('message', message.trim());
      form.append('department', department);
      form.append('extraFields', JSON.stringify(extraLabelled));
      files.forEach(({ file }) => form.append('files', file));

      const res = await fetch('/api/contact/department', {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : t('toastGenericError'));
        return;
      }

      setSent(true);
    } catch {
      toast.error(t('toastNetworkError', { email: recipientEmail }));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10 bg-white/5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563eb]/20">
          <Mail className="h-5 w-5 text-[#2563eb]" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-400">{heading}</p>
          <span className="font-semibold text-white text-sm">
            {recipientEmail}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="px-6 pt-5 pb-0">
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>

      {/* Body — form or success */}
      <div className="px-6 py-6">
        {sent ? (
          <SuccessScreen teamLabel={teamLabel} onReset={reset} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className={LABEL_BASE}>
                {t('labelFullName')} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={t('placeholderFullName')}
                className={INPUT_BASE}
              />
            </div>

            {/* Email */}
            <div>
              <label className={LABEL_BASE}>
                {t('labelWorkEmail')} <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t('placeholderEmail')}
                className={INPUT_BASE}
              />
            </div>

            {/* Extra fields */}
            {extraFields.map((field) => (
              <div key={field.id}>
                <label className={LABEL_BASE}>
                  {field.label}
                  {field.required !== false && <span className="text-red-400 ml-1">*</span>}
                </label>
                {field.type === 'select' ? (
                  <div className="relative">
                    <select
                      value={extraValues[field.id] ?? ''}
                      onChange={(e) => setExtra(field.id, e.target.value)}
                      required={field.required !== false}
                      className={`${INPUT_BASE} appearance-none pr-10 cursor-pointer`}
                    >
                      <option value="" disabled>
                        {field.placeholder ?? t('selectPlaceholder')}
                      </option>
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                ) : (
                  <input
                    type={field.type}
                    value={extraValues[field.id] ?? ''}
                    onChange={(e) => setExtra(field.id, e.target.value)}
                    required={field.required !== false}
                    placeholder={field.placeholder}
                    className={INPUT_BASE}
                  />
                )}
              </div>
            ))}

            {/* Message */}
            <div>
              <label className={LABEL_BASE}>
                {t('labelMessage')} <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                placeholder={messagePlaceholder}
                className={`${INPUT_BASE} resize-none`}
              />
            </div>

            {/* Attachments (careers only) */}
            {allowAttachments && (
              <div>
                <label className={LABEL_BASE}>{attachmentLabel}</label>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="rounded-xl border-2 border-dashed border-white/10 bg-white/5 p-4 hover:border-[#2563eb]/40 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_ATTACHMENT_TYPES}
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 transition-colors text-sm"
                    >
                      <Paperclip className="w-4 h-4" />
                      {t('attachmentCvButton')}
                    </button>
                    <span className="text-xs text-gray-500">
                      {t('attachmentHint', { maxFiles: MAX_FILES, maxMb: MAX_FILE_SIZE_MB })}
                    </span>
                  </div>
                  {files.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2 justify-center">
                      {files.map(({ file, id }) => (
                        <li
                          key={id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#2563eb]" />
                          <span className="text-xs text-gray-300 truncate max-w-[140px]">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(id)}
                            className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                            aria-label={t('ariaRemoveFile')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none active:scale-[0.98]"
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('sending')}
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  {submitLabel}
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
