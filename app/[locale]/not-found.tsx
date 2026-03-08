import { Link } from '@/i18n/navigation';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">404</h1>
      <p className="text-slate-500 text-sm mb-4">Cette page n&apos;existe pas.</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
