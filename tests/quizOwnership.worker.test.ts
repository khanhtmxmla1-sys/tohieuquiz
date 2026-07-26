import { describe, expect, it } from 'vitest';
import {
  loadTeacherQuizOwnerIdentity,
  quizOwnerMatchesIdentity,
} from '../workers/src/services/quizOwnership';

class Statement {
  bindings: unknown[] = [];
  constructor(private readonly row: Record<string, unknown> | null) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.row as T | null; }
}

class Database {
  constructor(private readonly row: Record<string, unknown> | null) {}
  prepare() { return new Statement(this.row); }
}

describe('quiz ownership compatibility', () => {
  it('accepts the canonical username and one unique legacy display name', async () => {
    const identity = await loadTeacherQuizOwnerIdentity(new Database({
      username: 'giang4a7',
      full_name: 'Cô Giang',
      full_name_count: 1,
    }) as any, 'giang4a7');

    expect(identity).toEqual({ username: 'giang4a7', legacyFullName: 'Cô Giang' });
    expect(quizOwnerMatchesIdentity('giang4a7', identity!)).toBe(true);
    expect(quizOwnerMatchesIdentity('  Cô Giang  ', identity!)).toBe(true);
    expect(quizOwnerMatchesIdentity('Cô Hạnh', identity!)).toBe(false);
  });

  it('does not accept a display name shared by multiple teacher accounts', async () => {
    const identity = await loadTeacherQuizOwnerIdentity(new Database({
      username: 'teacher-a',
      full_name: 'Giáo viên',
      full_name_count: 2,
    }) as any, 'teacher-a');

    expect(identity).toEqual({ username: 'teacher-a' });
    expect(quizOwnerMatchesIdentity('Giáo viên', identity!)).toBe(false);
  });

  it('returns null for a missing teacher account', async () => {
    await expect(loadTeacherQuizOwnerIdentity(new Database(null) as any, 'missing'))
      .resolves.toBeNull();
  });
});
