import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const duplicateStatusPoll = vi.hoisted(() => vi.fn(() => {
  throw new Error('WaitingRoomStudent must not start a second status poll');
}));

vi.mock('../src/hooks', () => ({
  useLiveExamStatus: duplicateStatusPoll,
}));

vi.mock('../src/features/live-exam/hooks/useStudentWaitingRoomChat', () => ({
  useStudentWaitingRoomChat: () => ({
    messages: [],
    chatEnabled: true,
    isLoading: false,
    isSending: false,
    sendMessage: vi.fn(async () => undefined),
  }),
}));

vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: (selector: (state: any) => unknown) => selector({
    studentSession: { username: 'student-1' },
  }),
}));

vi.mock('../src/components/LiveExam/WaitingRoomChatPanel', () => ({
  default: () => <div data-testid="waiting-room-chat" />,
}));

import { WaitingRoomStudent } from '../src/components/LiveExam/WaitingRoomStudent';

describe('WaitingRoomStudent polling ownership', () => {
  it('renders the controller status without starting its own status poll', () => {
    render(React.createElement(WaitingRoomStudent as any, {
      sessionId: 'live-1',
      sessionTitle: 'Exam',
      onExamStart: vi.fn(),
      status: {
        session: { status: 'waiting', duration: 30 },
        participantCount: 8,
      },
    }));

    expect(duplicateStatusPoll).not.toHaveBeenCalled();
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});
