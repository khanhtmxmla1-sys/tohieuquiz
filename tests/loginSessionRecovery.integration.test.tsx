import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import { useClassroomStore } from '../src/stores/useClassroomStore';
import { useSessionBootstrap } from '../src/app/useSessionBootstrap';
import { StorageKeys } from '../src/constants/storageKeys';

describe('session recovery with the real API client and stores', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useAuthStore.getState().logoutLocal();
    useClassroomStore.setState({ studentSession: null, isLoading: false, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('releases student login loading after a stalled request and allows retry in the same store', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const pendingLogin = useClassroomStore.getState().loginStudent({ username: 'student-a', password: 'test-password' });
    expect(useClassroomStore.getState().isLoading).toBe(true);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(useClassroomStore.getState().isLoading).toBe(false);
    await expect(pendingLogin).resolves.toBe(false);
    expect(useClassroomStore.getState().studentSession).toBeNull();

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      status: 'success',
      data: { studentId: 'student-a', username: 'student-a', fullName: 'Student A', classId: 'class-a' },
    }), { status: 200 }));
    await expect(useClassroomStore.getState().loginStudent({ username: 'student-a', password: 'test-password' }))
      .resolves.toBe(true);
    expect(useClassroomStore.getState()).toMatchObject({ isLoading: false, studentSession: { studentId: 'student-a' } });
  });

  it('finishes page bootstrap when both profile endpoints stall', async () => {
    localStorage.setItem(StorageKeys.STUDENT_SESSION_RESTORE_HINT, '1');
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const { result } = renderHook(() => useSessionBootstrap(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={['/teacher']}>{children}</MemoryRouter>,
    });
    expect(result.current).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current).toBe(true);
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', isLoggingIn: false });
    expect(useClassroomStore.getState()).toMatchObject({ studentSession: null, isLoading: false });
  });
});
