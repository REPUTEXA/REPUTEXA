'use client';

import type { ReactNode } from 'react';

type StatsCardProps = {
  children: ReactNode;
  className?: string;
};

export function StatsCard({ children, className = '' }: StatsCardProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

