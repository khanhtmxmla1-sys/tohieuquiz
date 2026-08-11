import type {
  ResultReportAttemptPolicy,
  ResultReportCohortReadyItem,
  ResultReportCohortUnresolvedItem,
  ResultReportRepresentativeResult,
  ResultReportStudentIdentity,
} from '../../../../shared/result-reports.contract';

export interface ResultReportRosterRow {
  id: string;
  fullName: string;
  username: string;
  parentPhone: string | null;
}

export interface ResultReportSourceRow {
  id: string;
  studentId: string | null;
  studentName: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  submittedAt: string;
  quizTitle: string;
}

export interface SelectedResultReportCohort {
  ready: ResultReportCohortReadyItem[];
  notCompleted: ResultReportStudentIdentity[];
  unresolved: ResultReportCohortUnresolvedItem[];
}

export const normalizeResultReportLookup = (value: string): string => value
  .normalize('NFC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('vi-VN');

const timestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const selectAttempt = (
  attempts: ResultReportSourceRow[],
  policy: ResultReportAttemptPolicy,
): ResultReportSourceRow => {
  return [...attempts].sort((left, right) => {
    const leftTime = timestamp(left.submittedAt);
    const rightTime = timestamp(right.submittedAt);
    if (policy === 'first') {
      return leftTime - rightTime || left.id.localeCompare(right.id);
    }
    if (policy === 'highest') {
      return right.score - left.score
        || rightTime - leftTime
        || left.id.localeCompare(right.id);
    }
    return rightTime - leftTime || left.id.localeCompare(right.id);
  })[0];
};

const mapStudent = (row: ResultReportRosterRow): ResultReportStudentIdentity => ({
  id: row.id,
  fullName: row.fullName,
  username: row.username,
  parentPhone: row.parentPhone ?? null,
});

const mapResult = (row: ResultReportSourceRow): ResultReportRepresentativeResult => ({
  id: String(row.id),
  studentName: row.studentName,
  score: Number(row.score) || 0,
  correctCount: Number(row.correctCount) || 0,
  totalQuestions: Number(row.totalQuestions) || 0,
  submittedAt: row.submittedAt,
  quizTitle: row.quizTitle,
});

export function buildResultReportCohort(
  roster: ResultReportRosterRow[],
  results: ResultReportSourceRow[],
  policy: ResultReportAttemptPolicy,
): SelectedResultReportCohort {
  const resultsByStudentId = new Map<string, ResultReportSourceRow[]>();
  for (const result of results) {
    const studentId = String(result.studentId || '').trim();
    if (!studentId) continue;
    const matches = resultsByStudentId.get(studentId) ?? [];
    matches.push(result);
    resultsByStudentId.set(studentId, matches);
  }

  const ready: ResultReportCohortReadyItem[] = [];
  const notCompleted: ResultReportStudentIdentity[] = [];
  const unresolved: ResultReportCohortUnresolvedItem[] = [];

  for (const rosterRow of roster) {
    const student = mapStudent(rosterRow);
    const attempts = resultsByStudentId.get(rosterRow.id) ?? [];
    if (attempts.length === 0) {
      notCompleted.push(student);
      continue;
    }
    ready.push({
      student,
      result: mapResult(selectAttempt(attempts, policy)),
      attemptCount: attempts.length,
    });
  }

  return { ready, notCompleted, unresolved };
}
