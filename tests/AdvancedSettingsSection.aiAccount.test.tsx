import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdvancedSettingsSection from '../src/features/quiz-generator/components/AdvancedSettingsSection';

const renderSection = (configured: boolean) => {
  const onOpenAiSettings = vi.fn();
  render(
    <AdvancedSettingsSection
      requireCode={false}
      setRequireCode={vi.fn()}
      accessCode=""
      setAccessCode={vi.fn()}
      generateRandomCode={() => 'ABC123'}
      showOnHome
      setShowOnHome={vi.fn()}
      aiProvider="gemini-personal"
      setAiProvider={vi.fn()}
      isAdmin={false}
      aiCredentials={{
        enabled: true,
        capabilities: { text: true, documents: false, images: false, ocr: false, webSearch: false, imageGeneration: false },
        summaries: {
          gemini: { provider: 'gemini', configured, last4: configured ? '1234' : null, version: configured ? 1 : 0, verifiedAt: null, updatedAt: null },
          deepseek: { provider: 'deepseek', configured: false, last4: null, version: 0, verifiedAt: null, updatedAt: null },
        },
        defaultSource: 'gemini-personal',
        loading: false,
        error: null,
        save: vi.fn(),
        test: vi.fn(),
        remove: vi.fn(),
        setDefaultSource: vi.fn(),
        refetch: vi.fn(),
      }}
      onOpenAiSettings={onOpenAiSettings}
      isGenerating={false}
      isOpen
      onToggle={vi.fn()}
    />,
  );
  return { onOpenAiSettings };
};

describe('AdvancedSettingsSection AI account settings', () => {
  it('shows only account key status and opens the central settings dialog', () => {
    const { onOpenAiSettings } = renderSection(false);

    expect(screen.queryByLabelText('API key Gemini')).not.toBeInTheDocument();
    expect(screen.getByText(/chưa lưu API key Gemini/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mở cài đặt AI' }));
    expect(onOpenAiSettings).toHaveBeenCalledTimes(1);
  });

  it('shows masked metadata when the selected personal source is configured', () => {
    renderSection(true);

    expect(screen.getByText(/Đã lưu.*1234/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('API key Gemini')).not.toBeInTheDocument();
  });
});
