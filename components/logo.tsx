import React from 'react';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg';
};

export function Logo({ size = 'md' }: LogoProps) {
  const dimension =
    size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div
      className={`${dimension} rounded-lg gradient-primary flex items-center justify-center shrink-0`}
    >
      <span className={`font-display font-bold text-white ${textSize} leading-none`}>
        R
      </span>
    </div>
  );
}

