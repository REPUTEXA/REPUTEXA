'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Wrench,
  ClipboardCopy,
  ChevronDown,
  ChevronUp,
  Database,
  Cpu,
  MessageSquare,
  Globe,
  Bot,
  Zap,
  GitBranch,
  Loader2,
  Sparkles,
} from 'lucide-react';

type ServiceStatus = {
  name: string;
  status: 'ok' | 'degraded' | 'critical';
  latency_ms: number | null;
  message: string;
};

type HealthData = {
  overall: 'ok' | 'degraded' | 'critical';
  services: ServiceStatus[];
  checked_at: string;
  total_ms: number;
};

type Incident = {
  id: string;
  service: string;
  status: string;
  message: string;
  latency_ms: number | null;
  auto_fixed: boolean;
  alert_sent: boolean;
  heal_status: string | null;
  claude_diagnosis: string | null;
  heal_action: string | null;
  deploy_triggered: boolean;
  created_at: string;
};

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  database: Database,
  openai: Cpu,
  anthropic: Bot,
  whatsapp: MessageSquare,
  webhooks: Globe,
};

const STATUS_CONFIG = {
  ok: {
    label: 'OK',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    dot: 'bg-emerald-400',
    icon: CheckCircle2,
  },
  degraded: {
    label: 'Dégradé',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    dot: 'bg-amber-400',
    icon: AlertTriangle,
  },
  critical: {
    label: 'Critique',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    dot: 'bg-red-500',
    icon: XCircle,
  },
  auto_fixed: {
    label: 'Auto-réparé',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    dot: 'bg-blue-400',
    icon: Wrench,
  },
  healing: {
    label: 'Réparation IA',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    dot: 'bg-amber-400',
    icon: Zap,
  },
};

const HEAL_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: 'IA en cours...', color: 'text-amber-400', bg: 'bg-amber-900/30 border-amber-800/50' },
  applied:     { label: 'Correction appliquée', color: 'text-blue-400', bg: 'bg-blue-900/30 border-blue-800/50' },
  skipped:     { label: 'Action manuelle requise', color: 'text-zinc-400', bg: 'bg-zinc-800/60 border-zinc-700/50' },
  failed:      { label: 'Diagnostic échoué', color: 'text-red-400', bg: 'bg-red-900/30 border-red-800/50' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.degraded;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function HealBadge({ healStatus, deployTriggered }: { healStatus: string | null; deployTriggered: boolean }) {
  if (!healStatus) return null;
  const cfg = HEAL_STATUS_CONFIG[healStatus];
  if (!cfg) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.color}`}>
        {healStatus === 'in_progress' && <Loader2 className="w-2.5 h-2.5 inline mr-1 animate-spin" />}
        {cfg.label}
      </span>
      {deployTriggered && (
        <span className="px-2 py-0.5 rounded border border-violet-800/50 bg-violet-900/30 text-violet-400 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
          <GitBranch className="w-2.5 h-2.5" />
          Deploy
        </span>
      )}
    </div>
  );
}

function OverallBanner({ status, checkedAt, totalMs, healingCount }: {
  status: string;
  checkedAt: string;
  totalMs: number;
  healingCount: number;
}) {
  const effectiveStatus = healingCount > 0 ? 'healing' : status;
  const cfg = STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.degraded;
  const label =
    effectiveStatus === 'healing'
      ? `Agent Claude 3.5 en cours de réparation (${healingCount} service${healingCount > 1 ? 's' : ''})...`
      : status === 'ok'
      ? 'Tous les systèmes opérationnels'
      : status === 'degraded'
      ? 'Dégradation partielle détectée'
      : 'Alerte critique — Service(s) en échec';

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg}`}>
      <div className={`w-3 h-3 rounded-full ${cfg.dot} animate-pulse`} />
      <span className={`font-bold text-sm ${cfg.color}`}>{label}</span>
      <span className="ml-auto text-xs text-zinc-500 font-mono">
        {totalMs}ms — {new Date(checkedAt).toLocaleTimeString('fr-FR')}
      </span>
    </div>
  );
}

function ServiceCard({ s }: { s: ServiceStatus }) {
  const Icon = SERVICE_ICONS[s.name] ?? Activity;
  const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.degraded;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg} transition-all`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}>
        <Icon className={`w-4 h-4 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-200 capitalize">{s.name}</p>
        <p className="text-xs text-zinc-500 truncate">{s.message}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {s.latency_ms !== null && (
          <span className="text-xs font-mono text-zinc-500">{s.latency_ms}ms</span>
        )}
        <StatusBadge status={s.status} />
      </div>
    </div>
  );
}

