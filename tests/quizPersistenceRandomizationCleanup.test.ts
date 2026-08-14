// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('quiz assignment persistence randomization cleanup', () => {
  it('does not send the dead shuffleQuestions assignment setting', () => {
    const source = readFileSync(
      new URL('../src/features/quiz-generator/hooks/useQuizPersistence.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('shuffleQuestions: true');
  });
});
