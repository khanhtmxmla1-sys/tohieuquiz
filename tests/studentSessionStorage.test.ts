// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callApi } = vi.hoisted(() => ({ callApi: vi.fn() }));
vi.mock('../src/services/apiAdapter', () => ({ callApi }));

import { StorageKeys } from '../src/constants/storageKeys';
import { useClassroomStore } from '../src/stores/useClassroomStore';

describe('student session browser persistence', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        callApi.mockReset();
        useClassroomStore.setState({ studentSession: null, isLoading: false, error: null });
    });

    it('stores only a boolean restore hint after login', async () => {
        callApi.mockResolvedValue({ status: 'success', data: {
            studentId: 's1', username: 'lan', fullName: 'Lan', classId: 'c1', coins: 8, shopItems: [],
        } });
        await useClassroomStore.getState().loginStudent({ username: 'lan', password: 'secret' });
        expect(localStorage.getItem(StorageKeys.STUDENT_SESSION)).toBeNull();
        expect(localStorage.getItem(StorageKeys.STUDENT_SESSION_RESTORE_HINT)).toBe('1');
        const stored = Object.keys(localStorage).map(key => localStorage.getItem(key)).join('');
        expect(stored).not.toContain('Lan');
        expect(stored).not.toContain('coins');
    });

    it('restores the profile from the server cookie', async () => {
        localStorage.setItem(StorageKeys.STUDENT_SESSION_RESTORE_HINT, '1');
        callApi.mockResolvedValue({ status: 'success', data: {
            studentId: 's1', username: 'lan', fullName: 'Lan', classId: 'c1', coins: 8, shopItems: [],
        } });
        await useClassroomStore.getState().restoreStudentSession();
        expect(callApi).toHaveBeenCalledWith('student_profile', {});
        expect(useClassroomStore.getState().studentSession?.fullName).toBe('Lan');
        expect(localStorage.getItem(StorageKeys.STUDENT_SESSION)).toBeNull();
    });
});
