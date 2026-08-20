import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const pollingQueryMock = vi.hoisted(() => vi.fn(() => ({
  data: { messages: [], settings: { enabled: true } },
  isLoading: false,
  error: null,
  refetch: vi.fn(async () => undefined),
})));
const legacyChatHookMock = vi.hoisted(() => vi.fn(() => {
  throw new Error('student waiting room must not use the shared 3s chat poller');
}));

vi.mock('../src/features/live-exam/hooks/usePollingQuery', () => ({
  usePollingQuery: pollingQueryMock,
}));
vi.mock('../src/hooks/useWaitingRoomChat', () => ({
  useWaitingRoomChat: legacyChatHookMock,
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

describe('WaitingRoomStudent chat polling', () => {
  it('uses the slower student-only chat cadence instead of the shared 3s poller', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75);

    render(React.createElement(WaitingRoomStudent as any, {
      sessionId: 'live-chat',
      sessionTitle: 'Exam',
      onExamStart: vi.fn(),
      status: {
        session: { status: 'waiting', duration: 30 },
        participantCount: 8,
      },
    }));

    expect(legacyChatHookMock).not.toHaveBeenCalled();
    expect(pollingQueryMock).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      intervalMs: 8_500,
    }));
    expect(screen.getByTestId('waiting-room-chat')).toBeInTheDocument();
  });
});
