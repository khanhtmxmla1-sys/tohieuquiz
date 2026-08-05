import { beforeEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/apiAdapter', () => ({ callApi: callApiMock }));

import { fetchTeacherActionCenter } from '../src/services/teacherActionCenterService';

const generatedAt = '2026-08-05T03:30:00.000Z';
const draftItem = {
  id: 'drafts-unpublished',
  kind: 'draft_unpublished',
  severity: 'info',
  title: 'Bản nháp chưa hoàn tất',
  explanation: '1 bản nháp đang lưu trên máy chủ cần tiếp tục hoặc dọn dẹp.',
  count: 1,
  generatedAt,
  cta: {
    label: 'Tiếp tục bản nháp',
    url: '/teacher/quizzes/new?draftId=draft-latest',
  },
  secondaryAction: {
    kind: 'delete_draft',
    label: 'Xóa bản nháp',
    resourceId: 'draft-latest',
    resourceLabel: 'Đề Toán đang soạn',
    ownerUsername: 'teacher-a',
  },
};

describe('fetchTeacherActionCenter', () => {
  beforeEach(() => callApiMock.mockReset());

  it('accepts the structured delete action for a draft item', async () => {
    callApiMock.mockResolvedValue({
      status: 'success',
      data: { generatedAt, items: [draftItem] },
    });

    await expect(fetchTeacherActionCenter()).resolves.toEqual({
      generatedAt,
      items: [draftItem],
    });
  });

  it('rejects an unsupported mutation kind instead of exposing an unsafe action', async () => {
    callApiMock.mockResolvedValue({
      status: 'success',
      data: {
        generatedAt,
        items: [{
          ...draftItem,
          secondaryAction: { ...draftItem.secondaryAction, kind: 'delete_quiz' },
        }],
      },
    });

    await expect(fetchTeacherActionCenter()).rejects.toThrow(
      'Dữ liệu việc cần chú ý không hợp lệ.',
    );
  });

  it('rejects a delete-draft mutation attached to a non-draft item', async () => {
    callApiMock.mockResolvedValue({
      status: 'success',
      data: {
        generatedAt,
        items: [{
          ...draftItem,
          id: 'assignment-at-risk',
          kind: 'assignment_at_risk',
        }],
      },
    });

    await expect(fetchTeacherActionCenter()).rejects.toThrow(
      'Dữ liệu việc cần chú ý không hợp lệ.',
    );
  });
});
