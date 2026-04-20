import type { LucideIcon } from 'lucide-react';
import {
  Beef,
  Coffee,
  Dumbbell,
  Flower2,
  Gift,
  Heart,
  Pill,
  Scissors,
  Sparkles,
  Star,
} from 'lucide-react';
import type { WalletStampIconId } from '@/lib/wallet/presets';

export const STAMP_ICON_COMPONENTS: Record<WalletStampIconId, LucideIcon> = {
  star: Star,
  heart: Heart,
  coffee: Coffee,
  beef: Beef,
  scissors: Scissors,
  sparkles: Sparkles,
  pill: Pill,
  flower: Flower2,
  dumbbell: Dumbbell,
  gift: Gift,
};
