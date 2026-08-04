import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SYSTEM_CRON, SYSTEM_CRON_CONTRACT } from '../workers/src/scheduling/systemCron';

const read = (path: string) => readFileSync(path, 'utf8');

const configuredCrons = (): string[] => {
  const config = read('workers/wrangler.toml');
  const block = config.match(/crons\s*=\s*\[([\s\S]*?)\]/)?.[1] || '';
  return [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
};

describe('Hanoi system cron contract', () => {
  it('keeps Wrangler triggers aligned with the named Worker schedule', () => {
    expect(configuredCrons().sort()).toEqual(
      SYSTEM_CRON_CONTRACT.map((item) => item.expression).sort(),
    );
    expect(SYSTEM_CRON.WEEKLY_LEADERBOARD).toBe('0 0 * * 1');
    expect(SYSTEM_CRON.LIVE_EXAM_SWEEP).toBe('* * * * *');
    expect(SYSTEM_CRON.DAILY_SECURITY_AND_REMINDERS).toBe('0 23 * * *');
    expect(SYSTEM_CRON.PARENT_DIGEST).toBe('0 * * * *');
  });

  it('documents every UTC expression and its Hanoi execution time', () => {
    const architecture = read('docs/architecture/system-time.md');
    const operations = read('docs/operations/maintenance-calendar.md');

    expect(architecture).toContain('Asia/Ho_Chi_Minh');
    expect(architecture).toContain('UTC ISO-8601');
    for (const item of SYSTEM_CRON_CONTRACT) {
      expect(architecture).toContain(`\`${item.expression}\``);
      expect(operations).toContain(`\`${item.expression}\``);
      expect(operations).toContain(item.hanoiSchedule);
    }
  });

  it('uses named cron constants in the scheduled handler', () => {
    const source = read('workers/src/index.ts');
    expect(source).toContain('SYSTEM_CRON.DAILY_SECURITY_AND_REMINDERS');
    expect(source).toContain('SYSTEM_CRON.PARENT_DIGEST');
    expect(source).toContain('SYSTEM_CRON.WEEKLY_LEADERBOARD');
    expect(source).not.toMatch(/event\.cron\s*===\s*['"]/);
  });
});
