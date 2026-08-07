import { afterEach, describe, expect, it, vi } from 'vitest';

// Hai module này nạp WebAssembly của resvg để render ảnh; không dùng được trong vitest và
// cũng không liên quan tới cron. Mock để test chạy trên đúng entry point thật của Worker.
vi.mock('../workers/src/services/certificateRenderer', () => ({
  renderCertificate: vi.fn(),
}));
vi.mock('../workers/src/utils/ogImage', () => ({
  renderOgPng: vi.fn(),
  buildOgSvg: vi.fn(),
}));

const worker = (await import('../workers/src/index')).default;
const { RATE_LIMIT_RETENTION_MS } = await import('../workers/src/middleware/rateLimit');

/**
 * D1 giả dễ tính: ghi lại mọi câu SQL và trả kết quả rỗng, đủ để nhánh cron hằng ngày
 * chạy hết mà không cần dữ liệu thật.
 */
function createRecordingDb() {
  const executed: Array<{ sql: string; bindings: unknown[] }> = [];
  const DB = {
    prepare: (sql: string) => {
      const record = { sql, bindings: [] as unknown[] };
      const statement: any = {
        bind: (...values: unknown[]) => {
          record.bindings = values;
          executed.push(record);
          return statement;
        },
        all: async () => ({ results: [] }),
        first: async () => null,
        run: async () => ({ success: true, meta: { changes: 3 } }),
      };
      return statement;
    },
    batch: async (statements: Array<{ run?: () => Promise<unknown> }>) => Promise.all(
      statements.map((statement) => statement.run?.() ?? Promise.resolve({ success: true, meta: { changes: 0 } })),
    ),
  };
  return { DB, executed };
}

const purgeStatements = (executed: Array<{ sql: string }>) =>
  executed.filter((entry) => /DELETE FROM rate_limits/i.test(entry.sql));

const runCron = (cron: string, DB: unknown) => worker.scheduled(
  { cron } as any,
  { DB } as any,
  {} as any,
);

describe('daily cron purges expired rate limit rows', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes rows older than the retention window on the 23:00 cron', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { DB, executed } = createRecordingDb();
    const before = Date.now();

    await runCron('0 23 * * *', DB);

    const purges = purgeStatements(executed);
    expect(purges).toHaveLength(1);
    const cutoff = Date.parse(String(purges[0].bindings[0]));
    // Mốc cắt phải nằm đúng một khoảng lưu trữ về trước so với thời điểm chạy.
    expect(cutoff).toBeGreaterThanOrEqual(before - RATE_LIMIT_RETENTION_MS - 5_000);
    expect(cutoff).toBeLessThanOrEqual(Date.now() - RATE_LIMIT_RETENTION_MS);
  });

  it('still sends homework reminders after purging', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { DB, executed } = createRecordingDb();

    await runCron('0 23 * * *', DB);

    // Việc dọn phải chạy trước phần nhắc hạn, và không được chặn phần đó lại.
    expect(purgeStatements(executed)).toHaveLength(1);
    expect(executed.some((entry) => /FROM hw_assignments/i.test(entry.sql))).toBe(true);
  });

  it('does not let a failed purge block the reminders', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { DB, executed } = createRecordingDb();
    const original = DB.prepare;
    DB.prepare = ((sql: string) => {
      if (/DELETE FROM rate_limits/i.test(sql)) {
        return { bind: () => ({ run: async () => { throw new Error('D1 unavailable'); } }) } as any;
      }
      return original(sql);
    }) as typeof DB.prepare;

    await runCron('0 23 * * *', DB);

    expect(errorSpy).toHaveBeenCalled();
    expect(executed.some((entry) => /FROM hw_assignments/i.test(entry.sql))).toBe(true);
  });

  it('runs the disabled hourly digest gate without duplicating live-exam maintenance', async () => {
    const { DB, executed } = createRecordingDb();

    await runCron('0 * * * *', DB);

    expect(executed).toHaveLength(0);
  });

  it('leaves the per-minute and weekly crons alone', async () => {
    const { DB, executed } = createRecordingDb();

    await runCron('* * * * *', DB);
    await runCron('0 0 * * 1', DB);

    expect(purgeStatements(executed)).toHaveLength(0);
  });
});
