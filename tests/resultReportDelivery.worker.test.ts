import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';
import type {
  CreateResultReportBatchRequest,
  ResultReportBatchDetail,
} from '../shared/result-reports.contract';

let currentUser: JWTPayload | null = null;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }), { status: 401 })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleCreateResultReportBatch } from '../workers/src/routes/resultReports/batchHandler';
import {
  buildResultReportBatchDetail,
  type ResultReportBatchRecord,
  type ResultReportDeliveryItemRecord,
} from '../workers/src/routes/resultReports/batchRepository';
import {
  createResultReportDeliveryRuntime,
  processResultReportBatch,
} from '../workers/src/routes/resultReports/deliveryItemService';
import { handleRetryResultReportBatch } from '../workers/src/routes/resultReports/retryHandler';
import { handleRevokeResultReportLinks } from '../workers/src/routes/resultReports/revokeHandler';

const teacher: JWTPayload = { username: 'teacher-a', role: 'teacher', fullName: 'Cô Khánh' };

const scope = {
  classroom: { id: 'class-4a9', name: '4A9', teacher_username: 'teacher-a' },
  quiz: { id: 'quiz-1', title: 'Bài 1 – Ôn tập phép nhân', category: 'Toán' },
  roster: [
    { id: 'student-an', full_name: 'Nguyễn Văn An', username: 'an.4a9', parent_phone: '0901' },
    { id: 'student-binh', full_name: 'Trần Minh Bình', username: 'binh.4a9', parent_phone: '0902' },
  ],
  results: [
    {
      id: 'result-an', student_name: 'Nguyễn Văn An', score: 8, correct_count: 8,
      total_questions: 10, submitted_at: '2026-07-20T08:00:00.000Z',
      quiz_title: 'Bài 1 – Ôn tập phép nhân',
    },
    {
      id: 'result-binh', student_name: 'Trần Minh Bình', score: 6, correct_count: 6,
      total_questions: 10, submitted_at: '2026-07-20T08:05:00.000Z',
      quiz_title: 'Bài 1 – Ôn tập phép nhân',
    },
  ],
};

const requestBody = (overrides: Partial<CreateResultReportBatchRequest> = {}): CreateResultReportBatchRequest => ({
  requestId: 'request-result-report-0001',
  classId: 'class-4a9',
  quizId: 'quiz-1',
  attemptPolicy: 'latest',
  drafts: [{
    resultId: 'result-an',
    style: 'nhe_nhang',
    commentMode: 'manual',
    comment: 'Em làm tốt phép nhân.',
    needsImprovement: 'Đọc kỹ câu hỏi.',
    encouragement: 'Tiếp tục phát huy.',
    studentName: 'Tên giả',
    score: 10,
  } as any],
  notifyStudents: true,
  createParentLinks: true,
  ...overrides,
});

const request = (body: CreateResultReportBatchRequest) => new Request(
  'https://example.test/api/result-reports/batches',
  {
    method: 'POST',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  },
);

const batch: ResultReportBatchRecord = {
  id: 'rrb-1',
  teacherId: 'teacher-a',
  requestId: 'request-result-report-0001',
  classId: 'class-4a9',
  className: '4A9',
  quizId: 'quiz-1',
  quizTitle: 'Bài 1 – Ôn tập phép nhân',
  attemptPolicy: 'latest',
  notifyStudents: true,
  createParentLinks: true,
  deliveryStatus: 'draft',
  expiresAt: '2026-08-20T08:00:00.000Z',
  createdAt: '2026-07-21T08:00:00.000Z',
  updatedAt: '2026-07-21T08:00:00.000Z',
};

const deliveryItem = (): ResultReportDeliveryItemRecord => ({
  id: 'rri-1',
  batchId: 'rrb-1',
  resultId: 'result-an',
  phieuId: null,
  studentId: 'student-an',
  studentName: 'Nguyễn Văn An',
  parentPhone: '0901',
  notificationId: null,
  publicLinkId: null,
  studentStatus: 'pending',
  parentStatus: 'not_requested',
  attemptCount: 0,
  lastError: null,
  draft: requestBody().drafts[0],
  createdAt: batch.createdAt,
  updatedAt: batch.updatedAt,
});

