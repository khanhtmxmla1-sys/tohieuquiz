import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnnouncementDeliveryStep } from '../src/features/notifications/admin/AnnouncementDeliveryStep';
import { createEmptyAnnouncementDraft, type AnnouncementDraft } from '../src/features/notifications/admin/AnnouncementComposer';
import { announcementScheduleToApi } from '../src/features/notifications/admin/announcementSchedule';

function Harness({ initial }: { initial?: AnnouncementDraft }) {
  const [draft, setDraft] = useState(initial ?? createEmptyAnnouncementDraft());
  return <AnnouncementDeliveryStep draft={draft} errors={{}} onChange={setDraft} />;
}

describe('AnnouncementDeliveryStep', () => {
  it('uses audience and timing radio cards instead of a technical status selector', () => {
    render(<Harness />);

    expect(screen.getByRole('radiogroup', { name: 'Đối tượng nhận' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Toàn hệ thống' })).toBeChecked();
    expect(screen.getByRole('radiogroup', { name: 'Thời điểm phát' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Phát ngay' })).toBeChecked();
    expect(screen.queryByLabelText('Trạng thái')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bắt đầu phát')).not.toBeInTheDocument();
  });

  it('shows scheduling only when requested and derives friendly end presets', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('radio', { name: 'Lên lịch' }));
    const start = screen.getByLabelText('Bắt đầu phát');
    fireEvent.change(start, { target: { value: '2026-08-11T08:30' } });
    fireEvent.click(screen.getByRole('radio', { name: '24 giờ' }));

    expect(start).toHaveValue('2026-08-11T08:30');
    expect(screen.getByTestId('announcement-end-value')).toHaveTextContent('12/08/2026 08:30');
  });

  it('defaults urgent announcements to non-dismissible and hides channels behind advanced controls', () => {
    render(<Harness initial={{
      ...createEmptyAnnouncementDraft(),
      priority: 'URGENT',
      channels: ['CRITICAL_STRIP'],
      dismissible: false,
    }} />);

    expect(screen.getByRole('checkbox', { name: 'Cho phép người xem đóng thông báo' })).not.toBeChecked();
    expect(screen.getByText(/cảnh báo khẩn nên giữ hiển thị/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Tin chạy' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kênh hiển thị nâng cao' }));
    expect(screen.getByRole('checkbox', { name: 'Tin chạy' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Hộp thư' })).not.toBeInTheDocument();
  });

  it('maps Hanoi local schedule values to UTC for the API', () => {
    expect(announcementScheduleToApi({
      startsAt: '2026-08-11T08:30',
      endsAt: '2026-08-12T08:30',
    })).toEqual({
      startsAt: '2026-08-11T01:30:00.000Z',
      endsAt: '2026-08-12T01:30:00.000Z',
    });
  });
});
