'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Archive,
  Loader2,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Inbox,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { SupportVerdictModal } from '@/components/support/support-verdict-modal';
import { AdminStatusDot } from '@/components/admin/admin-help-pastille';

// ── Types ─────────────────────────────────────────────────────────────────────

type Ticket = {
  id: string;
  status: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  gravity_score?: number | null;
};

type ActionBadge = {
  name: string;
  label: string;
  success: boolean;
  icon: string;
};

type ChatMessage = {
  id?: string;
  sender: 'user' | 'ai';
  content: string;
  created_at?: string;
  actions?: ActionBadge[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatShort(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function formatTime(iso: string | undefined, locale: string) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '';
  }
}

function ticketGravityTone(
  score: number | null | undefined,
): 'critical' | 'warn' | 'ok' | 'neutral' {
  const s = score ?? 0;
  if (s >= 70) return 'critical';
  if (s >= 40) return 'warn';
  return 'ok';
}

// ── Agent Thinking Indicator ─────────────────────────────────────────────────

function AgentThinking() {
  const t = useTranslations('Dashboard.support');
  const steps = useMemo(
    () => [
      { icon: '🔍', label: t('thinkingStepSearch') },
      { icon: '⚡', label: t('thinkingStepVerify') },
      { icon: '✍️', label: t('thinkingStepWrite') },
    ],
    [t],
  );
  const [step, setStep] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setStep((s) => (s + 1) % steps.length), 1800);
    return () => clearInterval(iv);
  }, [steps.length]);

  return (
    <div className="flex items-start gap-3">
      {/* Avatar agent */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
        <ShieldCheck className="w-4 h-4 text-white" />
      </div>
      <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white dark:bg-zinc-800/90 border border-slate-200/60 dark:border-zinc-700/50 shadow-sm max-w-xs">
        <div className="flex items-center gap-2">
          <span className="text-sm">{steps[step].icon}</span>
          <span className="text-sm text-slate-500 dark:text-zinc-400 animate-pulse">
            {steps[step].label}
          </span>
        </div>
        <div className="flex gap-1 mt-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Action Badges ─────────────────────────────────────────────────────────────

function ActionBadges({ actions }: { actions: ActionBadge[] }) {
  if (!actions.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {actions.map((a, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
            a.success
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300'
          }`}
        >
          <span>{a.icon}</span>
          <span>{a.label}</span>
          {a.success ? (
            <CheckCircle2 className="w-3 h-3 shrink-0" />
          ) : (
            <XCircle className="w-3 h-3 shrink-0" />
          )}
        </span>
      ))}
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  locale,
  agentLabel,
}: {
  msg: ChatMessage;
  locale: string;
  agentLabel: string;
}) {
  const isUser = msg.sender === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] sm:max-w-[68%]">
          <div className="rounded-2xl rounded-tr-sm px-4 py-3 bg-indigo-600 text-white shadow-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          </div>
          {msg.created_at && (
            <p className="text-right text-[10px] text-slate-400 dark:text-zinc-500 mt-1 pr-1">
              {formatTime(msg.created_at, locale)}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      {/* Avatar agent */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm mt-0.5">
        <ShieldCheck className="w-4 h-4 text-white" />
      </div>
      <div className="max-w-[82%] sm:max-w-[72%]">
        {msg.actions && msg.actions.length > 0 && (
          <ActionBadges actions={msg.actions} />
        )}
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white dark:bg-zinc-800/90 border border-slate-200/60 dark:border-zinc-700/50 shadow-sm">
          <p className="text-sm leading-relaxed text-slate-800 dark:text-zinc-100 whitespace-pre-wrap">
            {msg.content}
          </p>
        </div>
        {msg.created_at && (
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 pl-1">
            {agentLabel}
            {formatTime(msg.created_at, locale)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Ticket Rename Inline ──────────────────────────────────────────────────────

function TicketRenameInput({
  ticketId,
  currentTitle,
  fallback,
  onSaved,
  onCancel,
}: {
  ticketId: string;
  currentTitle: string | null;
  fallback: string;
  onSaved: (newTitle: string | null) => void;
  onCancel: () => void;
}) {
  const tr = useTranslations('Dashboard.support');
  const [value, setValue] = useState(currentTitle ?? '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  async function save() {
    const trimmed = value.trim() || null;
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed ?? '' }),
      });
      if (!res.ok) throw new Error();
      onSaved(trimmed);
    } catch {
      onCancel();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); void save(); }
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => void save()}
        placeholder={fallback}
        maxLength={120}
        className="flex-1 min-w-0 text-xs bg-transparent border-b border-indigo-300 dark:border-indigo-600 outline-none py-0.5 px-0 font-semibold text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
      />
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); void save(); }}
        className="shrink-0 p-0.5 rounded text-indigo-500 hover:text-indigo-700"
        aria-label={tr('confirmRenameAria')}
      >
        <Check className="w-3 h-3" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onCancel(); }}
        className="shrink-0 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
        aria-label={tr('cancelRenameAria')}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SupportAiChat() {
  const t = useTranslations('Dashboard.support');
  const locale = useLocale();
  const [ticketsOpen, setTicketsOpen]         = useState<Ticket[]>([]);
  const [ticketsArchived, setTicketsArchived] = useState<Ticket[]>([]);
  const [activeId, setActiveId]               = useState<string | null>(null);
  const [messages, setMessages]               = useState<ChatMessage[]>([]);
  const [input, setInput]                     = useState('');
  const [loadingList, setLoadingList]         = useState(true);
  const [loadingChat, setLoadingChat]         = useState(false);
  const [sending, setSending]                 = useState(false);
  const [renamingId, setRenamingId]           = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const bootstrapAttemptedRef = useRef<Set<string>>(new Set());
  const [verdictOpen, setVerdictOpen] = useState(false);

  const activeTicket = [...ticketsOpen, ...ticketsArchived].find((x) => x.id === activeId);
  const isArchived   = activeTicket?.status === 'archived';

  // ── Fetch lists ─────────────────────────────────────────────────────────────

  const refreshLists = useCallback(async () => {
    const [openRes, archRes] = await Promise.all([
      fetch('/api/support/tickets?status=open'),
      fetch('/api/support/tickets?status=archived'),
    ]);
    const openJ = await openRes.json() as { tickets?: Ticket[]; error?: string };
    const archJ = await archRes.json() as { tickets?: Ticket[]; error?: string };
    if (!openRes.ok) throw new Error(openJ.error ?? t('fetchListError'));
    if (!archRes.ok) throw new Error(archJ.error ?? t('fetchListError'));
    setTicketsOpen(openJ.tickets ?? []);
    setTicketsArchived(archJ.tickets ?? []);
    return { open: openJ.tickets as Ticket[], archived: archJ.tickets as Ticket[] };
  }, [t]);

  useEffect(() => {
    void (async () => {
      try {
        const { open } = await refreshLists();
        if (open.length > 0) setActiveId(open[0].id);
      } catch {
        toast.error(t('loadError'));
      } finally {
        setLoadingList(false);
      }
    })();
  }, [refreshLists, t]);

  // ── Fetch messages ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setMessages([]);
    void (async () => {
      setLoadingChat(true);
      try {
        const res  = await fetch(`/api/support/tickets/${activeId}`);
        const data = await res.json() as { messages?: { sender: string; content: string; id: string; created_at: string }[]; error?: string };
        if (!res.ok) throw new Error(data.error);
        setMessages(
          (data.messages ?? []).map((m) => ({
            id: m.id,
            sender: m.sender as 'user' | 'ai',
            content: m.content,
            created_at: m.created_at,
          }))
        );
      } catch {
        toast.error(t('loadError'));
      } finally {
        setLoadingChat(false);
      }
    })();
  }, [activeId, t]);

  // ── Log-watcher préventif : premier message IA sans attendre la question du client ──
  useEffect(() => {
    if (!activeId || loadingChat || isArchived) return;
    if (messages.length > 0) return;
    if (bootstrapAttemptedRef.current.has(activeId)) return;
    bootstrapAttemptedRef.current.add(activeId);

    void (async () => {
      setSending(true);
      try {
        const res = await fetch(`/api/support/tickets/${activeId}/bootstrap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale }),
        });
        const data = await res.json() as {
          message?: string;
          actions?: ActionBadge[];
          skipped?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? 'bootstrap');

        if (data.skipped) {
          const r2 = await fetch(`/api/support/tickets/${activeId}`);
          const j2 = await r2.json() as {
            messages?: { sender: string; content: string; id: string; created_at: string }[];
            error?: string;
          };
          if (r2.ok && j2.messages?.length) {
            setMessages(
              j2.messages.map((m) => ({
                id: m.id,
                sender: m.sender as 'user' | 'ai',
                content: m.content,
                created_at: m.created_at,
              }))
            );
          }
        } else if (data.message) {
          setMessages([
            {
              /* id absent : clé stable via sender + début de contenu */
              sender: 'ai',
              content: data.message,
              actions: data.actions ?? [],
            },
          ]);
        }
      } catch {
        bootstrapAttemptedRef.current.delete(activeId);
        toast.error(t('sendError'));
      } finally {
        setSending(false);
      }
    })();
  }, [activeId, loadingChat, messages.length, isArchived, locale, t]);

  // ── Scroll to bottom ────────────────────────────────────────────────────────

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // ── New ticket ───────────────────────────────────────────────────────────────

  async function handleNewTicket() {
    try {
      const res  = await fetch('/api/support/tickets', { method: 'POST' });
      const data = await res.json() as { ticket?: Ticket; error?: string };
      if (!res.ok) throw new Error(data.error);
      await refreshLists();
      setActiveId((data.ticket as Ticket).id);
      setMessages([]);
      toast.success(t('newTicketToast'));
      setTimeout(() => inputRef.current?.focus(), 150);
    } catch {
      toast.error(t('newTicketError'));
    }
  }

  // ── Archive (+ verdict Nexus pour le RAG) ───────────────────────────────────

  async function submitArchiveWithVerdict(problem: string, solution: string) {
    if (!activeId || isArchived) throw new Error('no_active_ticket');
    try {
      const res = await fetch(`/api/support/tickets/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'archived',
          verdict_problem: problem,
          verdict_solution: solution,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error);
      toast.success(t('archivedToast'));
      const lists = await refreshLists();
      setActiveId(lists.open[0]?.id ?? lists.archived[0]?.id ?? null);
    } catch {
      toast.error(t('archiveError'));
      throw new Error('archive_failed');
    }
  }

  // ── Send message ─────────────────────────────────────────────────────────────

  async function sendMessage() {
    const text = input.trim();
    if (!text || !activeId || sending || isArchived) return;

    setInput('');
    setSending(true);

    const optimistic: ChatMessage = { sender: 'user', content: text };
    setMessages((m) => [...m, optimistic]);

    try {
      const res  = await fetch(`/api/support/tickets/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json() as { message?: string; actions?: ActionBadge[]; error?: string };
      if (!res.ok) throw new Error(data.error);

      setMessages((m) => [
        ...m,
        {
          sender: 'ai',
          content: data.message as string,
          actions: data.actions ?? [],
        },
      ]);
    } catch (e) {
      setMessages((m) => m.filter((x) => x !== optimistic));
      toast.error(e instanceof Error ? e.message : t('sendError'));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  // ── Textarea auto-resize + Enter ─────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (loadingList) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow animate-pulse">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">{t('agentLoading')}</p>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-9rem)] min-h-[520px] rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/40 overflow-hidden shadow-lg">

      {/* ── Sidebar — Historique des dossiers ─────────────────────────────── */}
      <aside className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200/70 dark:border-zinc-800/70 max-h-[40vh] lg:max-h-none bg-slate-50/60 dark:bg-zinc-900/40">

        {/* Header sidebar */}
        <div className="px-4 py-4 border-b border-slate-100 dark:border-zinc-800/70">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wide">
                {t('sidebarExpertBadge')}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500">{t('sidebarSupportBrand')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleNewTicket()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-semibold transition-all shadow-sm"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            {t('newTicket')}
          </button>
        </div>

        {/* Ticket lists */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-700">

          {/* Open */}
          <div>
            <p className="px-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">
              {t('openLabel')} {ticketsOpen.length > 0 && `(${ticketsOpen.length})`}
            </p>
            <ul className="space-y-1">
              {ticketsOpen.length === 0 && (
                <li className="px-2 py-2 text-xs text-slate-400 dark:text-zinc-500 italic">
                  {t('emptyOpen')}
                </li>
              )}
              {ticketsOpen.map((tk) => {
                const fallback = t('ticketTitle', { date: formatShort(tk.updated_at, locale) });
                const isActive = activeId === tk.id;
                const isRenaming = renamingId === tk.id;
                return (
                  <li key={tk.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => { if (!isRenaming) setActiveId(tk.id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !isRenaming) setActiveId(tk.id); }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between gap-2 group cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800/60 hover:shadow-sm'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        {isRenaming ? (
                          <TicketRenameInput
                            ticketId={tk.id}
                            currentTitle={tk.title}
                            fallback={fallback}
                            onSaved={(newTitle) => {
                              setTicketsOpen((prev) =>
                                prev.map((x) => x.id === tk.id ? { ...x, title: newTitle } : x)
                              );
                              setRenamingId(null);
                            }}
                            onCancel={() => setRenamingId(null)}
                          />
                        ) : (
                          <>
                            <p className="truncate font-semibold flex items-center gap-1.5">
                              <AdminStatusDot
                                tone={ticketGravityTone(tk.gravity_score)}
                                title={t('gravityTitle', { score: tk.gravity_score ?? '—' })}
                              />
                              <span className="truncate">{tk.title ?? fallback}</span>
                            </p>
                            <p className={`text-[10px] mt-0.5 ${isActive ? 'text-indigo-200' : 'text-slate-400 dark:text-zinc-500'}`}>
                              {t('modifiedPrefix')} {formatShort(tk.updated_at, locale)}
                              {typeof tk.gravity_score === 'number' ? (
                                <span className="ml-1.5 tabular-nums opacity-80">
                                  {t('gravityScoreSuffix', { score: tk.gravity_score })}
                                </span>
                              ) : null}
                            </p>
                          </>
                        )}
                      </div>
                      {!isRenaming && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setRenamingId(tk.id); }}
                            title={t('renameTicketTitle')}
                            className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20 ${isActive ? 'text-indigo-200 hover:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                          <ChevronRight className={`w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100 text-white' : ''}`} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Archived */}
          {ticketsArchived.length > 0 && (
            <div>
              <p className="px-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">
                {t('archivedLabel')} ({ticketsArchived.length})
              </p>
              <ul className="space-y-1">
                {ticketsArchived.map((tk) => (
                  <li key={tk.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(tk.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        activeId === tk.id
                          ? 'bg-zinc-600 dark:bg-zinc-600 text-white'
                          : 'text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800/60'
                      }`}
                    >
                      <p className="truncate">
                        {tk.title ?? t('ticketTitle', { date: formatShort(tk.updated_at, locale) })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* ── Zone chat principale ───────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col min-h-0 min-w-0 bg-slate-50/30 dark:bg-zinc-950/20">

        {/* Header chat */}
        <header className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-zinc-800/70 flex items-center gap-3 justify-between shrink-0 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shrink-0">
              <ShieldCheck className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-zinc-50 truncate">
                {t('title')}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-zinc-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                {t('subtitle')}
              </p>
            </div>
          </div>

          {activeId && !isArchived && (
            <button
              type="button"
              onClick={() => setVerdictOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
            >
              <Archive className="w-3 h-3" />
              {t('archive')}
            </button>
          )}
        </header>

        {/* ── État vide (aucun ticket sélectionné) ── */}
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
              <Inbox className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
                {t('pickOrCreate')}
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                {t('emptyChatSubtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleNewTicket()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              {t('newTicket')}
            </button>
          </div>
        ) : (
          <>
            {/* ── Fil de conversation ── */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 min-h-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-700"
            >
              {loadingChat ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/40 dark:to-violet-950/40 flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
                      {t('greetingTitle')}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 max-w-xs mx-auto">
                      {t('greetingSubtitle')}
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <MessageBubble
                    key={m.id ?? `${m.sender}-${i}`}
                    msg={m}
                    locale={locale}
                    agentLabel={t('bubbleAgentLabel')}
                  />
                ))
              )}

              {/* Indicateur de traitement agent */}
              {sending && <AgentThinking />}
            </div>

            {/* ── Zone de saisie ── */}
            {isArchived ? (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800/70 text-center text-xs text-slate-400 dark:text-zinc-500 bg-white/60 dark:bg-zinc-900/40">
                {t('readOnlyArchived')}
              </div>
            ) : (
              <form
                className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-zinc-800/70 flex gap-2 items-end shrink-0 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-sm"
                onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
              >
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  placeholder={t('placeholder')}
                  className="flex-1 min-w-0 resize-none px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-sm leading-relaxed transition-all disabled:opacity-60 max-h-[120px] overflow-y-auto scrollbar-thin"
                  style={{ height: '46px' }}
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-sm shrink-0"
                  aria-label={t('sendMessageAria')}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            )}
          </>
        )}
      </section>

      <SupportVerdictModal
        open={verdictOpen}
        onOpenChange={setVerdictOpen}
        onConfirm={submitArchiveWithVerdict}
        title={t('verdictArchiveTitle')}
        confirmLabel={t('verdictArchiveConfirm')}
      />
    </div>
  );
}
