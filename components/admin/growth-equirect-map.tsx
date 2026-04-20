'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useGrowthCountryLabel } from '@/lib/admin/use-growth-country-label';

export type GrowthMapMarker = {
  id: string;
  type: 'prospect' | 'customer';
  label: string;
  city?: string;
  countryCode?: string | null;
  lat: number;
  lng: number;
  phase: string;
};

type PositionedMarker = GrowthMapMarker & { x: number; y: number };

function latLngToXY(lat: number, lng: number, w: number, h: number) {
  const x = ((lng + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return { x, y };
}

const PHASE_COLORS: Record<string, string> = {
  scanned: 'bg-zinc-500',
  outreach_recent: 'bg-amber-400',
  no_response: 'bg-orange-500',
  engaged: 'bg-sky-400',
  opted_out: 'bg-red-500',
  customer: 'bg-emerald-500',
  lost: 'bg-stone-600',
  trial: 'bg-violet-400',
};

/** Maps API phase → Dashboard.adminGrowthWarRoom legend_* key */
const PHASE_TO_LEGEND_KEY: Record<string, string> = {
  scanned: 'legend_scanned',
  outreach_recent: 'legend_outreach_recent',
  no_response: 'legend_no_response',
  engaged: 'legend_engaged',
  opted_out: 'legend_opted_out',
  customer: 'legend_customer',
  lost: 'legend_lost',
  trial: 'legend_trial',
};

export function GrowthEquirectMap({ markers }: { markers: GrowthMapMarker[] }) {
  const w = 960;
  const h = 480;
  const [hover, setHover] = useState<PositionedMarker | null>(null);
  const [scale, setScale] = useState(1);
  const tMap = useTranslations('Admin.growthEquirectMap');
  const tLegend = useTranslations('Dashboard.adminGrowthWarRoom');
  const countryLabel = useGrowthCountryLabel();
  const projectionTitle = tMap('projectionTitle');
  const mapZoomAriaLabel = tMap('mapZoomAria');
  const emptyMapHint = tMap('emptyHint');

  const positioned = useMemo(
    (): PositionedMarker[] =>
      markers.map((m) => {
        const { x, y } = latLngToXY(m.lat, m.lng, w, h);
        return { ...m, x, y };
      }),
    [markers, w, h]
  );

  const phaseLabel = (phase: string) => {
    const k = PHASE_TO_LEGEND_KEY[phase];
    return k ? tLegend(k) : phase;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-b from-zinc-950 via-indigo-950/40 to-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 px-4 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-200/80">{projectionTitle}</p>
        <input
          type="range"
          min={0.85}
          max={2.5}
          step={0.05}
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
          className="h-1 w-36 accent-indigo-400"
          aria-label={mapZoomAriaLabel}
        />
      </div>
      <div className="relative mx-auto max-w-full overflow-auto p-4">
        <div
          className="relative mx-auto origin-top transition-transform duration-200"
          style={{ width: w, height: h, transform: `scale(${scale})` }}
        >
          <svg width={w} height={h} className="absolute inset-0 text-indigo-500/15" aria-hidden>
            <defs>
              <pattern id="growthGrid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#growthGrid)" />
            <ellipse
              cx={w / 2}
              cy={h / 2}
              rx={w * 0.42}
              ry={h * 0.38}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-indigo-400/30"
            />
          </svg>
          {positioned.map((m) => (
            <button
              key={`${m.type}-${m.id}`}
              type="button"
              className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg ring-2 ring-zinc-950/80 transition hover:scale-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                PHASE_COLORS[m.phase] ?? 'bg-zinc-400'
              }`}
              style={{ left: m.x, top: m.y }}
              title={m.label}
              aria-label={m.label}
              onMouseEnter={() => setHover(m)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(m)}
              onBlur={() => setHover(null)}
            />
          ))}
          {hover ? (
            <div
              className="pointer-events-none absolute z-10 max-w-xs rounded-lg border border-indigo-500/40 bg-zinc-950/95 px-3 py-2 text-left text-xs shadow-xl backdrop-blur-sm"
              style={{
                left: Math.min(w - 200, Math.max(8, hover.x + 12)),
                top: Math.min(h - 80, Math.max(8, hover.y - 8)),
              }}
            >
              <p className="font-semibold text-zinc-100">{hover.label}</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                {[hover.city, hover.countryCode ? countryLabel(hover.countryCode) : null]
                  .filter(Boolean)
                  .join(' · ') || '—'}{' '}
                · <span className="text-indigo-300">{phaseLabel(hover.phase)}</span>
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-600">
                {hover.lat.toFixed(3)}, {hover.lng.toFixed(3)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      {markers.length === 0 ? (
        <p className="px-4 pb-4 text-center text-xs text-zinc-500">{emptyMapHint}</p>
      ) : null}
    </div>
  );
}
