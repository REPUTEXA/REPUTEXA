'use client';

import { useState, useRef, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

const WELCOME = "Bonjour ! Je suis l'assistant REPUTEXA. Comment puis-je vous aider ? Posez-moi une question sur nos tarifs, la protection de votre réputation en ligne ou l'essai gratuit de 14 jours.";

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: text },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');

      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Désolé, une erreur s'est produite. Réessayez ou contactez-nous directement." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Bouton flottant - fond fixe sombre */}
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

      {/* Fenêtre de chat - fond fixe sombre (ne change pas au scroll) */}
      <div
        className={`fixed bottom-24 right-6 z-[99] flex h-[480px] w-[380px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1729] shadow-glow transition-all duration-300 ${
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.05] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20 shadow-[0_0_15px_-3px_rgba(99,102,241,0.5)]">
            <span className="text-sm font-bold text-indigo-400">R</span>
          </div>
          <div>
            <p className="font-semibold text-white">REPUTEXA</p>
            <p className="text-xs text-zinc-500">Support</p>
          </div>
        </div>

        {/* Messages */}
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
              <div className="rounded-2xl bg-white/[0.08] border border-white/10 px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" aria-hidden />
              </div>
            </div>
          )}
        </div>

        {/* CTA fixe en bas des messages si pertinent */}
        <div className="border-t border-white/10 bg-white/[0.03] px-4 py-2">
          <Link
            href="/signup?mode=trial"
            className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-indigo-500/30 py-2 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/40"
          >
            14 jours d&apos;essai gratuit
          </Link>
        </div>

        {/* Input */}
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
