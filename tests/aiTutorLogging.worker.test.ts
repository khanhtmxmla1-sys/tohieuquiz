import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routeSource = readFileSync(resolve(process.cwd(), 'workers/src/routes/aiTutor.ts'), 'utf8');

describe('AI Tutor privacy-safe logging', () => {
  it('uses the private service binding and never global fetch', () => {
    expect(routeSource).toContain('env.AI_GATEWAY.fetch');
    expect(routeSource).not.toMatch(/(?<!AI_GATEWAY\.)\bfetch\s*\(/);
  });

  it('does not log prompt, provider output, answers, student names or raw payloads', () => {
    for (const forbidden of ['console.log(prompt', 'console.log(content', 'student_name', 'raw:', 'wrongQuestionIds']) {
      expect(routeSource).not.toContain(forbidden);
    }
  });
});
