'use client';

import { useRouter } from '@/i18n/navigation';
import { clientSignOutWithServerSession } from '@/lib/auth/client-sign-out';

export function StaffRevokedBanner({
  message,
  signOutLabel,
}: {
  message: string;
  signOutLabel: string;
}) {
  const router = useRouter();
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 px-6 bg-slate-50 dark:bg-[#030303]">
      <p className="text-center text-slate-800 dark:text-zinc-100 max-w-md">{message}</p>
      <button
        type="button"
        className="min-h-[44px] px-6 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold text-sm"
        onClick={async () => {
          await clientSignOutWithServerSession();
          router.replace(`/login`);
        }}
      >
        {signOutLabel}
      </button>
    </div>
  );
}
