import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionBootstrap } from '../src/app/useSessionBootstrap';
import { useAuthStore } from '../stores/authStore';
import { useClassroomStore } from '../src/stores/useClassroomStore';

const Probe = () => {
  const ready = useSessionBootstrap();
  const navigate = useNavigate();

  return (
    <>
      <div data-testid="ready">{String(ready)}</div>
      <button type="button" onClick={() => navigate('/teacher/results')}>navigate</button>
    </>
  );
};

describe('useSessionBootstrap', () => {
  const restoreTeacherSession = vi.fn(async () => undefined);
  const restoreStudentSession = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ restoreSession: restoreTeacherSession });
    useClassroomStore.setState({ restoreStudentSession });
  });

  it('restores sessions once and does not restart when the route changes', async () => {
    render(
      <MemoryRouter initialEntries={['/teacher']}>
        <Probe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('true'));
    expect(restoreTeacherSession).toHaveBeenCalledTimes(1);
    expect(restoreTeacherSession).toHaveBeenCalledWith(true);
    expect(restoreStudentSession).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'navigate' }));

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
      expect(restoreTeacherSession).toHaveBeenCalledTimes(1);
      expect(restoreStudentSession).toHaveBeenCalledTimes(1);
    });
  });
});
