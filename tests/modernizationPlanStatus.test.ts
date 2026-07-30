import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

describe('modernization plan status', () => {
  it('keeps every Task 1–38 acceptance checkbox complete', () => {
    const plan = read('implementation_plan.md');
    const headings = [...plan.matchAll(/^## Task\s+(\d+):[^\n]*$/gm)];
    expect(headings).toHaveLength(38);

    for (let index = 0; index < headings.length; index += 1) {
      const taskNumber = Number(headings[index][1]);
      const start = headings[index].index!;
      const end = headings[index + 1]?.index ?? plan.length;
      const block = plan.slice(start, end);
      expect(block, `Task ${taskNumber} still has an unchecked acceptance item`).not.toMatch(/^- \[ \]/m);
    }
  });

  it('keeps Task 38 and the final release evidence closed', () => {
    const task = read('task.md');
    const release = read('docs/releases/v1.0.0-modernization-verification.md');
    expect(task).toContain('- [x] Task 38 — Cleanup production, release notes và maintenance calendar');
    expect(task).toContain('Production smoke run `30535769458`');
    expect(release).toContain('**State:** RELEASED');
    expect(release).not.toMatch(/^- \[ \]/m);
    expect(release).not.toContain('PREPARED');
  });

  it('does not reintroduce the known Task 33 mojibake', () => {
    const task = read('task.md');
    expect(task).toContain('Task 33 — Security Center/session management');
    expect(task).toContain('JWT mới có `sessionId`');
    expect(task).not.toMatch(/Task 33 \?|JWT m\?i|Ng\?\?i|\?\?i\/reset|C\?i \?\?t/);
  });
});
