import { describe, expect, it, vi } from 'vitest';
import { loadActiveTeacherOptions } from '../src/features/class-management/utils/teacherOptions';

describe('loadActiveTeacherOptions', () => {
  it('loads every active teacher page using the returned cursor', async () => {
    const api = vi.fn()
      .mockResolvedValueOnce({
        data: {
          items: [{ username: 'teacher-a', full_name: 'Teacher A', role: 'teacher', status: 'ACTIVE', class: '' }],
          hasMore: true,
          nextCursor: 'cursor-1',
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ username: 'teacher-b', full_name: 'Teacher B', role: 'teacher', status: 'ACTIVE', class: '' }],
          hasMore: false,
          nextCursor: null,
        },
      });

    await expect(loadActiveTeacherOptions(api as any)).resolves.toEqual([
      expect.objectContaining({ username: 'teacher-a' }),
      expect.objectContaining({ username: 'teacher-b' }),
    ]);
    expect(api).toHaveBeenNthCalledWith(1, 'get_teachers', {
      status: 'ACTIVE',
      role: 'teacher',
      limit: 100,
    });
    expect(api).toHaveBeenNthCalledWith(2, 'get_teachers', {
      status: 'ACTIVE',
      role: 'teacher',
      limit: 100,
      cursor: 'cursor-1',
    });
  });

  it('rejects a repeated pagination cursor instead of looping forever', async () => {
    const api = vi.fn()
      .mockResolvedValueOnce({ data: { items: [], hasMore: true, nextCursor: 'same' } })
      .mockResolvedValueOnce({ data: { items: [], hasMore: true, nextCursor: 'same' } });

    await expect(loadActiveTeacherOptions(api as any)).rejects.toThrow('cursor');
    expect(api).toHaveBeenCalledTimes(2);
  });
});
