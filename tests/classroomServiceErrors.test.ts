import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/services/api/errors';

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(),
}));

vi.mock('../src/services/apiAdapter', () => ({
  callApi: mocks.callApi,
}));

import { deleteStudent, getClasses } from '../src/services/classroomService';

describe('classroomService error semantics', () => {
  beforeEach(() => {
    mocks.callApi.mockReset();
  });

  it('preserves ApiError identity so stores can distinguish authorization failures', async () => {
    const authError = new ApiError('Bạn không có quyền thực hiện thao tác này.', 403, 'HTTP_403');
    mocks.callApi.mockRejectedValueOnce(authError);

    await expect(getClasses()).rejects.toBe(authError);
  });

  it('rejects a failed student archive envelope instead of silently returning false', async () => {
    mocks.callApi.mockResolvedValueOnce({
      status: 'error',
      message: 'Không thể lưu trữ học sinh.',
    });

    await expect(deleteStudent('student-1')).rejects.toThrow('Không thể lưu trữ học sinh.');
  });
});
