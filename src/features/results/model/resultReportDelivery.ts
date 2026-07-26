import type {
  ResultReportCohortReadyItem,
  ResultReportCohortResponse,
} from '../../../../shared/result-reports.contract';

export type ResultReportReviewFilter = 'all' | 'selected' | 'unselected';

export interface ResultReportReviewState {
  cohort: ResultReportCohortResponse;
  selectedResultIds: Set<string>;
}

export const buildResultReportReviewState = (
  cohort: ResultReportCohortResponse,
): ResultReportReviewState => ({
  cohort,
  selectedResultIds: new Set(cohort.ready.map((item) => item.result.id)),
});

export const toggleResultReportSelection = (
  state: ResultReportReviewState,
  resultId: string,
): ResultReportReviewState => {
  const selectedResultIds = new Set(state.selectedResultIds);
  if (selectedResultIds.has(resultId)) selectedResultIds.delete(resultId);
  else selectedResultIds.add(resultId);
  return { ...state, selectedResultIds };
};

const normalize = (value: string): string => value
  .normalize('NFC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('vi-VN');

export const filterResultReportReviewItems = (
  state: ResultReportReviewState,
  query: string,
  filter: ResultReportReviewFilter,
): ResultReportCohortReadyItem[] => {
  const normalizedQuery = normalize(query);
  return state.cohort.ready.filter((item) => {
    const selected = state.selectedResultIds.has(item.result.id);
    if (filter === 'selected' && !selected) return false;
    if (filter === 'unselected' && selected) return false;
    if (!normalizedQuery) return true;
    return normalize(`${item.student.fullName} ${item.student.username}`).includes(normalizedQuery);
  });
};

export const ensureResultReportRequestId = (
  current: string | null | undefined,
  generate: () => string = () => `rrq-${crypto.randomUUID()}`,
): string => current || generate();
