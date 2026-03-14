'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { toast } from 'sonner';

export function UpgradeSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const status = searchParams?.get('status');
    if (status !== 'upgraded' || shownRef.current) return;

    shownRef.current = true;
    toast.success('Plan mis à jour', {
      description: 'Votre abonnement a bien été modifié. Les nouvelles fonctionnalités sont disponibles.',
      duration: 5000,
    });
    router.refresh();
    const t1 = setTimeout(() => router.refresh(), 1500);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('status');
    const qs = params.toString();
    const cleanUrl = pathname + (qs ? `?${qs}` : '');
    const t2 = setTimeout(() => router.replace(cleanUrl, { scroll: false }), 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isMounted, searchParams, router, pathname]);

  return null;
}
