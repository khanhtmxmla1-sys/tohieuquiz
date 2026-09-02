import { describe, expect, it } from 'vitest';
import type { StudentCompetitionRound } from '../src/features/competition/studentCompetitionService';
import { mapRoundPresentation } from '../src/features/competition/portal/student/roundPresentation';

const round = (overrides: Partial<StudentCompetitionRound> = {}): StudentCompetitionRound => ({
  id: 'round-1',
  roundNumber: 1,
  maxAttempts: 3,
  passingScore: 70,
  status: 'OPEN',
  attemptsUsed: 0,
  bestScore: null,
  isPassed: false,
  progressStatus: null,
  ...overrides,
});

describe('mapRoundPresentation', () => {
  it.each([
    ['passed takes precedence over a closed round', round({ status: 'CLOSED', attemptsUsed: 3, isPassed: true }), true, 'PASSED', null],
    ['canonical passed progress takes precedence', round({ status: 'FINALIZED', progressStatus: 'PASSED' }), true, 'PASSED', null],
    ['open and unblocked with no attempts is open', round({ roundNumber: 2 }), false, 'OPEN', 'Vào thi vòng 2'],
    ['open after a failed attempt offers a retry', round({ roundNumber: 3, attemptsUsed: 1, bestScore: 55 }), false, 'FAILED_RETRY_AVAILABLE', 'Thi lại vòng 3'],
    ['an exhausted open round is closed', round({ attemptsUsed: 3 }), false, 'CLOSED', null],
    ['a closed round is closed', round({ status: 'CLOSED' }), false, 'CLOSED', null],
    ['a finalized round is closed', round({ status: 'FINALIZED' }), false, 'CLOSED', null],
    ['a not-open round is locked', round({ status: 'SCHEDULED' }), false, 'LOCKED', null],
    ['a canonical eligibility block locks an open round', round(), true, 'LOCKED', null],
  ] as const)('%s', (_name, canonicalRound, eligibilityBlocked, state, actionLabel) => {
    expect(mapRoundPresentation(canonicalRound, eligibilityBlocked)).toEqual({
      state,
      attemptsRemaining: Math.max(0, canonicalRound.maxAttempts - canonicalRound.attemptsUsed),
      actionLabel,
    });
  });
});
