import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultDashboardSummary } from '../shared/result-summary.contract';

const callApiMock = vi.hoisted(() => vi.fn());
vi.mock('../src/services/apiAdapter', () => ({ callApi: callApiMock }));

import { fetchResultDashboardSummary } from '../src/services/resultSummaryService';

const summary: ResultDashboardSummary = {
    totalSubmissions: 285,
    uniqueCompletedWorks: 188,
    todaySubmissions: 0,
    uniqueStudents: 18,
    attemptPolicy: 'latest',
    timezone: 'Asia/Ho_Chi_Minh',
    statistics: {
        totalResults: 188,
        mean: 5.76,
        median: 6,
        stdDev: 2.1,
        min: 0,
        max: 10,
        passRate: 67,
        passCount: 125,
        failCount: 63,
        scoreDistribution: [
            { range: '0-2', count: 20, percentage: 10.64 },
            { range: '3-4', count: 43, percentage: 22.87 },
            { range: '5-6', count: 50, percentage: 26.6 },
            { range: '7-8', count: 45, percentage: 23.94 },
            { range: '9-10', count: 30, percentage: 15.96 },
        ],
    },
};

describe('fetchResultDashboardSummary', () => {
    beforeEach(() => callApiMock.mockReset());

    it('loads and unwraps the protected summary contract', async () => {
        callApiMock.mockResolvedValue({ data: summary });

        await expect(fetchResultDashboardSummary()).resolves.toEqual(summary);
        expect(callApiMock).toHaveBeenCalledWith('get_results_summary');
    });

    it('rejects a malformed response instead of returning partial metrics', async () => {
        callApiMock.mockResolvedValue({ data: null });

        await expect(fetchResultDashboardSummary()).rejects.toThrow(
            'Dữ liệu tổng quan kết quả không hợp lệ.',
        );
    });
});
