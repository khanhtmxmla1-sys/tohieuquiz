import { describe, expect, it } from 'vitest';

describe('automatic parent notification producers', () => {
  it('publishes quiz results without exposing answer details', async () => {
    const source = await import('../workers/src/routes/results?raw');
    expect(source.default).toContain("kind: 'quiz_result'");
    expect(source.default).toContain('createParentNotification');
    expect(source.default).toContain('payload: { resultId: String(resultId), quizId, score, correctCount, totalQuestions }');
  });

  it('publishes result reports, homework events, and certificates', async () => {
    const resultReports = await import('../workers/src/routes/resultReports/deliveryItemService?raw');
    const homework = await import('../workers/src/routes/homework?raw');
    const certificates = await import('../workers/src/services/certificateBatchProcessor?raw');

    expect(resultReports.default).toContain('insertParentNotification');
    expect(resultReports.default).toContain("kind: 'result_report'");
    expect(homework.default).toContain("kind: 'homework_assigned'");
    expect(homework.default).toContain("kind: 'homework_graded'");
    expect(certificates.default).toContain("kind: 'certificate_issued'");
  });

  it('registers the dedicated daily due-reminder cron', async () => {
    const workerSource = await import('../workers/src/index?raw');
    const wrangler = await import('../workers/wrangler.toml?raw');
    expect(workerSource.default).toContain("event.cron === '0 23 * * *'");
    expect(workerSource.default).toContain('createDueHomeworkReminders');
    expect(wrangler.default).toContain('"0 23 * * *"');
  });
});
