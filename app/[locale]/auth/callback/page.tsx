'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/logo';
import { Loader2 } from 'lucide-react';

/**
 * Page de callback OAuth / recovery / magic link.
 * Gère ?code=... (PKCE) et #access_token=... (implicit).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  // setError reserved for future error display
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    async function redirectToTarget(session: { user?: { id: string } } | null) {
      if (!session) return;
      const nextRaw = searchParams?.get('next');
      const next = nextRaw ? decodeURIComponent(nextRaw) : '';
      const isRecovery =
        (typeof window !== 'undefined' && window.location.hash?.includes('type=recovery')) ||
        next === '/reset-password';

      const target = isRecovery
        ? `/${locale}/reset-password`
        : next?.startsWith('/')
          ? `/${locale}${next}`
          : `/${locale}/dashboard`;

      console.log('[auth/callback] Redirection vers :', target);

      if (!isRecovery) {
        // Sync full_name, avatar_url, email from Google (ou autre OAuth). Nouveaux utilisateurs : le trigger handle_new_user a déjà créé la ligne profiles ; on complète avec les métadonnées OAuth.
        await fetch('/api/auth/sync-oauth-profile', { method: 'POST' }).catch(() => {});
      }
      router.replace(target);
    }

    async function handleCallback() {
      const supabase = createClient();
      const code = searchParams?.get('code');
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const hasHashTokens = hash.includes('access_token') || hash.includes('refresh_token');

      // 1. Vérification immédiate : session déjà présente ? → redirection directe (Check d'abord)
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        await redirectToTarget(existingSession);
        return;
      }

      // 2. Pas de session. Si code présent : attendre 1s avant exchange (valide après)
      if (code) {
        console.log('[auth/callback] Code présent, attente 1s avant exchangeCodeForSession...');
        await new Promise((r) => setTimeout(r, 1000));

        // Recheck session après délai (processus auto peuvent l'avoir établie)
        const { data: { session: sessionAfterDelay } } = await supabase.auth.getSession();
        if (sessionAfterDelay) {
          console.log('[auth/callback] Session établie pendant le délai → redirection sans échange');
          await redirectToTarget(sessionAfterDelay);
          return;
        }

        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            // Try/catch ultra-souple : si erreur mais session présente quand même → ignorer et rediriger
            const { data: { session: sessionAfterError } } = await supabase.auth.getSession();
            if (sessionAfterError) {
              console.log('[auth/callback] Erreur échange mais session présente → redirection (ignorée)');
              await redirectToTarget(sessionAfterError);
              return;
            }
            console.error('[auth/callback] Erreur exchangeCodeForSession:', exchangeError.message);
            setRedirecting(true);
            router.replace(`/${locale}/login?error=auth-callback-failed`);
            return;
          }
          if (!data?.session) {
            const { data: { session: s } } = await supabase.auth.getSession();
            if (s) {
              console.log('[auth/callback] Pas de data.session mais getSession() ok → redirection');
              await redirectToTarget(s);
              return;
            }
            setRedirecting(true);
            router.replace(`/${locale}/login?error=auth-callback-failed`);
            return;
          }
        } catch (err) {
          console.error('[auth/callback] Exception exchangeCodeForSession:', err);
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('[auth/callback] Exception mais session présente → redirection');
            await redirectToTarget(session);
            return;
          }
          setRedirecting(true);
          router.replace(`/${locale}/login?error=auth-callback-failed`);
          return;
        }
      } else if (hasHashTokens) {
        console.log('[auth/callback] Hash tokens détectés, attente 1s...');
        await new Promise((r) => setTimeout(r, 1000));
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setRedirecting(true);
          router.replace(`/${locale}/login?error=auth-callback-failed`);
          return;
        }
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('[auth/callback] Pas de code, pas de hash, pas de session → erreur');
          setRedirecting(true);
          router.replace(`/${locale}/login?error=auth-callback-failed`);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setRedirecting(true);
        router.replace(`/${locale}/login?error=auth-callback-failed`);
        return;
      }
      await redirectToTarget(session);
    }

    handleCallback();
  }, [router, locale, searchParams]);

  if (redirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80">
        <Logo size="lg" />
        <Loader2 className="w-8 h-8 animate-spin text-white mt-6" />
        <p className="text-white/70 text-sm mt-4">Redirection...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80 px-4">
        <Logo size="lg" />
        <p className="text-white/80 mt-4">{error}</p>
        <a href={`/${locale}/login`} className="mt-6 text-[#2563eb] hover:underline">
          Retour à la connexion
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80">
      <Logo size="lg" />
      <Loader2 className="w-8 h-8 animate-spin text-white mt-6" />
      <p className="text-white/70 text-sm mt-4">Redirection...</p>
    </div>
  );
}
