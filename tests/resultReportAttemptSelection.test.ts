import { describe, expect, it } from 'vitest';
import {
  buildResultReportCohort,
  type ResultReportRosterRow,
  type ResultReportSourceRow,
} from '../workers/src/routes/resultReports/attemptSelection';

const roster: ResultReportRosterRow[] = [
  { id: 'student-an', fullName: 'Nguyễn Văn An', username: 'an.4a9', parentPhone: '0901000001' },
  { id: 'student-binh', fullName: 'Trần Minh Bình', username: 'binh.4a9', parentPhone: '0901000002' },
  { id: 'student-chi', fullName: 'Lê Thị Chi', username: 'chi.4a9', parentPhone: null },
];

const results: ResultReportSourceRow[] = [
  {
    id: 'an-first', studentName: ' Nguyễn Văn An ', score: 6, correctCount: 6,
    totalQuestions: 10, submittedAt: '2026-07-10T08:00:00.000Z', quizTitle: 'Bài 1',
  },
  {
    id: 'an-high', studentName: 'nguyễn văn an', score: 9, correctCount: 9,
    totalQuestions: 10, submittedAt: '2026-07-11T08:00:00.000Z', quizTitle: 'Bài 1',
  },
  {
    id: 'an-latest', studentName: 'NGUYỄN VĂN AN', score: 8, correctCount: 8,
    totalQuestions: 10, submittedAt: '2026-07-12T08:00:00.000Z', quizTitle: 'Bài 1',
  },
  {
    id: 'binh-high-old', studentName: 'Trần Minh Bình', score: 9, correctCount: 9,
    totalQuestions: 10, submittedAt: '2026-07-09T08:00:00.000Z', quizTitle: 'Bài 1',
  },
  {
    id: 'binh-high-new', studentName: 'Trần Minh Bình', score: 9, correctCount: 9,
    totalQuestions: 10, submittedAt: '2026-07-13T08:00:00.000Z', quizTitle: 'Bài 1',
  },
];

describe('result report attempt selection', () => {
  it('selects the latest attempt and keeps one cohort item per student', () => {
    const cohort = buildResultReportCohort(roster, results, 'latest');

    expect(cohort.ready).toHaveLength(2);
    expect(cohort.ready.find((item) => item.student.id === 'student-an')).toMatchObject({
      attemptCount: 3,
      result: { id: 'an-latest', score: 8 },
    });
    expect(cohort.ready.filter((item) => item.student.id === 'student-an')).toHaveLength(1);
    expect(cohort.notCompleted).toEqual([
      expect.objectContaining({ id: 'student-chi', fullName: 'Lê Thị Chi' }),
    ]);
  });

  it('selects the highest score and breaks a tie with the newest attempt', () => {
    const cohort = buildResultReportCohort(roster, results, 'highest');

    expect(cohort.ready.find((item) => item.student.id === 'student-an')?.result.id).toBe('an-high');
    expect(cohort.ready.find((item) => item.student.id === 'student-binh')?.result.id).toBe('binh-high-new');
  });

  it('selects the first attempt', () => {
    const cohort = buildResultReportCohort(roster, results, 'first');

    expect(cohort.ready.find((item) => item.student.id === 'student-an')?.result.id).toBe('an-first');
    expect(cohort.ready.find((item) => item.student.id === 'student-binh')?.result.id).toBe('binh-high-old');
  });

  it('marks duplicate normalized roster names unresolved instead of assigning a result', () => {
    const duplicateRoster: ResultReportRosterRow[] = [
      ...roster,
      { id: 'student-an-2', fullName: '  NGUYỄN VĂN AN ', username: 'an.duplicate', parentPhone: null },
    ];

    const cohort = buildResultReportCohort(duplicateRoster, results, 'latest');

    expect(cohort.ready.some((item) => item.student.id === 'student-an')).toBe(false);
    expect(cohort.ready.some((item) => item.student.id === 'student-an-2')).toBe(false);
    expect(cohort.unresolved).toEqual(expect.arrayContaining([
      expect.objectContaining({ student: expect.objectContaining({ id: 'student-an' }), reason: 'duplicate_name' }),
      expect.objectContaining({ student: expect.objectContaining({ id: 'student-an-2' }), reason: 'duplicate_name' }),
    ]));
    expect(cohort.notCompleted.some((item) => item.id === 'student-an')).toBe(false);
  });

  it('uses deterministic ordering by roster order for all output groups', () => {
    const duplicateRoster: ResultReportRosterRow[] = [
      roster[2], roster[0],
      { id: 'student-an-2', fullName: 'Nguyễn Văn An', username: 'an.duplicate', parentPhone: null },
      roster[1],
    ];

    const cohort = buildResultReportCohort(duplicateRoster, results, 'latest');

    expect(cohort.notCompleted.map((student) => student.id)).toEqual(['student-chi']);
    expect(cohort.unresolved.map((item) => item.student.id)).toEqual(['student-an', 'student-an-2']);
    expect(cohort.ready.map((item) => item.student.id)).toEqual(['student-binh']);
  });
});
