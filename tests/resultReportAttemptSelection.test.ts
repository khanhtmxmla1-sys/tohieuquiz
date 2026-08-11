import { describe, expect, it } from 'vitest';
import {
  buildResultReportCohort,
  type ResultReportRosterRow,
  type ResultReportSourceRow,
} from '../workers/src/routes/resultReports/attemptSelection';

const roster: ResultReportRosterRow[] = [
  { id: 'student-an', fullName: 'Nguy?n V?n An', username: 'an.4a9', parentPhone: '0901000001' },
  { id: 'student-binh', fullName: 'Tr?n Minh B?nh', username: 'binh.4a9', parentPhone: '0901000002' },
  { id: 'student-chi', fullName: 'L? Th? Chi', username: 'chi.4a9', parentPhone: null },
];

const results: ResultReportSourceRow[] = [
  { id: 'an-first', studentId: 'student-an', studentName: 'Nguy?n V?n An', score: 6, correctCount: 6, totalQuestions: 10, submittedAt: '2026-07-10T08:00:00.000Z', quizTitle: 'B?i 1' },
  { id: 'an-high', studentId: 'student-an', studentName: 'NGUY?N V?N AN', score: 9, correctCount: 9, totalQuestions: 10, submittedAt: '2026-07-11T08:00:00.000Z', quizTitle: 'B?i 1' },
  { id: 'an-latest', studentId: 'student-an', studentName: 'T?n hi?n th? c? th? ??i', score: 8, correctCount: 8, totalQuestions: 10, submittedAt: '2026-07-12T08:00:00.000Z', quizTitle: 'B?i 1' },
  { id: 'binh-high-old', studentId: 'student-binh', studentName: 'Tr?n Minh B?nh', score: 9, correctCount: 9, totalQuestions: 10, submittedAt: '2026-07-09T08:00:00.000Z', quizTitle: 'B?i 1' },
  { id: 'binh-high-new', studentId: 'student-binh', studentName: 'Tr?n Minh B?nh', score: 9, correctCount: 9, totalQuestions: 10, submittedAt: '2026-07-13T08:00:00.000Z', quizTitle: 'B?i 1' },
];

describe('result report attempt selection', () => {
  it('selects latest attempts by canonical student_id', () => {
    const cohort = buildResultReportCohort(roster, results, 'latest');
    expect(cohort.ready).toHaveLength(2);
    expect(cohort.ready.find((item) => item.student.id === 'student-an')).toMatchObject({ attemptCount: 3, result: { id: 'an-latest', score: 8 } });
    expect(cohort.notCompleted).toEqual([expect.objectContaining({ id: 'student-chi' })]);
  });

  it('selects highest and breaks ties by newest attempt', () => {
    const cohort = buildResultReportCohort(roster, results, 'highest');
    expect(cohort.ready.find((item) => item.student.id === 'student-an')?.result.id).toBe('an-high');
    expect(cohort.ready.find((item) => item.student.id === 'student-binh')?.result.id).toBe('binh-high-new');
  });

  it('selects first attempt', () => {
    const cohort = buildResultReportCohort(roster, results, 'first');
    expect(cohort.ready.find((item) => item.student.id === 'student-an')?.result.id).toBe('an-first');
    expect(cohort.ready.find((item) => item.student.id === 'student-binh')?.result.id).toBe('binh-high-old');
  });

  it('keeps duplicate student names separate by canonical id', () => {
    const duplicateRoster = [
      ...roster,
      { id: 'student-an-2', fullName: 'Nguy?n V?n An', username: 'an.duplicate', parentPhone: null },
    ];
    const duplicateResults = [
      ...results,
      { id: 'an2', studentId: 'student-an-2', studentName: 'Nguy?n V?n An', score: 7, correctCount: 7, totalQuestions: 10, submittedAt: '2026-07-14T08:00:00.000Z', quizTitle: 'B?i 1' },
    ];
    const cohort = buildResultReportCohort(duplicateRoster, duplicateResults, 'latest');
    expect(cohort.ready.find((item) => item.student.id === 'student-an')?.result.id).toBe('an-latest');
    expect(cohort.ready.find((item) => item.student.id === 'student-an-2')?.result.id).toBe('an2');
    expect(cohort.unresolved).toEqual([]);
  });

  it('fails closed for legacy source rows without student_id', () => {
    const cohort = buildResultReportCohort(roster, results.map((result) => ({ ...result, studentId: null })), 'latest');
    expect(cohort.ready).toEqual([]);
    expect(cohort.notCompleted.map((student) => student.id)).toEqual(['student-an', 'student-binh', 'student-chi']);
  });
});
