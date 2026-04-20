/**
 * Anneau de focus clavier — à fusionner sur les contrôles qui appliquent `outline-none`
 * sans ring explicite (évite les boutons « invisibles » au Tab).
 */
export const uiFocusVisible =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-[#60a5fa] dark:focus-visible:ring-offset-zinc-950';
