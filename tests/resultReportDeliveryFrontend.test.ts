import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultReportCohortResponse } from '../shared/result-reports.contract';

const callApiMock = vi.hoisted(() => vi.fn());
vi.mock('../src/services/apiAdapter', () => ({ callApi: callApiMock }));

import { resolveApiRoute } from '../src/services/api/routeResolver';
import {
  ResultReportDeliveryError,
  normalizeResultReportDeliveryError,
  resultReportDeliveryService,
} from '../src/features/results/services/resultReportDeliveryService';
import {
  buildResultReportReviewState,
  filterResultReportReviewItems,
  toggleResultReportSelection,
  ensureResultReportRequestId,
} from '../src/features/results/model/resultReportDelivery';
import {
  buildResultReportCsv,
  buildResultReportZaloMessage,
} from '../src/features/results/utils/resultReportExport';

const cohort: ResultReportCohortResponse = {
  class: { id: 'class-4a9', name: '4A9' },
  quiz: { id: 'quiz-1', title: 'Bài 1 – Ôn tập phép nhân' },
  attemptPolicy: 'latest',
  summary: {
    totalStudents: 3,
    completedStudents: 2,
    notCompletedStudents: 1,
    unresolvedStudents: 0,
    reportCount: 2,
  },
  ready: [
    {
      student: { id: 'student-an', fullName: 'Nguyễn Văn An', username: 'an', parentPhone: '0901' },
      result: {
        id: 'result-an', studentName: 'Nguyễn Văn An', score: 8, correctCount: 8,
        totalQuestions: 10, submittedAt: '2026-07-20T08:00:00.000Z', quizTitle: 'Bài 1',
      },
      attemptCount: 2,
    },
    {
      student: { id: 'student-binh', fullName: 'Trần Minh Bình', username: 'binh', parentPhone: null },
      result: {
        id: 'result-binh', studentName: 'Trần Minh Bình', score: 6, correctCount: 6,
        totalQuestions: 10, submittedAt: '2026-07-20T08:05:00.000Z', quizTitle: 'Bài 1',
      },
      attemptCount: 1,
    },
  ],
  notCompleted: [
    { id: 'student-chi', fullName: 'Lê Thị Chi', username: 'chi', parentPhone: '0903' },
  ],
  unresolved: [],
};

describe('result report API registry', () => {
  it('resolves all teacher and student result-report routes', () => {
    expect(resolveApiRoute('get_result_report_cohort')).toMatchObject({ method: 'POST', auth: 'session' });
    expect(resolveApiRoute('get_result_report_cohort').path({})).toBe('/api/result-reports/cohort');
    expect(resolveApiRoute('create_result_report_batch').path({})).toBe('/api/result-reports/batches');

    const detail = resolveApiRoute('get_result_report_batch');
    expect(detail.method).toBe('GET');
    expect(detail.path({ batchId: 'batch 1' })).toBe('/api/result-reports/batches/batch%201');

    const retry = resolveApiRoute('retry_result_report_batch');
    expect(retry.path({ batchId: 'batch 1' })).toBe('/api/result-reports/batches/batch%201/retry');
    expect(retry.body?.('retry_result_report_batch', { batchId: 'b1', itemIds: ['i1'] }))
      .toEqual({ itemIds: ['i1'] });

    const revoke = resolveApiRoute('revoke_result_report_links');
    expect(revoke.path({ batchId: 'b1' })).toBe('/api/result-reports/batches/b1/revoke');
    expect(revoke.body?.('revoke_result_report_links', { batchId: 'b1', itemIds: ['i1'] }))
      .toEqual({ itemIds: ['i1'] });

    expect(resolveApiRoute('get_my_result_reports')).toMatchObject({ method: 'GET', auth: 'studentSession' });
    expect(resolveApiRoute('get_my_result_report').path({ phieuId: 'phiếu 1' }))
      .toBe('/api/result-reports/mine/phi%E1%BA%BFu%201');
  });
});

