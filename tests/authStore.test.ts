// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callApi } = vi.hoisted(() => ({ callApi: vi.fn() }));
vi.mock('../src/services/apiAdapter', () => ({ callApi }));

import { useAuthStore } from '../stores/authStore';
import { StorageKeys } from '../src/constants/storageKeys';

describe('canonical teacher auth store', () => {
  beforeEach(() => {
    localStorage.clear();
    callApi.mockReset();
    useAuthStore.getState().logoutLocal();
  });

  it('does not restore authentication from localStorage metadata', async () => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { isLoggedIn: true, isAdmin: true, username: 'forged' } }));
    callApi.mockRejectedValue(new Error('unauthorized'));
    await useAuthStore.getState().restoreSession();
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', isLoggedIn: false, isAdmin: false });
    expect(localStorage.getItem('auth-storage')).toBeNull();
  });

  it('can force server validation for a private teacher route without a restore hint', async () => {
    callApi.mockResolvedValue({ data: { username: 'teacher-a', fullName: 'Cô A', role: 'teacher', teacherClass: '5A' } });

    await useAuthStore.getState().restoreSession(true);

    expect(callApi).toHaveBeenCalledWith('get_account_profile');
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('restores identity only from the server profile', async () => {
    localStorage.setItem(StorageKeys.TEACHER_SESSION_RESTORE_HINT, '1');
    callApi.mockResolvedValue({ data: { username: 'teacher-a', fullName: 'Cô A', role: 'teacher', teacherClass: '5A' } });
    await useAuthStore.getState().restoreSession();
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', isLoggedIn: true, username: 'teacher-a', teacherName: 'Cô A', isAdmin: false, teacherClass: '5A' });
  });

  it('keeps the server class list canonical instead of collapsing a multi-class teacher to the first class name', async () => {
    localStorage.setItem(StorageKeys.TEACHER_SESSION_RESTORE_HINT, '1');
    callApi.mockResolvedValue({
      data: {
        username: 'teacher-a',
        fullName: 'Cô A',
        role: 'teacher',
        classes: [
          { id: 'class-4a', name: '4A' },
          { id: 'class-5b', name: '5B' },
        ],
      },
    });

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState()).toMatchObject({
      teacherClass: null,
      teacherClasses: [
        { id: 'class-4a', name: '4A' },
        { id: 'class-5b', name: '5B' },
      ],
    });
  });

  it('hydrates canonical classes immediately after login without waiting for an app bootstrap reload', async () => {
    callApi.mockResolvedValue({
      data: {
        username: 'teacher-a',
        fullName: 'Cô A',
        role: 'teacher',
        classes: [
          { id: 'class-4a', name: '4A' },
          { id: 'class-5b', name: '5B' },
        ],
      },
    });

    useAuthStore.getState().loginSuccess('teacher-a', 'Cô A', false, '4A');

    await vi.waitFor(() => {
      expect(callApi).toHaveBeenCalledWith('get_account_profile');
      expect(useAuthStore.getState()).toMatchObject({
        teacherClass: null,
        teacherClasses: [
          { id: 'class-4a', name: '4A' },
          { id: 'class-5b', name: '5B' },
        ],
      });
    });
  });

  it('clears client state even when server logout fails', async () => {
    callApi
      .mockResolvedValueOnce({ data: { username: 'teacher-a', fullName: 'Cô A', role: 'admin', classes: [] } })
      .mockRejectedValueOnce(new Error('offline'));
    useAuthStore.getState().loginSuccess('teacher-a', 'Cô A', true, '5A');
    const logout = useAuthStore.getState().logout();
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', isLoggedIn: false, isAdmin: false });
    await logout;
    expect(localStorage.getItem(StorageKeys.TEACHER_SESSION_RESTORE_HINT)).toBeNull();
  });
});
