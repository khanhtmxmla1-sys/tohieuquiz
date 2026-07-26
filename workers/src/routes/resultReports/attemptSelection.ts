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
  const rosterByName = new Map<string, ResultReportRosterRow[]>();
  for (const student of roster) {
    const key = normalizeResultReportLookup(student.fullName);
    const matches = rosterByName.get(key) ?? [];
    matches.push(student);
    rosterByName.set(key, matches);
  }

  const resultsByName = new Map<string, ResultReportSourceRow[]>();
  for (const result of results) {
    const key = normalizeResultReportLookup(result.studentName);
    const matches = resultsByName.get(key) ?? [];
    matches.push(result);
    resultsByName.set(key, matches);
  }

  const ready: ResultReportCohortReadyItem[] = [];
  const notCompleted: ResultReportStudentIdentity[] = [];
  const unresolved: ResultReportCohortUnresolvedItem[] = [];

  for (const rosterRow of roster) {
    const student = mapStudent(rosterRow);
    const key = normalizeResultReportLookup(rosterRow.fullName);
    if ((rosterByName.get(key)?.length ?? 0) > 1) {
      unresolved.push({ student, reason: 'duplicate_name' });
      continue;
    }

    const attempts = resultsByName.get(key) ?? [];
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
