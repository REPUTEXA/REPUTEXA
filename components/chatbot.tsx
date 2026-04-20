'use client';

import { useState, useRef, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { X, Send, Sparkles } from 'lucide-react';
import { scrubAiTypography } from '@/lib/ai/human-keyboard-output';

type Message = { role: 'user' | 'assistant'; content: string };

export function Chatbot() {
  const locale = useLocale();
  const t = useTranslations('Chatbot');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: t('welcome') }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{ role: 'assistant', content: t('welcome') }]);
  }, [locale, t]);

  const userMessageCount = messages.filter((m) => m.role === 'user').length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingContent, open]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input.trim()).trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    setStreamingContent('');

    const fullMessages: Message[] = [...messages, { role: 'user', content: text }];

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: fullMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
          userMessageCount: userMessageCount + 1,
          locale,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : t('errorFetch'));
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          full += chunk;
          setStreamingContent(scrubAiTypography(full));
        }
      }

      const assistantText = full ? scrubAiTypography(full) : t('noResponse');
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantText }]);
      setStreamingContent('');
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('errorSorry') }]);
    } finally {
      setLoading(false);
    }
  };

  const qr = [t('quickReply0'), t('quickReply1'), t('quickReply2'), t('quickReply3')];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-4 sm:bottom-8 sm:right-6 z-[199] group flex items-center gap-3 rounded-full border border-indigo-400/50 bg-gradient-to-r from-[#0f1729] to-[#151f3a] py-3 pl-4 pr-4 sm:pr-5 shadow-[0_8px_40px_-8px_rgba(99,102,241,0.65),0_0_0_1px_rgba(255,255,255,0.06)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_12px_48px_-8px_rgba(99,102,241,0.75)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1a] max-w-[calc(100vw-1.5rem)]"
          aria-label={t('openChat')}
          aria-expanded={false}
        >
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
            <span
              className="absolute inset-0 rounded-full bg-indigo-500/35 opacity-75 animate-ping motion-reduce:animate-none"
              style={{ animationDuration: '2.2s' }}
              aria-hidden
            />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500 ring-2 ring-indigo-300/50">
              <Sparkles className="h-5 w-5 text-white" aria-hidden />
            </span>
          </span>
          <span className="hidden min-[400px]:flex flex-col items-start text-left pr-1">
            <span className="text-sm font-bold tracking-tight text-white leading-tight">{t('launcherTitle')}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-200/90">
              {t('launcherSubtitle')}
            </span>
          </span>
        </button>
      )}

      <div
        className={`fixed bottom-5 right-4 sm:bottom-8 sm:right-6 z-[199] flex h-[min(580px,calc(100vh-8rem))] w-[min(100vw-1.5rem,420px)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0c1224] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(99,102,241,0.12)] transition-all duration-300 ${
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
        }`}
        aria-hidden={!open}
        role="dialog"
        aria-modal={open ? true : undefined}
        aria-label={t('dialogLabel')}
      >
        <div className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-indigo-600/25 to-transparent px-4 py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/30 ring-1 ring-indigo-400/40">
              <Sparkles className="h-5 w-5 text-indigo-200" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm tracking-tight">{t('brandName')}</p>
              <p className="text-xs text-indigo-200/95">{t('headerSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1224]"
            aria-label={t('closeChat')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-2.5 ${
                  m.role === 'user'
                    ? 'bg-indigo-600/40 text-white border border-indigo-400/25'
                    : 'bg-white/[0.07] text-zinc-100 border border-white/10'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              {streamingContent ? (
                <div className="max-w-[88%] rounded-2xl bg-white/[0.07] border border-white/10 px-4 py-2.5">
                  <p className="text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">{streamingContent}</p>
                </div>
              ) : (
                <div className="rounded-2xl bg-white/[0.07] border border-white/10 px-4 py-2.5">
                  <span className="inline-flex items-center gap-1 text-sm text-zinc-400">
                    {t('thinking')}
                    <span className="inline-flex gap-0.5">
                      <span className="chat-typing-dot" style={{ animationDelay: '0ms' }}>.</span>
                      <span className="chat-typing-dot" style={{ animationDelay: '0.2s' }}>.</span>
                      <span className="chat-typing-dot" style={{ animationDelay: '0.4s' }}>.</span>
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 bg-white/[0.04] px-4 py-2 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {qr.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                disabled={loading}
                className="rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/12 px-3 py-1.5 text-[11px] sm:text-xs text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left max-w-full"
              >
                {q}
              </button>
            ))}
          </div>
          <Link
            href="/signup?mode=trial"
            className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-white bg-indigo-600/50 hover:bg-indigo-600/65 border border-indigo-400/35 transition-all"
          >
            {t('trialCta')}
          </Link>
        </div>

        <div className="border-t border-white/10 p-3 bg-black/20">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('placeholder')}
              className="flex-1 rounded-xl border border-white/12 bg-white/[0.08] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-white transition hover:bg-indigo-500 disabled:opacity-50 shrink-0"
              aria-label={t('send')}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