function DiagnosisBlock({ diagnosis }: { diagnosis: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = diagnosis.split('\n').filter(Boolean);
  const preview = lines[0] ?? '';
  const hasMore = lines.length > 1;
  return (
    <div className="mt-2 text-xs text-zinc-400 bg-zinc-900/60 rounded-lg px-3 py-2 border border-zinc-800/60">
      <p>{preview}</p>
      {hasMore && expanded && (
        <div className="mt-2 space-y-1 border-t border-zinc-800/60 pt-2">
          {lines.slice(1).map((l, i) => <p key={i} className="text-zinc-500">{l}</p>)}
        </div>
      )}
      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          {expanded ? '▲ Réduire' : '▼ Voir le diagnostic complet'}
        </button>
      )}
    </div>
  );
}

function generateDiagnosticReport(health: HealthData, incidents: Incident[]): string {
  const lines: string[] = [
    '══════════════════════════════════════════',
    '   REPUTEXA — Rapport de Diagnostic Sentinel',
    `   Généré le : ${new Date().toLocaleString('fr-FR')}`,
    '══════════════════════════════════════════',
    '',
    `📊 STATUT GLOBAL : ${health.overall.toUpperCase()}`,
    `⏱  Dernière vérification : ${new Date(health.checked_at).toLocaleString('fr-FR')} (${health.total_ms}ms)`,
    '',
    '── Services ──────────────────────────────',
    ...health.services.map((s) =>
      `  ${s.status === 'ok' ? '✅' : s.status === 'degraded' ? '⚠️' : '❌'} ${s.name.padEnd(12)} ${s.status.toUpperCase().padEnd(10)} ${s.latency_ms !== null ? `${s.latency_ms}ms` : 'N/A'}${s.message !== s.name + ' OK' ? `\n     └─ ${s.message}` : ''}`
    ),
    '',
    '── 10 Derniers Incidents + Diagnostics Claude ─',
    ...(incidents.slice(0, 10).map((i) =>
      [
        `  [${new Date(i.created_at).toLocaleString('fr-FR')}] ${i.service.padEnd(12)} ${i.status.toUpperCase().padEnd(12)} ${i.message}`,
        i.heal_status ? `     🤖 Heal: ${i.heal_status.toUpperCase()} | Action: ${i.heal_action ?? 'none'}` : '',
        i.claude_diagnosis ? `     Claude: ${i.claude_diagnosis.split('\n')[0]}` : '',
      ].filter(Boolean).join('\n')
    )),
    '',
    '── Environnement ─────────────────────────',
    `  URL : ${window.location.origin}`,
    `  UA  : ${navigator.userAgent}`,
    '',
    '══════════════════════════════════════════',
    '  Coller ce rapport dans Cursor pour assistance IA',
    '══════════════════════════════════════════',
  ];
  return lines.join('\n');
}

const POLL_INTERVAL_MS = 30_000;

