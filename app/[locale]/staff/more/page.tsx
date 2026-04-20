'use client';

import { useTranslations } from 'next-intl';
import { clientSignOutWithServerSession } from '@/lib/auth/client-sign-out';
import { useRouter } from '@/i18n/navigation';

export default function StaffMorePage() {
  const t = useTranslations('Staff.more');
  const router = useRouter();

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
      <p className="text-sm text-slate-600 dark:text-zinc-400">{t('pushHint')}</p>
      <button
        type="button"
        className="w-full min-h-[48px] rounded-xl border border-slate-200 dark:border-zinc-700 font-semibold text-slate-900 dark:text-white"
        onClick={async () => {
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
          }
          const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapid || !('serviceWorker' in navigator)) {
            return;
          }
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapid),
          });
          const json = sub.toJSON();
          await fetch('/api/staff/push-subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: json.endpoint,
              keys: json.keys,
            }),
          });
        }}
      >
        {t('enablePush')}
      </button>
      <button
        type="button"
        className="w-full min-h-[48px] rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold"
        onClick={async () => {
          await clientSignOutWithServerSession();
          router.replace('/login');
        }}
      >
        {t('signOut')}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
