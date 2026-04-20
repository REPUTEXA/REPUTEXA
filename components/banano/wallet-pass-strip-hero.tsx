'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  computeStripExtractRect,
  WALLET_STRIP_ASPECT,
  type NormalizedRect,
  type WalletStripCrop,
} from '@/lib/wallet/wallet-strip-crop';

type WalletPassStripHeroProps = {
  src: string;
  crop: WalletStripCrop;
  stripPreCrop: NormalizedRect | null;
  className?: string;
};

/**
 * Aperçu strip aligné sur sharp (extract + resize) : position absolue après chargement des dimensions intrinsèques.
 */
export function WalletPassStripHero({ src, crop, stripPreCrop, className }: WalletPassStripHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [cw, setCw] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCw(el.clientWidth);
    });
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const rect = useMemo(() => {
    if (!natural) return null;
    return computeStripExtractRect(natural.w, natural.h, WALLET_STRIP_ASPECT, crop, stripPreCrop);
  }, [natural, crop, stripPreCrop]);

  const scale = rect && cw > 0 ? cw / rect.width : 1;

  const imgStyle: CSSProperties =
    natural && rect && cw > 0
      ? {
          position: 'absolute',
          display: 'block',
          width: natural.w * scale,
          height: natural.h * scale,
          left: -rect.left * scale,
          top: -rect.top * scale,
          maxWidth: 'none',
        }
      : {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: `${crop.focalX * 100}% ${crop.focalY * 100}%`,
          transform: crop.zoom !== 1 ? `scale(${crop.zoom})` : undefined,
          transformOrigin: `${crop.focalX * 100}% ${crop.focalY * 100}%`,
        };

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden rounded-[inherit] ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        decoding="async"
        draggable={false}
        className={natural && rect && cw > 0 ? '' : 'h-full w-full'}
        style={imgStyle}
        onLoad={(e) => {
          const im = e.currentTarget;
          setNatural({ w: im.naturalWidth, h: im.naturalHeight });
        }}
      />
    </div>
  );
}
