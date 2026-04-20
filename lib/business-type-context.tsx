'use client';

import { createContext, useContext } from 'react';

export type BusinessType = 'physical' | 'online' | null;

const BusinessTypeContext = createContext<BusinessType>(null);

export function BusinessTypeProvider({
  value,
  children,
}: {
  value: BusinessType;
  children: React.ReactNode;
}) {
  return (
    <BusinessTypeContext.Provider value={value}>
      {children}
    </BusinessTypeContext.Provider>
  );
}

/** Retourne le business_type de l'utilisateur connecté ('physical' | 'online' | null). */
export function useBusinessType(): BusinessType {
  return useContext(BusinessTypeContext);
}

/** Retourne true si le dashboard est en mode e-commerce. */
export function useIsOnlineBusiness(): boolean {
  return useContext(BusinessTypeContext) === 'online';
}
