import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  save: vi.fn(async (value) => value),
}));

vi.mock('../src/features/notifications/notificationService', () => ({
  fetchNotificationPreferences: vi.fn().mockResolvedValue({
    criticalEnabled: true,
    actionRequiredEnabled: true,
    informationalEnabled: true,
    quietHoursEnabled: false,
    quietStart: '21:00',
    quietEnd: '06:30',
    timezoneOffsetMinutes: 420,
    typePreferences: {},
  }),
  saveNotificationPreferences: service.save,
}));

import { NotificationPreferencesPanel } from '../src/features/notifications/components';

describe('NotificationPreferencesPanel', () => {
  it('keeps critical alerts mandatory and saves optional severity preferences', async () => {
    const onClose = vi.fn();
    render(<NotificationPreferencesPanel onClose={onClose} />);

    expect(await screen.findByText(/khẩn cấp luôn được bật/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Thông báo thông tin'));
    fireEvent.click(screen.getByLabelText('Giờ yên lặng cho thông báo thông tin'));
    fireEvent.change(screen.getByLabelText('Bắt đầu'), { target: { value: '22:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));

    await waitFor(() => expect(service.save).toHaveBeenCalledWith(expect.objectContaining({
      criticalEnabled: true,
      informationalEnabled: false,
      quietHoursEnabled: true,
      quietStart: '22:00',
    })));
    expect(onClose).toHaveBeenCalled();
  });
});
