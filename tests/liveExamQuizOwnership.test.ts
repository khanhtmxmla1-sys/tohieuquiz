import { describe, expect, it } from 'vitest';
import { isQuizOwnedByCurrentTeacher } from '../src/components/LiveExam/quizOwnership';

describe('live exam quiz ownership filter', () => {
  it('shows canonical and legacy-owned quizzes to the same teacher', () => {
    const identity = {
      username: 'giang4a7',
      teacherName: 'Cô Giang',
      isAdmin: false,
    };

    expect(isQuizOwnedByCurrentTeacher('giang4a7', identity)).toBe(true);
    expect(isQuizOwnedByCurrentTeacher(' Cô Giang ', identity)).toBe(true);
    expect(isQuizOwnedByCurrentTeacher('Cô Hạnh', identity)).toBe(false);
  });

  it('allows administrators to choose any quiz', () => {
    expect(isQuizOwnedByCurrentTeacher('another-owner', {
      username: 'admin',
      teacherName: 'Khánh',
      isAdmin: true,
    })).toBe(true);
  });
});
