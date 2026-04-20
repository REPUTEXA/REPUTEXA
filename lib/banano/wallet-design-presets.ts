/**
 * Thèmes métiers : couleurs Apple Wallet + ambiance **pleine carte** (aperçu web uniquement).
 * Sélecteurs : `.wallet-pass-preview-card`, `.wallet-pass-preview-strip`, `.wallet-pass-preview-ambient`.
 */
export type WalletIndustryPreset = {
  id: string;
  background_color: string;
  foreground_color: string;
  label_color: string;
  custom_css: string | null;
};

const CARD_SHELL = `box-shadow: 0 28px 56px -16px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.08) !important;`;

/** Ambiance premium cohérente : fond carte + bandeau large + halo. */
function proPassTheme(cardGradient: string, stripGradient: string, ambientGradient: string): string {
  return `.wallet-pass-preview .wallet-pass-preview-card {
  background-image: ${cardGradient} !important;
  background-color: transparent !important;
  ${CARD_SHELL}
}
.wallet-pass-preview .wallet-pass-preview-strip {
  background: ${stripGradient} !important;
  min-height: 112px !important;
}
.wallet-pass-preview .wallet-pass-preview-ambient {
  background: ${ambientGradient} !important;
  opacity: 1 !important;
}`;
}

export const WALLET_INDUSTRY_PRESETS: readonly WalletIndustryPreset[] = [
  {
    id: 'bakery',
    background_color: '#3d2b1f',
    foreground_color: '#fffbeb',
    label_color: '#fcd34d',
    custom_css: proPassTheme(
      'linear-gradient(168deg, #422006 0%, #78350f 42%, #1c1410 100%)',
      'linear-gradient(105deg, #92400e 0%, #f59e0b 38%, #fde68a 72%, #fffbeb 100%)',
      'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(253,230,138,0.35) 0%, transparent 58%), radial-gradient(ellipse 90% 70% at 100% 100%, rgba(120,53,15,0.5) 0%, transparent 55%)'
    ),
  },
  {
    id: 'butcher',
    background_color: '#450a0a',
    foreground_color: '#fef2f2',
    label_color: '#fca5a5',
    custom_css: proPassTheme(
      'linear-gradient(172deg, #7f1d1d 0%, #450a0a 38%, #1a0505 100%)',
      'linear-gradient(95deg, #7f1d1d 0%, #dc2626 30%, #f87171 65%, #fecaca 100%)',
      'radial-gradient(ellipse 110% 90% at 50% -10%, rgba(254,202,202,0.45) 0%, transparent 55%), radial-gradient(ellipse 70% 60% at 0% 100%, rgba(127,29,29,0.55) 0%, transparent 50%)'
    ),
  },
  {
    id: 'cafe',
    background_color: '#292524',
    foreground_color: '#faf5f0',
    label_color: '#d6d3d1',
    custom_css: proPassTheme(
      'linear-gradient(160deg, #1c1917 0%, #292524 45%, #0c0a09 100%)',
      'linear-gradient(118deg, #292524 0%, #57534e 40%, #a8a29e 88%)',
      'radial-gradient(ellipse 100% 70% at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 50%)'
    ),
  },
  {
    id: 'restaurant',
    background_color: '#1c1410',
    foreground_color: '#fff7ed',
    label_color: '#fdba74',
    custom_css: proPassTheme(
      'linear-gradient(165deg, #431407 0%, #1c1410 50%, #0f0a08 100%)',
      'linear-gradient(112deg, #9a3412 0%, #c2410c 35%, #fed7aa 95%)',
      'radial-gradient(ellipse 90% 80% at 80% -20%, rgba(254,215,170,0.25) 0%, transparent 55%)'
    ),
  },
  {
    id: 'hair',
    background_color: '#18181b',
    foreground_color: '#fafafa',
    label_color: '#e879f9',
    custom_css: proPassTheme(
      'linear-gradient(155deg, #18181b 0%, #3b0764 55%, #18181b 100%)',
      'linear-gradient(120deg, #4c1d95 0%, #a855f7 45%, #fae8ff 100%)',
      'radial-gradient(ellipse 85% 70% at 30% 0%, rgba(232,121,249,0.35) 0%, transparent 55%)'
    ),
  },
  {
    id: 'florist',
    background_color: '#14532d',
    foreground_color: '#ecfdf5',
    label_color: '#86efac',
    custom_css: proPassTheme(
      'linear-gradient(160deg, #14532d 0%, #166534 40%, #052e16 100%)',
      'linear-gradient(115deg, #15803d 0%, #4ade80 42%, #bbf7d0 100%)',
      'radial-gradient(ellipse 100% 75% at 50% -5%, rgba(187,247,208,0.4) 0%, transparent 58%)'
    ),
  },
  {
    id: 'pharmacy',
    background_color: '#0f172a',
    foreground_color: '#f8fafc',
    label_color: '#94a3b8',
    custom_css: proPassTheme(
      'linear-gradient(165deg, #0f172a 0%, #134e4a 42%, #020617 100%)',
      'linear-gradient(125deg, #0f766e 0%, #2dd4bf 45%, #ccfbf1 100%)',
      'radial-gradient(ellipse 90% 70% at 50% 0%, rgba(45,212,191,0.22) 0%, transparent 55%)'
    ),
  },
  {
    id: 'garage',
    background_color: '#171717',
    foreground_color: '#fafaf9',
    label_color: '#fb923c',
    custom_css: proPassTheme(
      'linear-gradient(170deg, #262626 0%, #171717 50%, #0a0a0a 100%)',
      'linear-gradient(110deg, #404040 0%, #737373 35%, #fb923c 92%)',
      'radial-gradient(ellipse 80% 70% at 100% 0%, rgba(251,146,60,0.25) 0%, transparent 50%)'
    ),
  },
  {
    id: 'beauty',
    background_color: '#1e1b4b',
    foreground_color: '#fdf4ff',
    label_color: '#e9d5ff',
    custom_css: proPassTheme(
      'linear-gradient(158deg, #312e81 0%, #1e1b4b 48%, #0f0a2e 100%)',
      'linear-gradient(118deg, #7c3aed 0%, #c026d3 40%, #fce7f3 100%)',
      'radial-gradient(ellipse 95% 80% at 50% -15%, rgba(233,213,255,0.35) 0%, transparent 58%)'
    ),
  },
  {
    id: 'retail',
    background_color: '#171717',
    foreground_color: '#fafafa',
    label_color: '#a3a3a3',
    custom_css: proPassTheme(
      'linear-gradient(165deg, #262626 0%, #171717 45%, #0a0a0a 100%)',
      'linear-gradient(130deg, #525252 0%, #a3a3a3 50%, #f5f5f5 100%)',
      'radial-gradient(ellipse 90% 75% at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 55%)'
    ),
  },
  {
    id: 'fitness',
    background_color: '#0c1526',
    foreground_color: '#e0f2fe',
    label_color: '#38bdf8',
    custom_css: proPassTheme(
      'linear-gradient(165deg, #0c4a6e 0%, #0c1526 50%, #020617 100%)',
      'linear-gradient(118deg, #0369a1 0%, #0ea5e9 42%, #bae6fd 100%)',
      'radial-gradient(ellipse 100% 85% at 50% -10%, rgba(56,189,248,0.4) 0%, transparent 58%)'
    ),
  },
  {
    id: 'hotel',
    background_color: '#0f172a',
    foreground_color: '#fefce8',
    label_color: '#eab308',
    custom_css: proPassTheme(
      'linear-gradient(165deg, #1e1b4b 0%, #0f172a 42%, #1c1409 100%)',
      'linear-gradient(115deg, #713f12 0%, #ca8a04 38%, #fef08a 100%)',
      'radial-gradient(ellipse 95% 75% at 50% -5%, rgba(234,179,8,0.28) 0%, transparent 55%)'
    ),
  },
];

export function getWalletPresetById(id: string): WalletIndustryPreset | undefined {
  return WALLET_INDUSTRY_PRESETS.find((p) => p.id === id);
}
