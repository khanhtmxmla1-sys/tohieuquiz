import { describe, expect, it } from 'vitest';
import { COMPETITION_ENTRY_PREFLIGHT_REASONS } from '../shared/competition-portal.contract';
import {
  getCompetitionPreflightErrorMessage,
  getCompetitionPreflightReasonMessage,
} from '../src/features/competition/portal/student/studentCompetitionPresentation';

describe('student competition preflight presentation', () => {
  it.each(COMPETITION_ENTRY_PREFLIGHT_REASONS)('maps %s to a friendly message', reason => {
    const message = getCompetitionPreflightReasonMessage(reason);

    expect(message).toBeTruthy();
    expect(message).not.toBe(reason);
    expect(message).not.toMatch(/School Exam|SCHOOL_EXAM_/);
  });

  it('uses a friendly fallback for an unknown error without exposing its raw message', () => {
    const rawMessage = 'JOIN_LIVE_EXAM_INTERNAL_FAILURE';
    const message = getCompetitionPreflightErrorMessage(new Error(rawMessage));

    expect(message).toBe('Không thể tham gia thi cấp trường lúc này. Em hãy thử lại sau.');
    expect(message).not.toContain(rawMessage);
  });
});
