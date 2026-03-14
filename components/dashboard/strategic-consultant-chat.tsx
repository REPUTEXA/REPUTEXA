'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import type { PlanSlug } from '@/lib/feature-gate';
import { hasFeature, FEATURES } from '@/lib/feature-gate';

type Message = { role: 'user' | 'assistant'; content: string };

const QUICK_QUESTIONS = [
  'Comment améliorer ma note ?',
  "Besoin d'un conseil équipe",
  'Résumé du mois dernier',
] as const;

type Props = { planSlug: PlanSlug; fullPage?: boolean };

const cardClass =
  'rounded-2xl border border-white/20 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-[0_0_24px_-8px_rgba(59,130,246,0.12)] dark:shadow-[0_0_24px_-8px_rgba(0,0,0,0.3)]';

export function StrategicConsultantChat({ planSlug, fullPage = false }: Props) {
  const canAccess = hasFeature(planSlug, FEATURES.CONSULTANT_CHAT);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/consultant-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.error || 'Erreur de connexion.' },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connexion impossible. Réessayez dans quelques instants.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!canAccess) return null;

  return (
    <section className={fullPage ? 'flex flex-col h-full' : 'space-y-4'}>
      {!fullPage && (
        <div>
          <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <span>💬</span>
            Votre Consultant Stratégique 24/7
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Posez vos questions, l&apos;IA analyse vos avis et rapports pour vous conseiller
          </p>
        </div>
      )}

      <div className={`${cardClass} overflow-hidden flex flex-col ${fullPage ? 'flex-1 min-h-0' : ''}`}>
        {/* Quick questions */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => sendMessage(q)}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat history */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-[200px] max-h-[360px] overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 dark:text-slate-400">
              <Sparkles className="w-10 h-10 mb-2 text-indigo-400/60" />
              <p className="text-sm">Posez votre question ou cliquez sur une suggestion</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-2xl px-4 py-2.5 ${
                  fullPage ? 'max-w-[75%] sm:max-w-[65%]' : 'max-w-[85%]'
                } ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-bl-md'
                }`}
              >
                <p className={`whitespace-pre-wrap leading-relaxed ${fullPage ? 'text-base' : 'text-sm'}`}>{m.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800/80 rounded-2xl rounded-bl-md px-4 py-2.5">
                <span className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">
                  Réflexion en cours…
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex : Quels thèmes reviennent le plus dans mes avis ?"
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Send className="w-4 h-4" />
              Poser la question
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
