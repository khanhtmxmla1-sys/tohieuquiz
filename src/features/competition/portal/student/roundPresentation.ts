import type { CompetitionRoundPresentationState } from '../../../../../shared/competition-portal.contract';
import type { StudentCompetitionRound } from '../../studentCompetitionService';

export interface RoundPresentation {
  state: CompetitionRoundPresentationState;
  attemptsRemaining: number;
  actionLabel: string | null;
}

export function mapRoundPresentation(
  round: StudentCompetitionRound,
  eligibilityBlocked: boolean,
): RoundPresentation {
  const attemptsRemaining = Math.max(0, round.maxAttempts - round.attemptsUsed);
  const status = round.status.toUpperCase();
  const passed = round.isPassed === true || round.progressStatus?.toUpperCase() === 'PASSED';

  if (passed) return { state: 'PASSED', attemptsRemaining, actionLabel: null };
  if (status === 'CLOSED' || status === 'FINALIZED' || attemptsRemaining === 0) {
    return { state: 'CLOSED', attemptsRemaining, actionLabel: null };
  }
  if (status !== 'OPEN' || eligibilityBlocked) {
    return { state: 'LOCKED', attemptsRemaining, actionLabel: null };
  }
  if (round.attemptsUsed > 0) {
    return {
      state: 'FAILED_RETRY_AVAILABLE',
      attemptsRemaining,
      actionLabel: `Thi lại vòng ${round.roundNumber}`,
    };
  }
  return {
    state: 'OPEN',
    attemptsRemaining,
    actionLabel: `Vào thi vòng ${round.roundNumber}`,
  };
}
