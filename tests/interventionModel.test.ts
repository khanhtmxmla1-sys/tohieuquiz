import { describe, expect, it } from 'vitest';
import {
  buildInterventionReadinessFromData,
  createEmptyInterventionReadiness,
} from '../workers/src/services/interventionModel';

const emptyReadiness = {
  studentsInScope: 0,
  resultsInWindow: 0,
  quizzesInScope: 0,
  questionsInScope: 0,
  questionsWithSkillMetadata: 0,
  skillMetadataCoveragePercent: 0,
  studentSkillSignals: 0,
  eligibleSignals: 0,
  excludedSignals: {
    stable: 0,
    insufficientSamples: 0,
    lowConfidence: 0,
    missingMetadata: 0,
  },
};

describe('intervention pure model', () => {
  it('returns a new zero-valued readiness model for an empty scope', () => {
    const first = createEmptyInterventionReadiness();
    const second = createEmptyInterventionReadiness();

    expect(first).toEqual(emptyReadiness);
    expect(buildInterventionReadinessFromData([], [], [])).toEqual(emptyReadiness);
    expect(first).not.toBe(second);
    expect(first.excludedSignals).not.toBe(second.excludedSignals);
  });
});
