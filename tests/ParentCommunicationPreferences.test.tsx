import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ParentCommunicationPreferences from '../src/features/parent-portal/components/ParentCommunicationPreferences';

const state = vi.hoisted(() => ({
  preferences: {
    email: 'parent@example.com',
    emailVerifiedAt: null,
    weeklyDigestEnabled: false,
    digestWeekday: 1 as const,
    digestHour: 19,
    timezone: 'Asia/Ho_Chi_Minh' as const,
    quietHoursEnabled: true,
    quietHoursStart: '21:00',
    quietHoursEnd: '07:00',
    emailKinds: ['quiz_result' as const, 'homework_due' as const],
    emailRolloutReady: true,
    updatedAt: '2026-07-29T08:00:00.000Z',
  },
  loadPreferences: vi.fn(async () => undefined),
  savePreferences: vi.fn(async () => true),
  requestEmailVerification: vi.fn(async () => true),
  isLoading: false,
  error: null as string | null,
}));

vi.mock('../src/features/parent-portal/useParentPortalStore', () => ({
  useParentPortalStore: (selector: (value: typeof state) => unknown) => selector(state),
}));

describe('ParentCommunicationPreferences', () => {
  it('loads settings, saves category/schedule preferences and requests email verification', async () => {
    render(<ParentCommunicationPreferences />);
    await waitFor(() => expect(state.loadPreferences).toHaveBeenCalled());

    const email = screen.getByLabelText('Email phụ huynh');
    fireEvent.change(email, { target: { value: 'new.parent@example.com' } });
    fireEvent.click(screen.getByText('Nhận bản tin học tập hằng tuần'));
    fireEvent.change(screen.getByLabelText('Ngày gửi'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Giờ gửi'), { target: { value: '18' } });
    fireEvent.click(screen.getByText('Thông báo lớp'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));

    await waitFor(() => expect(state.savePreferences).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new.parent@example.com',
      weeklyDigestEnabled: true,
      digestWeekday: 5,
      digestHour: 18,
      quietHoursStart: '21:00',
      quietHoursEnd: '07:00',
      emailKinds: expect.arrayContaining(['quiz_result', 'homework_due', 'class_announcement']),
    })));
    expect(await screen.findByText('Đã lưu cài đặt liên lạc.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Gửi xác minh' }));
    await waitFor(() => expect(state.requestEmailVerification).toHaveBeenCalled());
    expect(await screen.findByText(/Đã gửi liên kết xác minh/)).toBeVisible();
  });

  it('shows the rollout gate and disables email delivery controls until domain authentication is ready', () => {
    const original = state.preferences.emailRolloutReady;
    state.preferences.emailRolloutReady = false;
    render(<ParentCommunicationPreferences />);

    expect(screen.getByText(/SPF, DKIM và DMARC chưa hoàn tất/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gửi xác minh' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Nhận bản tin học tập hằng tuần/ })).toBeDisabled();
    state.preferences.emailRolloutReady = original;
  });
});
