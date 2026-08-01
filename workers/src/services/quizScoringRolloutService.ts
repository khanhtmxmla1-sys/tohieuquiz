import type { FeatureFlagSubject } from '../../../shared/feature-rollout.contract';
import { getFeatureFlag, resolveFeatureFlag } from './featureFlagService';

export const QUIZ_SCORING_CANONICAL_FLAG = 'quiz_scoring_canonical_v2' as const;
export const QUIZ_SCORING_SHADOW_FLAG = 'quiz_scoring_shadow_v2' as const;

export type QuizScoringRolloutMode = 'canonical' | 'shadow' | 'compatibility';

export const resolveQuizScoringRolloutModeFromDecisions = (
  canonicalEnabled: boolean,
  shadowEnabled: boolean,
): QuizScoringRolloutMode => {
  if (canonicalEnabled) return 'canonical';
  if (shadowEnabled) return 'shadow';
  return 'compatibility';
};

export async function resolveQuizScoringRolloutMode(
  db: D1Database,
  subject: FeatureFlagSubject,
): Promise<QuizScoringRolloutMode> {
  const canonicalConfig = await getFeatureFlag(db, QUIZ_SCORING_CANONICAL_FLAG).catch(() => null);
  const canonical = canonicalConfig
    ? await resolveFeatureFlag(canonicalConfig, subject).catch(() => ({ enabled: false }))
    : { enabled: false };
  if (canonical.enabled) return 'canonical';

  const shadowConfig = await getFeatureFlag(db, QUIZ_SCORING_SHADOW_FLAG).catch(() => null);
  const shadow = shadowConfig
    ? await resolveFeatureFlag(shadowConfig, subject).catch(() => ({ enabled: false }))
    : { enabled: false };
  return resolveQuizScoringRolloutModeFromDecisions(false, shadow.enabled);
}

export interface ScoringShadowObservationInput {
  quizId: string;
  canonicalScore: number;
  canonicalCorrectCount: number;
  canonicalTotalQuestions: number;
  submittedScore: unknown;
  submittedCorrectCount: unknown;
  submittedTotalQuestions: unknown;
}

const finiteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function buildScoringShadowObservation(input: ScoringShadowObservationInput) {
  const submittedScore = finiteNumber(input.submittedScore);
  const submittedCorrectCount = finiteNumber(input.submittedCorrectCount);
  const submittedTotalQuestions = finiteNumber(input.submittedTotalQuestions);
  return {
    event: 'quiz_scoring_shadow_comparison',
    quizId: String(input.quizId || ''),
    canonicalScore: input.canonicalScore,
    canonicalCorrectCount: input.canonicalCorrectCount,
    canonicalTotalQuestions: input.canonicalTotalQuestions,
    submittedScore,
    submittedCorrectCount,
    submittedTotalQuestions,
    scoreDelta: submittedScore === null
      ? null
      : Number((input.canonicalScore - submittedScore).toFixed(1)),
    correctCountDelta: submittedCorrectCount === null
      ? null
      : input.canonicalCorrectCount - submittedCorrectCount,
  };
}

export function recordScoringShadowObservation(
  mode: QuizScoringRolloutMode,
  input: ScoringShadowObservationInput,
  logger: (message: string) => void = console.info,
): void {
  if (mode !== 'shadow') return;
  logger(JSON.stringify(buildScoringShadowObservation(input)));
}
