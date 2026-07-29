// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callApi } = vi.hoisted(() => ({ callApi: vi.fn() }));
vi.mock('../src/services/apiAdapter', () => ({ callApi }));

import { useAuthStore } from '../stores/authStore';

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

  it('restores identity only from the server profile', async () => {
    callApi.mockResolvedValue({ data: { username: 'teacher-a', fullName: 'Cô A', role: 'teacher', teacherClass: '5A' } });
    await useAuthStore.getState().restoreSession();
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', isLoggedIn: true, username: 'teacher-a', teacherName: 'Cô A', isAdmin: false, teacherClass: '5A' });
  });

  it('clears client state even when server logout fails', async () => {
    useAuthStore.getState().loginSuccess('teacher-a', 'Cô A', true, '5A');
    callApi.mockRejectedValue(new Error('offline'));
    const logout = useAuthStore.getState().logout();
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', isLoggedIn: false, isAdmin: false });
    await logout;
  });
});
