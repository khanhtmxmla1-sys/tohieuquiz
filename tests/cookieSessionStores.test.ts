// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callApi } = vi.hoisted(() => ({ callApi: vi.fn() }));
vi.mock('../src/services/apiAdapter', () => ({ callApi }));

import { useAuthStore } from '../stores/authStore';
import * as classroomService from '../src/services/classroomService';
import { useClassroomStore } from '../src/stores/useClassroomStore';
import { StorageKeys } from '../src/constants/storageKeys';

beforeEach(() => {
  localStorage.clear();
  callApi.mockReset();
  useAuthStore.setState({
    isLoggedIn: false,
    username: null,
    teacherName: null,
    isAdmin: false,
    teacherClass: null,
    isLoggingIn: false,
    loginError: false,
  });
  useClassroomStore.setState({ studentSession: null, isLoading: false, error: null });
});

describe('cookie-backed session stores', () => {
  it('persists only teacher display metadata, never a token', () => {
    useAuthStore.getState().loginSuccess('teacher-a', 'Cô An', false, '3A');
    const persisted = localStorage.getItem('auth-storage') || '';

    expect(persisted).toContain('teacher-a');
    expect(persisted).not.toContain('token');
    expect(useAuthStore.getState()).not.toHaveProperty('token');
  });

  it('restores a teacher session by asking the server to validate the cookie', async () => {
    useAuthStore.setState({ isLoggedIn: true, username: 'stale-name' });
    callApi.mockResolvedValue({ data: { username: 'teacher-a', fullName: 'Cô An', role: 'admin' } });

    await useAuthStore.getState().restoreSession();

    expect(callApi).toHaveBeenCalledWith('get_account_profile');
    expect(useAuthStore.getState()).toMatchObject({
      isLoggedIn: true, username: 'teacher-a', teacherName: 'Cô An', isAdmin: true,
    });
  });

  it('strips a compat token from student login data before persistence', async () => {
    callApi.mockResolvedValue({
      status: 'success',
      data: { studentId: 'student-a', username: 'student-a', fullName: 'Lan', classId: 'class-a', token: 'legacy-token' },
    });

    const session = await classroomService.studentLogin({ username: 'student-a', password: 'secret' });
    expect(session).not.toHaveProperty('token');
  });

  it('restores student metadata only after the server validates the cookie', async () => {
    localStorage.setItem(StorageKeys.STUDENT_SESSION, JSON.stringify({
      studentId: 'student-a', username: 'student-a', fullName: 'Old', classId: 'class-a',
    }));
    callApi.mockImplementation(async (action: string) => {
      if (action === 'student_profile') return {
        status: 'success',
        data: { studentId: 'student-a', username: 'student-a', fullName: 'Lan', classId: 'class-a', coins: 4, shopItems: [] },
      };
      return { status: 'success' };
    });

    await useClassroomStore.getState().restoreStudentSession();

    expect(callApi).toHaveBeenCalledWith('student_profile', {});
    expect(useClassroomStore.getState().studentSession).toMatchObject({ fullName: 'Lan', coins: 4 });
    expect(localStorage.getItem(StorageKeys.STUDENT_SESSION)).not.toContain('token');
  });
});
