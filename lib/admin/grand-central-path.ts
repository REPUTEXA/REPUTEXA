/**
 * Surfaces « Grand Central » : pages admin + API admin.
 */

export function isGrandCentralAdminPagePath(pathname: string): boolean {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return p.includes('/dashboard/admin');
}

export function isGrandCentralAdminApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/admin/');
}

export function isGrandCentralSurfacePath(pathname: string): boolean {
  return isGrandCentralAdminPagePath(pathname) || isGrandCentralAdminApiPath(pathname);
}
