import type {
    ResultDashboardSummary,
    ResultDashboardSummaryResponse,
} from '../../shared/result-summary.contract';
import { SYSTEM_TIME_ZONE } from '../../shared/time-zone.contract';
import { callApi } from './apiAdapter';

const isResultDashboardSummary = (value: unknown): value is ResultDashboardSummary => {
    if (!value || typeof value !== 'object') return false;
    const summary = value as Partial<ResultDashboardSummary>;
    return summary.attemptPolicy === 'latest'
        && summary.timezone === SYSTEM_TIME_ZONE
        && typeof summary.totalSubmissions === 'number'
        && typeof summary.uniqueCompletedWorks === 'number'
        && typeof summary.todaySubmissions === 'number'
        && typeof summary.uniqueStudents === 'number'
        && Boolean(summary.statistics && typeof summary.statistics === 'object');
};

export async function fetchResultDashboardSummary(): Promise<ResultDashboardSummary> {
    const response = await callApi<ResultDashboardSummaryResponse>('get_results_summary');
    if (!isResultDashboardSummary(response?.data)) {
        throw new Error('Dữ liệu tổng quan kết quả không hợp lệ.');
    }
    return response.data;
}
