'use client';

import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { HOME_TESTIMONIAL_KEYS, type HomeTestimonialId } from '@/lib/landing/home-testimonial-keys';
import type { ReputexaPlatformReviewCard } from '@/lib/reputexa-platform-reviews/landing-data';

function StarRow() {
  return (
    <div className="flex gap-0.5 mb-4 shrink-0" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-star fill-star"
        >
          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
        </svg>
      ))}
    </div>
  );
}

const CARD_SHELL =
  'flex h-full min-h-[300px] w-[min(88vw,22rem)] sm:w-[22rem] shrink-0 flex-col rounded-2xl border border-border bg-card p-6 shadow-sm';

/**
 * Masque alpha : transparent = masqué, blanc = visible.
 * Spec desktop : ~1 cm « zone morte » puis rampe ~3 cm (×3 vs 1 cm) — sur petit écran les clamp
 * évitent de dévorer toute la largeur (cause du rendu « moche » en 3 cm fixes).
 * Rampe multi-étapes = entrée plus douce qu’un linear transparent → #fff.
 */
const MASK_EDGE = 'clamp(0px, 1.25vw, 1cm)';
const MASK_RAMP = 'clamp(0.75rem, 4.25vw, 3cm)';
const MASK_INNER = `calc(${MASK_EDGE} + ${MASK_RAMP})`;
const MASK_L20 = `calc(${MASK_EDGE} + ${MASK_RAMP} * 0.22)`;
const MASK_L45 = `calc(${MASK_EDGE} + ${MASK_RAMP} * 0.48)`;
const MASK_L72 = `calc(${MASK_EDGE} + ${MASK_RAMP} * 0.76)`;

function buildTestimonialsEdgeMask(): CSSProperties {
  const grad = `linear-gradient(90deg,
    transparent 0,
    transparent ${MASK_EDGE},
    rgba(255,255,255,0.14) ${MASK_L20},
    rgba(255,255,255,0.38) ${MASK_L45},
    rgba(255,255,255,0.72) ${MASK_L72},
    #fff ${MASK_INNER},
    #fff calc(100% - ${MASK_INNER}),
    rgba(255,255,255,0.72) calc(100% - ${MASK_L72}),
    rgba(255,255,255,0.38) calc(100% - ${MASK_L45}),
    rgba(255,255,255,0.14) calc(100% - ${MASK_L20}),
    transparent calc(100% - ${MASK_EDGE}),
    transparent 100%)`;

  return {
    maskImage: grad,
    WebkitMaskImage: grad,
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskMode: 'alpha',
  } as CSSProperties;
}

const MARQUEE_EDGE_MASK = buildTestimonialsEdgeMask();

function TestimonialCard({ id }: { id: HomeTestimonialId }) {
  const t = useTranslations('HomePage.testimonials.items');
  return (
    <article className={CARD_SHELL}>
      <StarRow />
      <p className="text-sm leading-relaxed text-foreground/80 flex-1 min-h-0">
        &quot;{t(`${id}.quote`)}&quot;
      </p>
      <div className="mt-auto shrink-0 space-y-1 border-t border-border/50 pt-4">
        <p className="text-sm font-semibold text-foreground">{t(`${id}.name`)}</p>
        <p className="text-xs leading-snug text-muted-foreground">{t(`${id}.role`)}</p>
        <p className="pt-1 text-xs font-medium text-muted-foreground">{t(`${id}.country`)}</p>
      </div>
    </article>
  );
}

function DynamicTestimonialCard({ item }: { item: ReputexaPlatformReviewCard }) {
  return (
    <article className={`${CARD_SHELL} ring-1 ring-indigo-500/10`}>
      <StarRow />
      <p className="text-sm leading-relaxed text-foreground/80 flex-1 min-h-0">&quot;{item.quote}&quot;</p>
      <div className="mt-auto shrink-0 space-y-1 border-t border-border/50 pt-4">
        <p className="text-sm font-semibold text-foreground">{item.name}</p>
        <p className="text-xs leading-snug text-muted-foreground">{item.role}</p>
        <p className="pt-1 text-xs font-medium text-muted-foreground">{item.country}</p>
      </div>
    </article>
  );
}

type MarqueeProps = {
  /** Témoignages clients réels (après modération), affichés en premier dans la grille. */
  dynamicItems?: ReputexaPlatformReviewCard[];
};

export function LandingTestimonialsMarquee({ dynamicItems = [] }: MarqueeProps) {
  const t = useTranslations('HomePage.testimonials');

  const renderTrack = (keyPrefix: string) => (
    <>
      {dynamicItems.map((item) => (
        <DynamicTestimonialCard key={`${keyPrefix}-d-${item.id}`} item={item} />
      ))}
      {HOME_TESTIMONIAL_KEYS.map((id) => (
        <TestimonialCard key={`${keyPrefix}-${id}`} id={id} />
      ))}
    </>
  );

  return (
    <div className="w-full" aria-label={t('marqueeAriaLabel')}>
      <div className="relative rounded-sm bg-white">
        <div className="testimonials-marquee-viewport relative overflow-hidden py-1" style={MARQUEE_EDGE_MASK}>
          <div className="flex w-max gap-6 animate-testimonials-marquee-scroll items-stretch">
            {renderTrack('a')}
            {renderTrack('b')}
          </div>
        </div>
      </div>
    </div>
  );
}
