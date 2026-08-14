import { beforeEach, describe, expect, it, vi } from 'vitest';

const callApi = vi.hoisted(() => vi.fn());
vi.mock('../src/services/apiAdapter', () => ({ callApi }));

import { getSystemSettings } from '../src/services/systemSettingsService';

describe('systemSettingsService randomization parsing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes randomization settings returned by the Worker', async () => {
    callApi.mockResolvedValue({
      status: 'success',
      data: {
        aiAssistantEnabled: true,
        unifiedNotificationsEnabled: false,
        randomization: {
          enabled: false,
          shuffleQuestions: false,
          shuffleChoices: true,
          shuffleMatching: false,
          shuffleOrdering: true,
          shuffleDragDrop: false,
          randomizePracticeSelection: false,
        },
      },
    });

    const settings = await getSystemSettings();
    expect(settings.randomization).toEqual({
      enabled: false,
      shuffleQuestions: false,
      shuffleChoices: true,
      shuffleMatching: false,
      shuffleOrdering: true,
      shuffleDragDrop: false,
      randomizePracticeSelection: false,
    });
  });
});
