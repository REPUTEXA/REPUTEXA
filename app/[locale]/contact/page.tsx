'use client';

import { useState, useRef, useCallback } from 'react';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import {
  Loader2,
  Mail,
  Send,
  Paperclip,
  X,
  Mic,
  Square,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';

const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 25;
const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_VIDEO_EXT = ['.mp4', '.webm', '.mov', '.avi'];

type FilePreview = {
  file: File;
  id: string;
};

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const allowed = [...ALLOWED_IMAGE_EXT, ...ALLOWED_VIDEO_EXT];
    const valid = selected.filter((f) => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return allowed.includes(ext) && f.size <= MAX_FILE_SIZE_MB * 1024 * 1024;
    });

    setFiles((prev) => {
      const next = [...prev];
      for (const f of valid) {
        if (next.length >= MAX_FILES) break;
        if (next.some((p) => p.file === f)) continue;
        next.push({ file: f, id: crypto.randomUUID() });
      }
      return next;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = Array.from(e.dataTransfer?.files ?? []);
      if (dropped.length === 0) return;
      const allowed = [...ALLOWED_IMAGE_EXT, ...ALLOWED_VIDEO_EXT];
      const valid = dropped.filter((f) => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        return allowed.includes(ext) && f.size <= MAX_FILE_SIZE_MB * 1024 * 1024;
      });
      setFiles((prev) => {
        const next = [...prev];
        for (const f of valid) {
          if (next.length >= MAX_FILES) break;
          if (next.some((p) => p.file.name === f.name && p.file.size === f.size)) continue;
          next.push({ file: f, id: crypto.randomUUID() });
        }
        return next;
      });
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) return;

        setTranscribing(true);
        try {
          const form = new FormData();
          form.append('audio', blob, 'voix.webm');
          const res = await fetch('/api/contact/transcribe', {
            method: 'POST',
            body: form,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            toast.error(data.error ?? 'Erreur de transcription');
            return;
          }
          const text = String(data.text ?? '').trim();
          if (text) {
            setMessage((prev) => (prev ? `${prev}\n\n${text}` : text));
            toast.success('Texte transcrit et ajouté au message.');
          } else {
            toast.info('Aucun texte détecté dans l\'enregistrement.');
          }
        } catch {
          toast.error('Erreur lors de la transcription.');
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error('Microphone inaccessible. Autorisez l\'accès au micro.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setRecording(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast.error('Tous les champs sont obligatoires.');
      return;
    }
    setSending(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('email', email.trim());
      form.append('subject', subject.trim());
      form.append('message', message.trim());
      files.forEach(({ file }) => form.append('files', file));

      const res = await fetch('/api/contact', {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error ?? 'Une erreur est survenue.');
        return;
      }

      toast.success('Votre message a bien été envoyé. Nous vous répondrons rapidement.');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setFiles([]);
    } catch {
      toast.error('Erreur réseau. Réessayez ou contactez-nous à contact@reputexa.fr.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-800 dark:text-slate-100" aria-label="REPUTEXA">
            <Logo />
            <span className="font-display font-bold text-lg uppercase">REPUTEXA</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/legal"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] font-medium transition-colors"
            >
              Mentions légales
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] font-medium transition-colors"
            >
              Confidentialité
            </Link>
            <Link
              href="/terms"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] font-medium transition-colors"
            >
              CGV
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
            Support & Contact
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Une question, un problème technique ou une demande de partenariat ? Nous répondons sous 24h.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)' }}
            >
              <Mail className="h-5 w-5" style={{ color: '#2563eb' }} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Email direct</p>
              <a
                href="mailto:contact@reputexa.fr"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100 hover:text-[#2563eb] transition-colors"
              >
                contact@reputexa.fr
              </a>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="contact-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Nom
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jean Dupont"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="contact-email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vous@exemple.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="contact-subject"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Sujet
              </label>
              <input
                id="contact-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="Support, facturation, partenariat..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="contact-message"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Message
                </label>
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  disabled={transcribing}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    recording
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  {transcribing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : recording ? (
                    <Square className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                  {transcribing ? 'Transcription...' : recording ? 'Arrêter' : 'Dictée vocale'}
                </button>
              </div>
              <textarea
                id="contact-message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                placeholder="Décrivez votre demande..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Pièces jointes (optionnel)
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4 text-center hover:border-[#2563eb]/50 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/x-msvideo"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                    Photos / Vidéos
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Glissez-déposez ou cliquez · max {MAX_FILES} fichiers, {MAX_FILE_SIZE_MB} Mo chacun
                  </span>
                </div>
                {files.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2 justify-center">
                    {files.map(({ file, id }) => (
                      <li
                        key={id}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600"
                      >
                        {file.type.startsWith('image/') ? (
                          <ImageIcon className="w-4 h-4 text-sky-500" />
                        ) : (
                          <Video className="w-4 h-4 text-emerald-500" />
                        )}
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(id)}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500"
                          aria-label="Supprimer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300 disabled:opacity-60 disabled:pointer-events-none hover:brightness-110 active:scale-[0.98]"
              style={{ backgroundColor: '#2563eb' }}
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" aria-hidden="true" />
                  Envoyer mon message
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-700 dark:text-slate-200" aria-label="REPUTEXA">
            <Logo size="sm" />
            <span className="font-display font-bold uppercase">REPUTEXA</span>
          </Link>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} REPUTEXA. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
