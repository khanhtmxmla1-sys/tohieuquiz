// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSystemSettings: vi.fn(),
  saveRandomizationSettings: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../src/services/systemSettingsService', () => ({
  getSystemSettings: mocks.getSystemSettings,
  saveRandomizationSettings: mocks.saveRandomizationSettings,
}));
vi.mock('../src/utils/toast', () => ({
  showSuccess: mocks.showSuccess,
  showError: mocks.showError,
}));

import { RandomizationSettingsPanel } from '../src/features/randomization/admin/RandomizationSettingsPanel';

const storedPolicy = {
  enabled: false,
  shuffleQuestions: true,
  shuffleChoices: false,
  shuffleMatching: true,
  shuffleOrdering: true,
  shuffleDragDrop: true,
  randomizePracticeSelection: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSystemSettings.mockResolvedValue({
    aiAssistantEnabled: true,
    unifiedNotificationsEnabled: false,
    randomization: storedPolicy,
  });
  mocks.saveRandomizationSettings.mockImplementation(async (policy) => policy);
});

describe('RandomizationSettingsPanel', () => {
  it('keeps child preferences visible but disabled while the master switch is off', async () => {
    render(<RandomizationSettingsPanel />);

    const master = await screen.findByRole('switch', { name: 'Random toàn bộ bài kiểm tra' });
    const questions = screen.getByRole('switch', { name: 'Đảo thứ tự câu hỏi' });
    const choices = screen.getByRole('switch', { name: 'Đảo đáp án A/B/C/D' });

    expect(master).toHaveAttribute('aria-checked', 'false');
    expect(questions).toBeDisabled();
    expect(questions).toHaveAttribute('aria-checked', 'true');
    expect(choices).toBeDisabled();
    expect(choices).toHaveAttribute('aria-checked', 'false');
  });

  it('restores child controls when master is enabled and saves raw preferences', async () => {
    render(<RandomizationSettingsPanel />);

    const master = await screen.findByRole('switch', { name: 'Random toàn bộ bài kiểm tra' });
    fireEvent.click(master);

    const choices = screen.getByRole('switch', { name: 'Đảo đáp án A/B/C/D' });
    expect(choices).not.toBeDisabled();
    fireEvent.click(choices);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cấu hình random' }));

    await waitFor(() => expect(mocks.saveRandomizationSettings).toHaveBeenCalledWith({
      ...storedPolicy,
      enabled: true,
      shuffleChoices: true,
    }));
    expect(mocks.showSuccess).toHaveBeenCalled();
  });
});
