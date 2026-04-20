/** Constantes partagées Forge — importables côté client (sans Prisma). */

export const IA_FORGE_AGENT_KEYS = [
  'reputexa_core',
  'babel',
  'nexus',
  'sentinel',
  'guardian',
] as const;

export type IaForgeAgentKey = (typeof IA_FORGE_AGENT_KEYS)[number];

export type IaForgeTrainingMode = 'continuous' | 'burst' | 'deep_dive';

export const IA_FORGE_LABELS: Record<IaForgeAgentKey, string> = {
  reputexa_core: 'Reputexa-Core',
  babel: 'Babel',
  nexus: 'Nexus',
  sentinel: 'Sentinel',
  guardian: 'Guardian',
};
