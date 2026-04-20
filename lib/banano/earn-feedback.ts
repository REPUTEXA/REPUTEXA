/**
 * Retour discret après crédit fidélité (achat) : vibration courte + bip léger.
 * Silencieux si permission audio refusée ou APIs absentes.
 */
export function playEarnCreditFeedback(): void {
  if (typeof window === 'undefined') return;

  try {
    navigator.vibrate?.(22);
  } catch {
    /* iOS ignore parfois hors geste utilisateur */
  }

  try {
    const AC =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.055, t0 + 0.02);
    gain.gain.linearRampToValueAtTime(0.001, t0 + 0.075);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.08);
    osc.addEventListener('ended', () => {
      void ctx.close();
    });
  } catch {
    /* autoplay, contexte suspendu, etc. */
  }
}
