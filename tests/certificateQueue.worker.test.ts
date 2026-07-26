import { beforeEach, describe, expect, it, vi } from 'vitest';

const processBatchMock = vi.hoisted(() => vi.fn());

vi.mock('../workers/src/services/certificateBatchProcessor', () => ({
  processBatch: processBatchMock,
}));

import certificateQueue from '../workers/src/queues/certificateQueue';

class QueueStatement {
  bindings: unknown[] = [];

  constructor(readonly sql: string, readonly db: QueueDB) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  first<T>() {
    if (this.sql.includes('FROM certificate_batches')) {
      return Promise.resolve(this.db.batchRow as T);
    }
    if (this.sql.includes('FROM teachers')) {
      return Promise.resolve({ full_name: 'Cô giáo' } as T);
    }
    return Promise.resolve(null);
  }

  all<T>() {
    return Promise.resolve({ results: this.db.certificateRows as T[] });
  }

  run() {
    this.db.runs.push(this);
    return Promise.resolve({ success: true });
  }
}

class QueueDB {
  batchRow = {
    id: 'batch-1',
    teacher_id: 'teacher-1',
    template_id: 'template-1',
    title: 'Hoàn thành tốt',
    message: null,
    achievement_prefix: 'Đã tiến bộ vượt bậc',
    date_line: 'TôHiệuQuiz, ngày 20 tháng 7 năm 2026',
    student_name_font: 'Allura',
    status: 'pending',
    processing_started_at: null,
  };
  certificateRows = [{
    certificate_id: 'cert-1',
    student_id: 'student-1',
    student_name: 'Học sinh 1',
    student_score: 10,
    quiz_title: 'Bài kiểm tra',
  }];
  runs: QueueStatement[] = [];
  batches: QueueStatement[][] = [];

  prepare(sql: string) {
    return new QueueStatement(sql, this);
  }

  batch(statements: QueueStatement[]) {
    this.batches.push(statements);
    return Promise.resolve(statements.map(() => ({ success: true })));
  }
}

function queueMessage(attempts = 1) {
  return {
    body: { batchId: 'batch-1' },
    attempts,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

async function dispatch(db: QueueDB, message: ReturnType<typeof queueMessage>) {
  await certificateQueue.queue(
    { messages: [message] } as any,
    { DB: db } as any,
    {} as ExecutionContext,
  );
}

describe('certificate queue delivery semantics', () => {
  beforeEach(() => {
    processBatchMock.mockReset();
    processBatchMock.mockResolvedValue(undefined);
  });

  it('acknowledges an already completed duplicate message', async () => {
    const db = new QueueDB();
    db.batchRow.status = 'sent';
    const message = queueMessage();

    await dispatch(db, message);

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(processBatchMock).not.toHaveBeenCalled();
  });

  it('processes a pending batch successfully and acknowledges it', async () => {
    const db = new QueueDB();
    const message = queueMessage();

    await dispatch(db, message);

    expect(processBatchMock).toHaveBeenCalledOnce();
    expect(processBatchMock.mock.calls[0][7]).toBe('Đã tiến bộ vượt bậc');
    expect(processBatchMock.mock.calls[0][8]).toBe('TôHiệuQuiz, ngày 20 tháng 7 năm 2026');
    expect(processBatchMock.mock.calls[0][9]).toBe('Allura');
    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it('retries a transient processor failure without acknowledging it', async () => {
    const db = new QueueDB();
    const message = queueMessage(1);
    processBatchMock.mockRejectedValueOnce(new Error('R2 temporarily unavailable'));

    await dispatch(db, message);

    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    expect(message.ack).not.toHaveBeenCalled();
    expect(db.batches).toHaveLength(2);
  });

  it('marks the final attempt failed and acknowledges it', async () => {
    const db = new QueueDB();
    const message = queueMessage(3);
    processBatchMock.mockRejectedValueOnce(new Error('render failed'));

    await dispatch(db, message);

    expect(message.retry).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledOnce();
    expect(db.batches).toHaveLength(2);
    expect(db.batches[1][0].sql).toContain("status = 'failed'");
  });
});
