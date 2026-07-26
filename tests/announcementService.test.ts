import { beforeEach, describe, expect, it, vi } from 'vitest';

const callApi = vi.hoisted(() => vi.fn());

vi.mock('../src/services/apiAdapter', () => ({ callApi }));

import {
  getAnnouncement,
  getAnnouncements,
} from '../src/services/announcementService';

describe('announcement service compatibility adapter', () => {
  beforeEach(() => {
    callApi.mockReset();
  });

  it('maps the collection response from the canonical worker API', async () => {
    callApi.mockResolvedValue({
      status: 'success',
      data: {
        items: [
          {
            id: 'announcement-1',
            content: 'Tin mới',
            isActive: true,
            updatedAt: '2026-07-24T00:00:00.000Z',
            priority: 'IMPORTANT',
            channels: ['TICKER', 'BANNER'],
            dismissible: true,
          },
        ],
      },
    });

    await expect(getAnnouncements('teacher')).resolves.toEqual([
      expect.objectContaining({
        id: 'announcement-1',
        priority: 'IMPORTANT',
        channels: ['TICKER', 'BANNER'],
      }),
    ]);
    expect(callApi).toHaveBeenCalledWith('get_teacher_announcement');
  });

  it('keeps getAnnouncement working with the legacy single-item shape', async () => {
    callApi.mockResolvedValue({
      status: 'success',
      announcement: {
        id: 'legacy-1',
        content: 'Tin cũ',
        is_active: 'true',
        updated_at: '2026-07-23T00:00:00.000Z',
        channels_json: '["TICKER"]',
      },
    });

    await expect(getAnnouncement()).resolves.toMatchObject({
      id: 'legacy-1',
      channels: ['TICKER'],
    });
  });
});
