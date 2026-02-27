type RatingBucket = { rating: number; count: number };

export function RatingChart({ data }: { data: RatingBucket[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      {data.map(({ rating, count }) => (
        <div key={rating} className="flex items-center gap-3">
          <span className="w-12 text-sm text-zinc-400">{rating}/5</span>
          <div className="flex-1">
            <div
              className="h-6 rounded-md bg-amber-500/30 transition-all"
              style={{ width: `${(count / max) * 100}%`, minWidth: count > 0 ? 8 : 0 }}
            />
          </div>
          <span className="w-8 text-right text-sm text-zinc-500">{count}</span>
        </div>
      ))}
    </div>
  );
}
