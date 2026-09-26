import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AiAccountSettingsDialog from '../src/components/TeacherDashboard/teacher-dashboard-shell/AiAccountSettingsDialog';
import type { AiCredentialsController } from '../src/features/quiz-generator/hooks/useAiCredentials';

const buildController = (): AiCredentialsController => ({
  enabled: true,
  capabilities: {
    text: true,
    documents: false,
    images: false,
    ocr: false,
    webSearch: false,
    imageGeneration: false,
  },
  summaries: {
    gemini: {
      provider: 'gemini',
      configured: true,
      last4: '1111',
      version: 1,
      verifiedAt: '2026-09-26T01:00:00.000Z',
      updatedAt: '2026-09-26T01:00:00.000Z',
    },
    deepseek: {
      provider: 'deepseek',
      configured: false,
      last4: null,
      version: 0,
      verifiedAt: null,
      updatedAt: null,
    },
  },
  defaultSource: 'system',
  loading: false,
  error: null,
  save: vi.fn(async () => undefined),
  test: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  setDefaultSource: vi.fn(async () => undefined),
  refetch: vi.fn(async () => undefined),
});

describe('AiAccountSettingsDialog', () => {
  it('manages both personal providers and the account default source', async () => {
    const controller = buildController();
    render(
      <AiAccountSettingsDialog
        open
        onClose={vi.fn()}
        controller={controller}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Cài đặt AI' })).toBeInTheDocument();
    expect(screen.getByText('Gemini cá nhân — Đã lưu ••••1111')).toBeInTheDocument();
    expect(screen.getByLabelText('API key DeepSeek')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dùng Gemini cá nhân làm nguồn mặc định/i }));
    await waitFor(() => expect(controller.setDefaultSource).toHaveBeenCalledWith('gemini-personal'));

    expect(screen.getByRole('button', { name: /Dùng DeepSeek cá nhân làm nguồn mặc định/i })).toBeDisabled();
  });

  it('closes with Escape, restores focus, and clears an unsaved key on reopen', async () => {
    const controller = buildController();

    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Mở cài đặt AI</button>
          <AiAccountSettingsDialog open={open} onClose={() => setOpen(false)} controller={controller} />
        </>
      );
    };

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Mở cài đặt AI' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.change(screen.getByLabelText('API key DeepSeek'), {
      target: { value: 'deepseek-unsaved-canary' },
    });
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    expect(screen.getByLabelText('API key DeepSeek')).toHaveValue('');
  });
});
