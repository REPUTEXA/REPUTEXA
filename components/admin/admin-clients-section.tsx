'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Users,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

type ClientRow = {
  id: string;
  full_name: string | null;
  establishment_name: string | null;
  email: string | null;
  phone: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  created_at: string | null;
  role: string | null;
};

type ClientsApiResponse = {
  clients: ClientRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  fromRow: number;
  toRow: number;
  error?: string;
};

const PLAN_LABELS: Record<string, string> = {
  vision: 'Vision',
  pulse: 'Pulse',
  zenith: 'Zenith',
  starter: 'Vision',
  manager: 'Pulse',
  Dominator: 'Zenith',
  free: 'Free',
};

const PLAN_COLORS: Record<string, string> = {
  vision: 'text-slate-300 bg-slate-800 border-slate-700',
  starter: 'text-slate-300 bg-slate-800 border-slate-700',
  free: 'text-slate-400 bg-slate-800/50 border-slate-700/50',
  pulse: 'text-blue-300 bg-blue-900/30 border-blue-800/50',
  manager: 'text-blue-300 bg-blue-900/30 border-blue-800/50',
  zenith: 'text-violet-300 bg-violet-900/30 border-violet-800/50',
  Dominator: 'text-violet-300 bg-violet-900/30 border-violet-800/50',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-900/20 border-emerald-800/50',
  trialing: 'text-amber-400 bg-amber-900/20 border-amber-800/50',
  past_due: 'text-red-400 bg-red-900/20 border-red-800/50',
  canceled: 'text-zinc-500 bg-zinc-800/30 border-zinc-700/50',
  incomplete: 'text-zinc-500 bg-zinc-800/30 border-zinc-700/50',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  trialing: 'Essai',
  past_due: 'Impayé',
  canceled: 'Annulé',
  incomplete: 'Incomplet',
};

const PER_PAGE = 20;
const DEBOUNCE_MS = 350;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function TableSkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-zinc-800/40">
          <td className="px-4 py-3" colSpan={7}>
            <div className="flex gap-3 animate-pulse">
              <div className="h-4 flex-1 max-w-[200px] bg-zinc-800 rounded" />
              <div className="h-4 flex-1 max-w-[160px] bg-zinc-800 rounded" />
              <div className="h-4 w-16 bg-zinc-800 rounded" />
              <div className="h-4 w-20 bg-zinc-800 rounded" />
              <div className="h-4 w-24 bg-zinc-800 rounded" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function AdminClientsSection() {
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ClientsApiResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(PER_PAGE),
      });
      if (debouncedSearch.trim()) {
        params.set('q', debouncedSearch.trim());
      }
      const res = await fetch(`/api/admin/clients?${params.toString()}`, {
        credentials: 'same-origin',
      });
      const json = (await res.json()) as ClientsApiResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setData(json);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Erreur de chargement');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const clients = data?.clients ?? [];

  const summaryLine = useMemo(() => {
    if (!data || loading) return null;
    if (total === 0) return '0 client';
    return `Affichage de ${data.fromRow}-${data.toRow} sur ${total} client${total > 1 ? 's' : ''}`;
  }, [data, loading, total]);

  const showEmptySearch =
    !loading && !fetchError && total === 0 && debouncedSearch.trim().length > 0;
  const showEmptyGlobal =
    !loading && !fetchError && total === 0 && debouncedSearch.trim().length === 0;

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-600" />
            Clients
            {!loading && data !== null && (
              <span className="text-zinc-600 font-mono normal-case">({total})</span>
            )}
          </h2>
        </div>

        {/* Recherche universelle */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Établissement, nom, email, téléphone…"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 pl-10 pr-10 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
            aria-label="Rechercher un client"
          />
          {searchInput.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Vider la recherche"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {fetchError}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-900/80">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Établissement / Nom
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Inscrit le
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Rôle
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <TableSkeletonRows rows={Math.min(PER_PAGE, 10)} />
              )}

              {!loading && showEmptySearch && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-zinc-500 text-sm px-4">
                    Aucun client trouvé pour cette recherche
                  </td>
                </tr>
              )}

              {!loading && showEmptyGlobal && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-zinc-600 text-sm px-4">
                    Aucun client en base
                  </td>
                </tr>
              )}

              {!loading &&
                clients.map((client, idx) => {
                  const planKey = client.subscription_plan ?? 'free';
                  const planLabel = PLAN_LABELS[planKey] ?? planKey;
                  const planColor = PLAN_COLORS[planKey] ?? PLAN_COLORS.free;
                  const statusKey = client.subscription_status ?? '';
                  const statusLabel = STATUS_LABELS[statusKey] ?? statusKey;
                  const statusColor =
                    STATUS_COLORS[statusKey] ?? 'text-zinc-500 bg-zinc-800/30 border-zinc-700/50';
                  const email = client.email?.trim() || '—';
                  const phone = client.phone?.trim() || '—';
                  const createdAt = client.created_at
                    ? new Date(client.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })
                    : '—';

                  return (
                    <tr
                      key={client.id}
                      className={`border-b border-zinc-800/40 transition-colors hover:bg-zinc-900/40 ${
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-zinc-900/20'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-200 truncate max-w-[160px]">
                          {client.establishment_name || '—'}
                        </p>
                        {client.full_name && (
                          <p className="text-xs text-zinc-600 truncate">{client.full_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-zinc-400 truncate block max-w-[200px]">
                          {email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-zinc-400 truncate block max-w-[140px]">
                          {phone}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${planColor}`}
                        >
                          {planLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {statusKey ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${statusColor}`}
                          >
                            {statusKey === 'active' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : statusKey === 'trialing' ? (
                              <Clock className="w-3 h-3" />
                            ) : (
                              <AlertTriangle className="w-3 h-3" />
                            )}
                            {statusLabel}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="text-xs text-zinc-500 font-mono px-4 py-3">{createdAt}</td>
                      <td className="px-4 py-3">
                        {client.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-blue-700/50 bg-blue-900/20 text-blue-400 text-xs font-semibold">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-xs">User</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination + résumé */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {loading && (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                <span>Chargement…</span>
              </>
            )}
            {!loading && summaryLine && <span>{summaryLine}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </button>
            <span className="text-xs text-zinc-400 font-mono tabular-nums px-1">
              Page {loading ? '…' : page} sur {loading ? '…' : totalPages}
            </span>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
