/**
 * Omni-Synapse — Écosystème Auto-Évolutif (orchestration des 4 protocoles).
 */

export type {
  HauteCoutureExecutionInput,
  HauteCoutureExecutionResult,
  OmniIngestChannel,
  OmniInteractionMemoryRow,
  PublicationFollowupOutcome,
  RedTeamVerdict,
  RoundTableInput,
  RoundTableResult,
} from './types';

export { ingestInteractionMemory, recallInteractionMemories } from './perception';
export type { IngestInteractionParams, SemanticRecallParams } from './perception';

export { normalizeReviewerKey, countOmniPriorReviewerMemories } from './relational-memory';

export {
  combinePriorityScore,
  runLoyaltyRound,
  runPsychologistRound,
  runSeoStrategistRound,
  runVirtualRoundTable,
} from './cognition-round-table';

export { executeHauteCoutureReply } from './execution-haute-couture';

export {
  analyzeFailureAndProposePromptDelta,
  inferOutcomeFromQueueMetadata,
  mergePromptAddonIntoProfile,
  registerPublicationFollowup,
} from './recursive-feedback';
export type { AnalyzeFailureParams, ProcessFollowupRow, RegisterFollowupParams } from './recursive-feedback';

export {
  safeIngestGoogleReviewSignal,
  safeIngestInteractionMemory,
  safeIngestPlatformReviewWebhook,
  safeIngestPosQueueEvent,
  safeIngestStripeBillingSignal,
  safeIngestWhatsAppOutbound,
  safeScheduleOmniPublicationFollowup,
} from './integrations';
