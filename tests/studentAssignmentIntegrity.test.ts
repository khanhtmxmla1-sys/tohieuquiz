// Branch-protection review marker: comment-only change; no test or runtime behavior changes.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callApi } from '../src/services/apiAdapter';
import { getStudentAssignments } from '../src/services/classroomService';

vi.mock('../src/services/apiAdapter', () => ({
  callApi: vi.fn(),
}));

const callApiMock = vi.mocked(callApi);

describe('student assignment integrity', () => {
  beforeEach(() => {
    callApiMock.mockReset();
  });

  it('rejects worker errors instead of treating them as an empty assignment list', async () => {
    callApiMock.mockResolvedValueOnce({
      status: 'error',
      message: 'assignment backend unavailable',
    } as any);

    await expect(getStudentAssignments('student-1')).rejects.toThrow('assignment backend unavailable');
  });

  it('keeps a successful empty assignment list as a legitimate empty state', async () => {
    callApiMock.mockResolvedValueOnce({
      status: 'success',
      data: [],
    } as any);

    await expect(getStudentAssignments('student-1')).resolves.toEqual([]);
  });
});
