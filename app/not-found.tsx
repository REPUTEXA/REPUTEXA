import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">404</h1>
      <p className="text-slate-500 text-sm mb-4">Cette page n&apos;existe pas.</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-xl bg-primary text-white font-medium hover:brightness-110 transition-colors"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