describe('result report batch creation and validation', () => {
  beforeEach(() => { currentUser = teacher; });

  it('creates items from the server cohort and ignores spoofed identity and score fields', async () => {
    const createBatch = vi.fn(async (record, items) => ({ ...record, id: 'rrb-created', items }));
    const processBatch = vi.fn(async () => 'completed' as const);
    const response = await handleCreateResultReportBatch(request(requestBody()), {} as any, {
      findBatchByRequest: vi.fn(async () => null),
      loadScope: vi.fn(async () => scope as any),
      createBatch,
      processBatch,
    } as any);
    const payload = await response.json() as any;

    expect(response.status).toBe(201);
    expect(payload.data).toEqual({ batchId: 'rrb-created', status: 'completed' });
    const [, items] = createBatch.mock.calls[0];
    expect(items).toEqual([
      expect.objectContaining({
        resultId: 'result-an',
        studentId: 'student-an',
        studentName: 'Nguyễn Văn An',
        parentPhone: '0901',
        draft: expect.objectContaining({
          comment: 'Em làm tốt phép nhân.',
          needsImprovement: 'Đọc kỹ câu hỏi.',
          encouragement: 'Tiếp tục phát huy.',
        }),
      }),
    ]);
    expect(JSON.stringify(items)).not.toContain('Tên giả');
    expect(processBatch).toHaveBeenCalledWith('rrb-created');
  });

  it('rejects a result outside the selected server cohort', async () => {
    const createBatch = vi.fn();
    const response = await handleCreateResultReportBatch(
      request(requestBody({ drafts: [{ ...requestBody().drafts[0], resultId: 'other-result' }] })),
      {} as any,
      {
        findBatchByRequest: vi.fn(async () => null),
        loadScope: vi.fn(async () => scope as any),
        createBatch,
        processBatch: vi.fn(),
      } as any,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'RESULT_REPORT_RESULT_OUT_OF_SCOPE' },
    });
    expect(createBatch).not.toHaveBeenCalled();
  });

  it('reuses the same batch for an idempotent request and resumes incomplete work', async () => {
    const processBatch = vi.fn(async () => 'completed' as const);
    const response = await handleCreateResultReportBatch(request(requestBody()), {} as any, {
      findBatchByRequest: vi.fn(async () => ({ ...batch, deliveryStatus: 'partial_failed' })),
      loadScope: vi.fn(),
      createBatch: vi.fn(),
      processBatch,
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { batchId: 'rrb-1', status: 'completed' } });
    expect(processBatch).toHaveBeenCalledWith('rrb-1');
  });
});

