/** Clés stables pour HomePage.testimonials.items — alignées sur messages/*.json */
export const HOME_TESTIMONIAL_KEYS = [
  'sophie',
  'marco',
  'isabelle',
  'matteo',
  'yuki',
  'james',
  'lukas',
  'elena',
  'thiago',
  'chen',
  'sarah',
] as const;

export type HomeTestimonialId = (typeof HOME_TESTIMONIAL_KEYS)[number];

export const HOME_TESTIMONIAL_COUNT = HOME_TESTIMONIAL_KEYS.length;
