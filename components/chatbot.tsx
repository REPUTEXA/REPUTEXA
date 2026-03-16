'use client';

import { useState, useRef, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { MessageCircle, X, Send } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

const WELCOME =
  "Bonjour ! Je suis l'assistant REPUTEXA. Comment puis-je vous aider ? Posez-moi une question sur nos tarifs, la protection de votre réputation en ligne ou l'essai gratuit.";

const QUICK_REPLIES = [
  "Comment marche l'essai gratuit ?",
  'Tarifs Pulse vs Zenith',
  'Comment supprimer un faux avis ?',
];

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const userMessageCount = messages.filter((m) => m.role === 'user').length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingContent]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input.trim()).trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    setStreamingContent('');

    const fullMessages: Message[] = [
      ...messages,
      { role: 'user', content: text },
    ];

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: fullMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
          userMessageCount: userMessageCount + 1,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Erreur');
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
          setStreamingContent(full);
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: full || "Désolé, pas de réponse." }]);
      setStreamingContent('');
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Désolé, une erreur s'est produite. Réessayez ou contactez-nous directement.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#0f1729] shadow-[0_0_30px_-5px_rgba(99,102,241,0.6)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_-5px_rgba(99,102,241,0.7)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0f1729]"
        aria-label={open ? 'Fermer le chat' : 'Ouvrir le chat'}
      >
        {open ? (
          <X className="h-6 w-6 text-white" aria-hidden />
        ) : (
          <MessageCircle className="h-6 w-6 text-indigo-400" aria-hidden />
        )}
      </button>

      <div
        className={`fixed bottom-24 right-6 z-[99] flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1729] shadow-glow transition-all duration-300 ${
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.05] px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 ring-2 ring-indigo-400/30 shadow-[0_0_15px_-3px_rgba(99,102,241,0.5)]">
            <span className="text-sm font-bold text-indigo-400">R</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white uppercase">REPUTEXA</p>
            <p className="text-xs font-medium text-indigo-400/90">Expert REPUTEXA</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  m.role === 'user'
                    ? 'bg-indigo-500/30 text-white'
                    : 'bg-white/[0.08] text-zinc-200 border border-white/10'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              {streamingContent ? (
                <div className="max-w-[85%] rounded-2xl bg-white/[0.08] border border-white/10 px-4 py-2.5">
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap">{streamingContent}</p>
                </div>
              ) : (
                <div className="rounded-2xl bg-white/[0.08] border border-white/10 px-4 py-2.5">
                  <span className="inline-flex items-center gap-1 text-sm text-zinc-400">
                    L&apos;assistant écrit
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

        <div className="border-t border-white/10 bg-white/[0.03] px-4 py-2 flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                disabled={loading}
                className="rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {q}
              </button>
            ))}
          </div>
          <Link
            href="/signup?mode=trial"
            className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold text-white bg-indigo-500/40 hover:bg-indigo-500/50 border border-indigo-400/30 transition-all shiny-button-chat"
          >
            14 jours d&apos;essai gratuit
          </Link>
        </div>

        <div className="border-t border-white/10 p-3">
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
              placeholder="Votre question..."
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.08] px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-indigo-500 px-3 py-2.5 text-white transition hover:bg-indigo-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
