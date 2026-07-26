import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../../../../stores/authStore';
import { callApi } from '../../../services/apiAdapter';
import { ApiError } from '../../../services/api/errors';
import { showError } from '../../../utils/toast';
import type { PasswordGateState } from './types';

export const useTeacherAccountGate = () => {
  const authStore = useAuthStore();
  const navigate = useNavigate();
  const [passwordGate, setPasswordGate] = useState<PasswordGateState | null>(null);

  useEffect(() => {
    if (!authStore.isLoggedIn) return;
    let active = true;
    callApi<{ data?: { mustChangePassword?: boolean } }>('get_account_profile')
      .then(response => {
        if (active && response.data?.mustChangePassword) {
          setPasswordGate({ requireCurrentPassword: false });
        }
      })
      .catch(error => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          authStore.logout();
          setPasswordGate(null);
          showError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          navigate('/', { replace: true });
          return;
        }
        if ((error instanceof ApiError && error.status === 403) || String(error).includes('Password change required')) {
          setPasswordGate({ requireCurrentPassword: false });
        }
      });
    return () => { active = false; };
  }, [authStore.isLoggedIn, authStore.username]);

  const completePasswordChange = () => {
    authStore.loginSuccess(
      authStore.username || '',
      authStore.teacherName || authStore.username || '',
      authStore.isAdmin,
      authStore.teacherClass,
    );
    setPasswordGate(null);
  };

  return { passwordGate, completePasswordChange };
};
