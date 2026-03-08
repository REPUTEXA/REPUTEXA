'use client';

import {
  Star,
  MessageSquare,
  Zap,
  TriangleAlert,
  TrendingUp,
  Brain,
  BarChart2,
} from 'lucide-react';

type Props = {
  avgRating: string;
  totalReviews: number;
  timeSaved: string;
  priorityActions: number;
};

export function CommandCenterCard({
  avgRating,
  totalReviews,
  timeSaved,
  priorityActions,
}: Props) {
  return (
    <div className="rounded-2xl sm:rounded-[32px] border border-white/10 bg-white/5 shadow-[0_24px_64px_rgba(15,23,42,0.85)] p-1 sm:p-1.5 dashboard-glow min-w-0">
      <div className="rounded-xl sm:rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden bg-white backdrop-blur-sm">
        <div className="bg-gradient-to-b from-slate-100 to-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-slate-200 min-w-0">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-400 shadow-sm" />
            <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
            <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm" />
          </div>
          <div className="flex-1 flex justify-center min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1 sm:py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm max-w-full">
              <span className="text-[10px] sm:text-xs text-slate-600 font-medium truncate">
                app.reputexa.ai/dashboard
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-4 md:p-6 bg-gradient-to-br from-[#f8fafc] to-white">
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                <span className="text-white font-bold text-xs sm:text-sm">R</span>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                  Mon Restaurant
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-500">Tableau de bord</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
            <div className="bg-white p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-1.5 sm:mb-2">
                <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              </div>
              <p className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900">
                {avgRating}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500">Note moyenne</p>
            </div>

            <div className="bg-white p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-1.5 sm:mb-2">
                <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              </div>
              <p className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900">
                {totalReviews}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500">Avis ce mois</p>
            </div>

            <div className="bg-white p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-purple-100 flex items-center justify-center mb-1.5 sm:mb-2">
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
              </div>
              <p className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900">
                {timeSaved}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500">Temps de réponse</p>
            </div>

            <div className="bg-white p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-1.5 sm:mb-2">
                <TriangleAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
              </div>
              <p className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900">
                {priorityActions}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500">Actions prioritaires</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
              <h4 className="font-semibold text-slate-900 text-xs sm:text-sm mb-2 sm:mb-3 flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
                Insights IA de la semaine
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-50 border border-rose-100">
                  <TriangleAlert className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-rose-700">
                      Temps d&apos;attente mentionné 8x
                    </p>
                    <p className="text-xs text-rose-600">Impact estimé : -12 clients/mois</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                  <TrendingUp className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-emerald-700">
                      Qualité du service saluée
                    </p>
                    <p className="text-xs text-emerald-600">+23 mentions positives</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
              <h4 className="font-semibold text-slate-900 text-xs sm:text-sm mb-2 sm:mb-3 flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
                Évolution cette semaine
              </h4>
              <div className="flex items-end gap-1 sm:gap-2 h-14 sm:h-20">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => {
                  const heights = ['35%', '42%', '28%', '45%', '38%', '52%', '48%'];
                  const isToday = idx === 6;
                  return (
                    <div key={day + idx} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full rounded-t transition-all duration-500 ${
                          isToday ? 'bg-blue-500' : 'bg-slate-200'
                        }`}
                        style={{ height: heights[idx] }}
                      />
                      <span className="text-[10px] text-slate-400 mt-1">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
