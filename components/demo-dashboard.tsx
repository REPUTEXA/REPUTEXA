'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { X, Zap } from 'lucide-react';

const TYPEWRITER_MS = 25;
const NOTIFICATION_DELAY_MS = 2000;

type ExampleConfig = {
  index: number;
  phone?: string;
  email?: string;
};

const EXAMPLES: ExampleConfig[] = [
  { index: 0, phone: '+33 1 23 45 67 89' },
  { index: 1, phone: '+33 1 58 96 32 10', email: 'contact@bistro-parisien.fr' },
  { index: 2, phone: '+33 4 72 11 22 33' },
  { index: 3, email: 'contact@spa-zenitude.fr' },
  { index: 4, phone: '+33 1 44 55 66 77' },
];

function playNotificationSound() {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return;

  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // ignore
  }
}

export function DemoDashboard({ onClose }: { onClose: () => void }) {
  const t = useTranslations('HomePage.demo');
  const locale = useLocale();

  const [example, setExample] = useState<ExampleConfig>(EXAMPLES[0]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(0);
  const [displayText, setDisplayText] = useState('');
  const [generated, setGenerated] = useState<boolean[]>([false, false, false]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const typewriterTimer = useRef<number | null>(null);

  useEffect(() => {
    const picked = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
    setExample(picked);
    setGenerated([false, false, false]);
    setSelectedIndex(null);
    setCurrentIndex(0);
    setDisplayText('');
    setShowNotification(false);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setShowNotification(true);
      playNotificationSound();
    }, NOTIFICATION_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const review = t(`examples.${example.index}.review`);
  const baseResponse = t(`examples.${example.index}.response`);
  const reviewer = t(`examples.${example.index}.reviewer`);
  const business = t(`examples.${example.index}.business`);

  let contactSentence = '';
  if (example.phone) {
    contactSentence =
      locale === 'fr'
        ? ` Vous pouvez nous joindre directement au ${example.phone} pour trouver la meilleure solution avec vous.`
        : ` You can reach us directly at ${example.phone} so we can find the best solution with you.`;
  } else if (example.email) {
    contactSentence =
      locale === 'fr'
        ? ` Vous pouvez nous écrire sur ${example.email} afin que nous puissions suivre votre dossier personnellement.`
        : ` You can email us at ${example.email} so we can personally follow up on your case.`;
  }

  const candidateResponses = useMemo(
    () => [
      baseResponse,
      locale === 'fr'
        ? `${baseResponse} Nous prenons votre retour très au sérieux et nous l'utilisons pour ajuster concrètement nos procédures en interne.`
        : `${baseResponse} We take your feedback very seriously and use it to concretely adjust our internal processes.`,
      baseResponse + contactSentence,
    ],
    [baseResponse, contactSentence, locale]
  );

  useEffect(() => {
    if (currentIndex === null) return;
    const text = candidateResponses[currentIndex] ?? '';
    if (!text) return;

    setDisplayText('');

    let i = 0;
    if (typewriterTimer.current !== null) {
      window.clearInterval(typewriterTimer.current);
    }
    const id = window.setInterval(() => {
      i += 1;
      setDisplayText(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setGenerated((prev) => {
          const next = [...prev];
          next[currentIndex] = true;
          return next;
        });
        if (currentIndex < 2) {
          setCurrentIndex(currentIndex + 1);
        } else {
          const chosen = contactSentence ? 2 : 1;
          setSelectedIndex(chosen);
          setCurrentIndex(null);
        }
      }
    }, TYPEWRITER_MS);
    typewriterTimer.current = id;

    return () => {
      window.clearInterval(id);
    };
  }, [currentIndex, candidateResponses, contactSentence]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-5xl rounded-2xl overflow-hidden border border-white/10"
        style={{
          backgroundColor: '#0B0E14',
          boxShadow: '0 0 80px -20px rgba(139, 92, 246, 0.4), 0 0 40px -10px rgba(59, 130, 246, 0.3)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10 transition-colors"
          aria-label={t('close')}
        >
          <X className="w-5 h-5" aria-hidden />
        </button>

        {showNotification && (
          <div className="absolute top-4 right-16 z-10 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 shadow-lg">
            <span className="text-xl" aria-hidden>💬</span>
            <span className="text-sm font-medium text-emerald-200">
              {t('whatsappAlert')}
            </span>
          </div>
        )}

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <span className="font-bold text-white text-lg">R</span>
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Dashboard de Commande REPUTEXA
              </h2>
              <span className="text-xs text-white/50">{business}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne gauche : avis + génération en cours */}
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-sm font-semibold text-pink-300">
                    SM
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white/90">{reviewer}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <svg
                            key={s}
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill={s <= 2 ? '#FBBF24' : 'none'}
                            stroke="#FBBF24"
                            strokeWidth="2"
                            className="shrink-0"
                            aria-hidden
                          >
                            <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-white/40 mb-2">{business}</p>
                    <p className="text-sm text-white/80 leading-relaxed italic">&quot;{review}&quot;</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-violet-500/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-blue-400" aria-hidden />
                  <span className="text-sm font-semibold text-blue-300">
                    {locale === 'fr'
                      ? `Génération des réponses IA (${generated.filter(Boolean).length + (currentIndex !== null ? 1 : 0)}/3)`
                      : `Generating AI replies (${generated.filter(Boolean).length + (currentIndex !== null ? 1 : 0)}/3)`}
                  </span>
                </div>
                <p className="text-sm text-white/90 leading-relaxed min-h-[4.5rem]">
                  {displayText}
                  {currentIndex !== null && (
                    <span
                      className="inline-block w-0.5 h-4 ml-0.5 bg-blue-400 animate-pulse align-middle"
                      aria-hidden
                    />
                  )}
                </p>
              </div>
            </div>

            {/* Colonne droite : les 3 réponses générées */}
            <div className="space-y-3">
              <p className="text-xs text-white/50">
                {locale === 'fr'
                  ? '3 réponses générées. REPUTEXA envoie automatiquement la meilleure selon des critères précis (ton, empathie, actionnable, contact direct…).'
                  : '3 responses generated. REPUTEXA automatically sends the best one based on precise criteria (tone, empathy, actionability, direct contact…).'}
              </p>

              {[0, 1, 2].map((idx) => {
                const text = candidateResponses[idx] ?? '';
                if (!generated[idx]) {
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 opacity-40 flex items-center justify-between text-xs text-white/60"
                    >
                      <span>
                        {locale === 'fr'
                          ? `Option ${idx + 1} · génération en cours…`
                          : `Option ${idx + 1} · generating…`}
                      </span>
                      <span className="h-3 w-3 rounded-full bg-blue-400 animate-pulse" aria-hidden />
                    </div>
                  );
                }

                const isSelected = selectedIndex === idx;

                return (
                  <div
                    key={idx}
                    className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500/10 text-emerald-50'
                        : 'border-white/10 bg-white/5 text-white/70'
                    } border`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {locale === 'fr' ? `Option ${idx + 1}` : `Option ${idx + 1}`}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                          {locale === 'fr' ? 'Choisie par REPUTEXA' : 'Selected by REPUTEXA'}
                        </span>
                      )}
                    </div>
                    <p>{text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