describe('per-item delivery and retry semantics', () => {
  it('uses canonical result data, defaults links to 30 days, and completes both channels', async () => {
    const item = deliveryItem();
    const updates: Array<Partial<ResultReportDeliveryItemRecord>> = [];
    const runtime = {
      loadBatch: vi.fn(async () => batch),
      loadItems: vi.fn(async () => [item]),
      loadScope: vi.fn(async () => scope),
      updateBatchStatus: vi.fn(async (_id, status) => { batch.deliveryStatus = status; }),
      updateItem: vi.fn(async (_id, patch) => { Object.assign(item, patch); updates.push(patch); }),
      upsertPhieu: vi.fn(async (input) => {
        expect(input).toMatchObject({
          resultId: 'result-an', studentId: 'student-an', studentName: 'Nguyễn Văn An',
          classId: 'class-4a9', score: 8, totalQuestions: 10, correctCount: 8,
          comment: 'Em làm tốt phép nhân.',
        });
        expect(input).not.toHaveProperty('score', 10);
        return { id: 'phieu-an' };
      }),
      ensureParentLink: vi.fn(async (input) => {
        const expiresAt = new Date(input.expiresAt).getTime();
        expect(expiresAt - new Date(batch.createdAt).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
        return { id: 'link-an', url: 'https://api.thtohieu.com/p/token-an' };
      }),
      insertNotification: vi.fn(async (input) => {
        expect(input).toMatchObject({ studentId: 'student-an', phieuId: 'phieu-an' });
        return 'rrn-rri-1';
      }),
    } as any;

    const status = await processResultReportBatch('rrb-1', runtime);

    expect(status).toBe('completed');
    expect(item).toMatchObject({
      phieuId: 'phieu-an', publicLinkId: 'link-an', notificationId: 'rrn-rri-1',
      studentStatus: 'sent', parentStatus: 'link_created', lastError: null,
    });
    expect(runtime.updateBatchStatus).toHaveBeenLastCalledWith('rrb-1', 'completed');
    expect(updates.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps a successful parent link when notification fails and retries only the failed channel', async () => {
    const item = deliveryItem();
    let notificationAttempts = 0;
    const runtime = {
      loadBatch: vi.fn(async () => batch),
      loadItems: vi.fn(async () => [item]),
      loadScope: vi.fn(async () => scope),
      updateBatchStatus: vi.fn(async (_id, status) => { batch.deliveryStatus = status; }),
      updateItem: vi.fn(async (_id, patch) => { Object.assign(item, patch); }),
      upsertPhieu: vi.fn(async () => ({ id: 'phieu-an' })),
      ensureParentLink: vi.fn(async () => ({ id: 'link-an', url: 'https://api.thtohieu.com/p/token-an' })),
      insertNotification: vi.fn(async () => {
        notificationAttempts += 1;
        if (notificationAttempts === 1) throw new Error('notification unavailable');
        return 'rrn-rri-1';
      }),
    } as any;

    expect(await processResultReportBatch('rrb-1', runtime)).toBe('partial_failed');
    expect(item).toMatchObject({
      phieuId: 'phieu-an', publicLinkId: 'link-an',
      parentStatus: 'link_created', studentStatus: 'failed',
    });

    expect(await processResultReportBatch('rrb-1', runtime, ['rri-1'])).toBe('completed');
    expect(runtime.upsertPhieu).toHaveBeenCalledTimes(1);
    expect(runtime.ensureParentLink).toHaveBeenCalledTimes(1);
    expect(runtime.insertNotification).toHaveBeenCalledTimes(2);
    expect(item.studentStatus).toBe('sent');
  });
});

describe('delivery runtime notifications', () => {
  it('uses the teacher display name in the student notification body', async () => {
    let boundValues: unknown[] = [];
    const env = {
      DB: {
        prepare: vi.fn(() => ({
          bind: (...values: unknown[]) => {
            boundValues = values;
            return { run: vi.fn(async () => ({ success: true })) };
          },
        })),
      },
    } as any;
    const runtime = createResultReportDeliveryRuntime(env, teacher);

    await runtime.insertNotification({
      notificationId: 'notification-an',
      studentId: 'student-an',
      phieuId: 'phieu-an',
      resultId: 'result-an',
      batchId: 'rrb-1',
      quizId: 'quiz-1',
      quizTitle: 'Bài 1 – Ôn tập phép nhân',
      score: 8,
      teacherName: 'teacher-a',
    });

    expect(boundValues[3]).toBe('result_report_ready');
    expect(boundValues[5]).toBe(
      'Cô Khánh đã gửi kết quả bài “Bài 1 – Ôn tập phép nhân”. Điểm của em: 8/10.',
    );
  });
});

describe('delivery detail, retry, and revoke handlers', () => {
  beforeEach(() => { currentUser = teacher; });

  it('derives viewed/opened status from notification and public-link evidence', () => {
    const detail = buildResultReportBatchDetail({ ...batch, deliveryStatus: 'completed' }, [{
      ...deliveryItem(),
      phieu_id: 'phieu-an',
      notification_id: 'rrn-rri-1',
      public_link_id: 'link-an',
      student_status: 'sent',
      parent_status: 'link_created',
      notification_read: 1,
      public_link_view_count: 2,
      public_link_active: 1,
      public_token: 'token-an',
      score: 8,
      submitted_at: '2026-07-20T08:00:00.000Z',
    } as any]);

    expect(detail.items[0]).toMatchObject({ studentStatus: 'viewed', parentStatus: 'opened' });
    expect(detail.batch.counts).toMatchObject({
      total: 1, studentSent: 1, studentViewed: 1, parentLinks: 1, parentOpened: 1, failed: 0,
    });
  });

  it('retries only owned batches and returns refreshed detail', async () => {
    const refreshed = { batch: { id: 'rrb-1' }, items: [] } as unknown as ResultReportBatchDetail;
    const processBatch = vi.fn(async () => 'completed' as const);
    const response = await handleRetryResultReportBatch(
      new Request('https://example.test/api/result-reports/batches/rrb-1/retry', {
        method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: ['rri-1'] }),
      }),
      {} as any,
      'rrb-1',
      {
        getOwnedBatch: vi.fn(async () => batch),
        processBatch,
        getBatchDetail: vi.fn(async () => refreshed),
      } as any,
    );

    expect(response.status).toBe(200);
    expect(processBatch).toHaveBeenCalledWith('rrb-1', ['rri-1']);
  });

  it('revokes selected links without recreating them', async () => {
    const revokeLinks = vi.fn(async () => 1);
    const response = await handleRevokeResultReportLinks(
      new Request('https://example.test/api/result-reports/batches/rrb-1/revoke', {
        method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: ['rri-1'] }),
      }),
      {} as any,
      'rrb-1',
      {
        getOwnedBatch: vi.fn(async () => batch),
        revokeLinks,
        getBatchDetail: vi.fn(async () => ({ batch: { id: 'rrb-1' }, items: [] })),
      } as any,
    );

    expect(response.status).toBe(200);
    expect(revokeLinks).toHaveBeenCalledWith('rrb-1', ['rri-1']);
  });
});