export function SentinelPanel() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [healing, setHealing] = useState(false);
  const [healResult, setHealResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIncidents, setShowIncidents] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hRes, iRes] = await Promise.all([
        fetch('/api/admin/health-check'),
        fetch('/api/admin/incidents?limit=50'),
      ]);
      if (!hRes.ok) throw new Error(`Health check HTTP ${hRes.status}`);
      setHealth(await hRes.json() as HealthData);
      if (iRes.ok) {
        const iData: { incidents: Incident[] } = await iRes.json();
        setIncidents(iData.incidents ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleManualHeal = async () => {
    setHealing(true);
    setHealResult(null);
    try {
      const res = await fetch('/api/admin/auto-heal', { method: 'POST' });
      const data = await res.json() as { healed: number; total: number; message?: string };
      if (data.message) {
        setHealResult(data.message);
      } else {
        setHealResult(`${data.healed}/${data.total} service(s) traité(s) par Claude 3.5 Sonnet.`);
      }
      await fetchHealth();
    } catch (e) {
      setHealResult(`Erreur : ${e instanceof Error ? e.message : 'inconnue'}`);
    } finally {
      setHealing(false);
    }
  };

  const handleCopyDiagnostic = () => {
    if (!health) return;
    const report = generateDiagnosticReport(health, incidents);
    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const healingIncidents = incidents.filter((i) => i.heal_status === 'in_progress');
  const hasCriticals = health?.overall === 'critical';

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          État du Système — Sentinel
        </h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Manual heal button — visible only when there are criticals */}
          {hasCriticals && (
            <button
              type="button"
              onClick={handleManualHeal}
              disabled={healing}
              title={
                healing
                  ? 'Analyse en cours via Claude 3.5 Sonnet (Agent Privé)...'
                  : 'Déclenche l’auto-réparation Sentinel avec Claude 3.5 Sonnet (Agent Privé)'
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/30 hover:bg-amber-900/50 border border-amber-700/60 text-xs text-amber-300 font-semibold transition-colors disabled:opacity-60"
            >
              {healing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              {healing
                ? 'Analyse via Claude 3.5 Sonnet…'
                : 'Auto-Réparation IA'}
            </button>
          )}
          {health && (
            <button
              type="button"
              onClick={handleCopyDiagnostic}
              title="Copier le rapport pour analyse par Claude 3.5 Sonnet (Agent Privé)."
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-xs text-zinc-300 font-medium transition-colors"
            >
              {copied ? <ClipboardCopy className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              {copied ? 'Copié !' : 'Diagnostic IA Sentinel'}
            </button>
          )}
          <button
            type="button"
            onClick={fetchHealth}
            disabled={loading}
            title={loading ? 'Vérification des services en cours…' : 'Rafraîchir le diagnostic Sentinel'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-xs text-zinc-300 font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 overflow-hidden">
        <div className="px-5 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/10">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Manual heal result */}
          {healResult && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/10">
              <Zap className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-300">{healResult}</p>
            </div>
          )}

          {!health && !error && (
            <div
              className="flex flex-col items-center justify-center py-10 gap-2"
              title="Vérification Santé Sentinel — webhooks testés via l’URL publique résolue (SENTINEL_PUBLIC_URL, NEXT_PUBLIC_SITE_URL ou VERCEL_URL)"
            >
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-zinc-600 animate-spin" />
                <span className="text-sm text-zinc-500">Vérification des services...</span>
              </div>
              <span className="text-[11px] text-zinc-600 text-center max-w-md">
                Contrôle des webhooks via l’URL publique (production ou Vercel). Aide Claude 3.5 Sonnet (Agent Privé) : rapport « Diagnostic IA Sentinel ».
              </span>
            </div>
          )}

          {health && (
            <>
              <OverallBanner
                status={health.overall}
                checkedAt={health.checked_at}
                totalMs={health.total_ms}
                healingCount={healingIncidents.length}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {health.services.map((s) => (
                  <ServiceCard key={s.name} s={s} />
                ))}
              </div>

              <p className="text-xs text-zinc-600 text-right font-mono">
                Auto-actualisation 30s · Cron Sentinel 10min · Agent Claude déclenchement automatique
              </p>
            </>
          )}
        </div>

        {/* Incidents log accordion */}
        <div className="border-t border-zinc-800/80">
          <button
            onClick={() => setShowIncidents((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-900/40 transition-colors text-left"
          >
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
              Historique des incidents ({incidents.length})
            </span>
            {showIncidents ? (
              <ChevronUp className="w-4 h-4 text-zinc-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-600" />
            )}
          </button>

          {showIncidents && (
            <div className="divide-y divide-zinc-800/60 max-h-[480px] overflow-y-auto">
              {incidents.length === 0 && (
                <p className="text-center py-8 text-xs text-zinc-600">Aucun incident enregistré</p>
              )}
              {incidents.map((inc) => (
                <div key={inc.id} className="px-5 py-3 hover:bg-zinc-900/20">
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={inc.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-300 capitalize">{inc.service}</p>
                      <p className="text-xs text-zinc-600 truncate">{inc.message}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {inc.alert_sent && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-800/50 text-amber-400 text-[10px] font-semibold">ALERTE</span>
                      )}
                      <span className="text-[11px] text-zinc-600 font-mono">
                        {new Date(inc.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Heal status row */}
                  {inc.heal_status && (
                    <div className="mt-2">
                      <HealBadge healStatus={inc.heal_status} deployTriggered={inc.deploy_triggered} />
                      {inc.heal_action && inc.heal_action !== 'none' && inc.heal_action !== 'duplicate' && (
                        <p className="text-[11px] text-zinc-600 mt-1 font-mono">
                          Action : {inc.heal_action}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Claude diagnosis */}
                  {inc.claude_diagnosis && <DiagnosisBlock diagnosis={inc.claude_diagnosis} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
