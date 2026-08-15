import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectConsoleError, expectConsoleMessage } from './helpers/expectedConsole';

const renderCertificateMock = vi.hoisted(() => vi.fn());

vi.mock('../workers/src/services/certificateRenderer', () => ({
  renderCertificate: renderCertificateMock,
}));

import { processBatch } from '../workers/src/services/certificateBatchProcessor';

class ProcessorStatement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: ProcessorDB) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  first<T>() {
    if (this.sql.includes('certificate_templates')) {
      return Promise.resolve({
        bg_image_r2_key: 'templates/bg.png',
        fields_config: JSON.stringify([
          { key: 'student_name', x: 100, y: 50, fontFamily: 'Great Vibes' },
          { key: 'quiz_title', x: 100, y: 100, prefix: 'Đã hoàn thành xuất sắc ' },
          { key: 'date', x: 100, y: 200, prefix: 'Mường La, ngày ', format: 'vi-long-date' },
        ]),
        canvas_width: 1270,
        canvas_height: 698,
      } as T);
    }
    if (this.sql.includes('FROM certificate_batches')) {
      return Promise.resolve({ teacher_id: 'teacher-1' } as T);
    }
    return Promise.resolve(null);
  }
  run() { this.db.runs.push(this); return Promise.resolve({ success: true }); }
}

class ProcessorDB {
  runs: ProcessorStatement[] = [];
  prepare(sql: string) { return new ProcessorStatement(sql, this); }
  batch(statements: ProcessorStatement[]) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

describe('certificate batch processor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => renderCertificateMock.mockReset());

  it('preserves Vietnamese and score zero, produces partial, and notifies successes only', async () => {
    const errorSpy = expectConsoleError();
    const db = new ProcessorDB();
    const renderInputs: any[] = [];
    renderCertificateMock.mockImplementation(async (params: any) => {
      if (!params) return new Uint8Array();
      renderInputs.push(params);
      const { data } = params;
      if (data.student_name === 'Học sinh lỗi') throw new Error('render rejected');
      return new Uint8Array([137, 80, 78, 71]);
    });
    const put = vi.fn(async () => undefined);
    const env = {
      DB: db,
      CERT_IMAGES: {
        get: vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
        put,
      },
    } as any;

    await processBatch(env, 'batch-1', 'template-1', [
      { certificate_id: 'cert-ok', student_id: 'student-1', student_name: 'Nguyễn Việt Anh', student_score: 0, quiz_title: 'Tiếng Việt' },
      { certificate_id: 'cert-fail', student_id: 'student-2', student_name: 'Học sinh lỗi', student_score: 9, quiz_title: 'Bài rất dài '.repeat(30) },
    ], 'Cô Nguyễn', 'Hoàn thành xuất sắc', 'Tiếp tục cố gắng',
    'Đã tiến bộ vượt bậc', 'TôHiệuQuiz, ngày 20 tháng 7 năm 2026', 'Playwrite VN');

    expect(renderInputs[0].data).toMatchObject({
      student_name: 'Nguyễn Việt Anh', score: '0/10', teacher_name: 'Cô Nguyễn',
      date: 'TôHiệuQuiz, ngày 20 tháng 7 năm 2026',
    });
    expect(renderInputs[0].fieldsConfig).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'quiz_title', prefix: 'Đã tiến bộ vượt bậc ' }),
      expect.objectContaining({ key: 'date', prefix: '', format: undefined }),
      expect.objectContaining({ key: 'student_name', fontFamily: 'Playwrite VN' }),
    ]));
    expect(put).toHaveBeenCalledWith('certs/cert-ok.png', expect.any(Uint8Array), expect.any(Object));
    expect(renderInputs[0].env).toBe(env);
    expect(renderInputs[0]).toMatchObject({ width: 1270, height: 698 });
    const finalBatchUpdate = db.runs.find((statement) => statement.sql.includes('SET status = ?, sent_at'));
    expect(finalBatchUpdate?.bindings[0]).toBe('partial');
    const notifications = db.runs.filter((statement) => statement.sql.includes('INSERT OR IGNORE INTO notifications'));
    expect(notifications).toHaveLength(2);
    expect(notifications.find((statement) => statement.bindings[3] === 'certificate_issued')?.bindings[1])
      .toBe('student-1');
    expect(notifications.find((statement) => statement.bindings[3] === 'certificate_issued')?.bindings)
      .toContain('/student/achievements?certificate=cert-ok');
    expect(notifications.find((statement) => statement.bindings[3] === 'certificate_batch_completed')?.bindings[1])
      .toBe('teacher-1');
    expectConsoleMessage(errorSpy, 'render failed certificate=cert-fail');
  });
});
