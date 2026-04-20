import Image from 'next/image';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** À activer sur le logo above-the-fold (home, login) pour le LCP. */
  priority?: boolean;
  className?: string;
};

const DIMENSIONS: Record<NonNullable<LogoProps['size']>, number> = {
  sm: 28,
  md: 32,
  lg: 48,
  xl: 64,
};

/** Vector mark (`/reputexa-mark.svg`) for crisp rendering on all densities. */
export function Logo({ size = 'md', priority = false, className }: LogoProps) {
  const px = DIMENSIONS[size];
  return (
    <Image
      src="/reputexa-mark.svg"
      alt=""
      width={px}
      height={px}
      priority={priority}
      className={['shrink-0 rounded-[14px] shadow-sm', className].filter(Boolean).join(' ')}
    />
  );
}
