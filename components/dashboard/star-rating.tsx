import { Star } from 'lucide-react';

type Props = { rating: number };

export function StarRating({ rating }: Props) {
  return (
    <span className="flex items-center gap-0.5 text-amber-400">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? 'fill-amber-400' : 'fill-zinc-700'}`}
        />
      ))}
    </span>
  );
}
