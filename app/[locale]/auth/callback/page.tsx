'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { parseAuthParamsFromHref, stripAuthParamsFromBrowserUrl } from '@/lib/auth/auth-callback-url';
import { withLocalePrefix } from '@/lib/i18n/with-locale-prefix';
import { useTranslations } from 'next-intl';
import { BrandLoadingOverlay } from '@/components/brand/brand-page-loader';
import { isAuthPKCECodeVerifierMissingError, type EmailOtpType } from '@supabase/auth-js';

/**
 * OAuth / magic link (generateLink + e-mail tiers) / fragments implicites.
 * Les liens admin.generateLink ne fournissent pas de code_verifier PKCE : il faut accepter
 * les tokens en hash ou échanger le code avec un client flowType implicit puis copier la session.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('Common.authCallback');
  const [, setRedirecting] = useState(false);

  useEffect(() => {
    async function redirectToTarget(session: { user?: { id: string } } | null) {
      if (!session) return;
      const nextRaw = searchParams?.get('next');
      const next = nextRaw ? decodeURIComponent(nextRaw) : '';
      const isLegacyRecovery =
        typeof window !== 'undefined' && window.location.hash?.includes('type=recovery');

      const target = isLegacyRecovery
        ? `/${locale}/login?message=passwordless-recovery`
        : withLocalePrefix(locale, next, '/dashboard');

      if (!isLegacyRecovery) {
        await fetch('/api/auth/sync-oauth-profile', { method: 'POST' }).catch(() => {});
      }
      router.replace(target);
    }

    async function exchangeCodeWithoutPkceVerifier(code: string) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return null;
      const { createClient: createRaw } = await import('@supabase/supabase-js');
      const implicit = createRaw(url, key, {
        auth: {
          flowType: 'implicit',
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          },
        },
      });
      const { data, error } = await implicit.auth.exchangeCodeForSession(code);
      if (error || !data?.session) return null;
      return data.session;
    }

    async function handleCallback() {
      if (typeof window === 'undefined') return;

      const supabase = createClient();
      await supabase.auth.getSession();

      const href = window.location.href;
      const params = parseAuthParamsFromHref(href);

      if (params.error || params.error_description) {
        setRedirecting(true);
        const msg = params.error_description || params.error || 'auth_failed';
        router.replace(
          `/${locale}/login?error=auth-callback-failed&detail=${encodeURIComponent(msg.slice(0, 200))}`
        );
        return;
      }

      const accessToken = params.access_token;
      const refreshToken = params.refresh_token;
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error && data.session) {
          stripAuthParamsFromBrowserUrl();
          setRedirecting(true);
          await redirectToTarget(data.session);
          return;
        }
      }

      const tokenHash = params.token_hash;
      const rawType = params.type;
      if (tokenHash && rawType) {
        const allowed: EmailOtpType[] = [
          'magiclink',
          'email',
          'signup',
          'recovery',
          'email_change',
          'invite',
        ];
        const otpType = (allowed.includes(rawType as EmailOtpType) ? rawType : 'email') as EmailOtpType;
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (!error && data.session) {
          stripAuthParamsFromBrowserUrl();
          setRedirecting(true);
          await redirectToTarget(data.session);
          return;
        }
      }

      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        stripAuthParamsFromBrowserUrl();
        setRedirecting(true);
        await redirectToTarget(existingSession);
        return;
      }

      const code = searchParams?.get('code') ?? params.code;
      if (code) {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError && data?.session) {
            stripAuthParamsFromBrowserUrl();
            setRedirecting(true);
            await redirectToTarget(data.session);
            return;
          }

          const retryAfterError =
            exchangeError &&
            (isAuthPKCECodeVerifierMissingError(exchangeError) ||
              (exchangeError.message ?? '').toLowerCase().includes('code verifier'));

          if (retryAfterError) {
            const fallbackSession = await exchangeCodeWithoutPkceVerifier(code);
            if (fallbackSession) {
              const { error: setErr } = await supabase.auth.setSession({
                access_token: fallbackSession.access_token,
                refresh_token: fallbackSession.refresh_token,
              });
              if (!setErr) {
                stripAuthParamsFromBrowserUrl();
                setRedirecting(true);
                await redirectToTarget(fallbackSession);
                return;
              }
            }
          }

          const { data: { session: sessionAfterError } } = await supabase.auth.getSession();
          if (sessionAfterError) {
            stripAuthParamsFromBrowserUrl();
            setRedirecting(true);
            await redirectToTarget(sessionAfterError);
            return;
          }
        } catch (err) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            stripAuthParamsFromBrowserUrl();
            setRedirecting(true);
            await redirectToTarget(session);
            return;
          }
          console.error('[auth/callback] Exception exchangeCodeForSession:', err);
        }
      } else {
        const hash = window.location.hash;
        const hasHashTokens = hash.includes('access_token') || hash.includes('refresh_token');
        if (hasHashTokens) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            stripAuthParamsFromBrowserUrl();
            setRedirecting(true);
            await redirectToTarget(session);
            return;
          }
        }
      }

      const { data: { session: finalSession } } = await supabase.auth.getSession();
      if (finalSession) {
        stripAuthParamsFromBrowserUrl();
        setRedirecting(true);
        await redirectToTarget(finalSession);
        return;
      }

      setRedirecting(true);
      router.replace(`/${locale}/login?error=auth-callback-failed`);
    }

    void handleCallback();
  }, [router, locale, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 [color-scheme:light]">
      <BrandLoadingOverlay active />
      <span className="sr-only">{t('redirecting')}</span>
    </div>
  );
}