describe('result report delivery service', () => {
  beforeEach(() => callApiMock.mockReset());

  it('unwraps the canonical data envelope', async () => {
    callApiMock.mockResolvedValue({ data: cohort });

    await expect(resultReportDeliveryService.getCohort({
      classId: 'class-4a9', quizId: 'quiz-1', attemptPolicy: 'latest',
    })).resolves.toEqual(cohort);
    expect(callApiMock).toHaveBeenCalledWith('get_result_report_cohort', {
      classId: 'class-4a9', quizId: 'quiz-1', attemptPolicy: 'latest',
    });
  });

  it('preserves backend code, message, and status for UI recovery', () => {
    const normalized = normalizeResultReportDeliveryError(Object.assign(
      new Error('Class is outside your scope'),
      { code: 'RESULT_REPORT_CLASS_FORBIDDEN', status: 403 },
    ));

    expect(normalized).toBeInstanceOf(ResultReportDeliveryError);
    expect(normalized.code).toBe('RESULT_REPORT_CLASS_FORBIDDEN');
    expect(normalized.status).toBe(403);
    expect(normalized.message).toBe('Class is outside your scope');
  });
});

describe('review selection model', () => {
  it('keeps selected result ids when search/filter changes', () => {
    const state = buildResultReportReviewState(cohort);
    expect([...state.selectedResultIds]).toEqual(['result-an', 'result-binh']);

    const visible = filterResultReportReviewItems(state, 'Bình', 'all');
    expect(visible.map((item) => item.result.id)).toEqual(['result-binh']);
    expect([...state.selectedResultIds]).toEqual(['result-an', 'result-binh']);

    const next = toggleResultReportSelection(state, 'result-binh');
    expect([...next.selectedResultIds]).toEqual(['result-an']);
    expect(filterResultReportReviewItems(next, '', 'selected').map((item) => item.result.id))
      .toEqual(['result-an']);
  });

  it('reuses an existing request id instead of generating another during retry', () => {
    const generated = ensureResultReportRequestId(null, () => 'request-1');
    expect(generated).toBe('request-1');
    expect(ensureResultReportRequestId(generated, () => 'request-2')).toBe('request-1');
  });
});

describe('Zalo and CSV export', () => {
  const rows = [
    {
      studentName: 'Nguyễn Văn An', className: '4A9', score: 8, attemptLabel: 'Lần 2',
      parentPhone: '0901', publicUrl: 'https://api.thtohieu.com/p/an-token',
      studentStatus: 'sent', parentStatus: 'link_created',
    },
    {
      studentName: 'Trần "Minh, Bình"', className: '4A9', score: 6, attemptLabel: 'Lần 1',
      parentPhone: '', publicUrl: 'https://api.thtohieu.com/p/binh-token',
      studentStatus: 'viewed', parentStatus: 'opened',
    },
  ] as const;

  it('creates a private Vietnamese parent message with the expiry notice', () => {
    const message = buildResultReportZaloMessage(rows[0], 'Bài 1 – Ôn tập phép nhân', 30);
    expect(message).toContain('Kính gửi phụ huynh em Nguyễn Văn An');
    expect(message).toContain('Bài 1 – Ôn tập phép nhân');
    expect(message).toContain(rows[0].publicUrl);
    expect(message).toContain('30 ngày');
  });

  it('escapes Excel CSV and keeps one private link per student row', () => {
    const csv = buildResultReportCsv(rows, 'Bài 1 – Ôn tập phép nhân');
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');

    expect(lines[0]).toContain('Họ tên học sinh');
    expect(lines[1]).toContain('an-token');
    expect(lines[1]).not.toContain('binh-token');
    expect(lines[2]).toContain('binh-token');
    expect(lines[2]).not.toContain('an-token');
    expect(lines[2]).toContain('"Trần ""Minh, Bình"""');
  });
});
