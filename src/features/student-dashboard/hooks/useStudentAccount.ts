import { useCallback, useState, type FormEvent } from 'react';
import { showConfirm, showSuccess } from '@/src/utils/toast';
import { useAuthStore } from '@/stores/authStore';
import { useClassroomStore } from '@/src/stores/useClassroomStore';
import type { StudentSession } from '@/src/types/classroom.types';

export const useStudentAccount = (studentSession: StudentSession | null) => {
  const logoutStudent = useClassroomStore((state) => state.logoutStudent);
  const changeMyPassword = useClassroomStore((state) => state.changeMyPassword);
  const classroomError = useClassroomStore((state) => state.error);
  const [isOpen, setIsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setErrorMessage('');
  }, []);

  const open = useCallback(() => {
    reset();
    setIsOpen(true);
  }, [reset]);

  const close = useCallback(() => {
    if (isSubmitting) return;
    setIsOpen(false);
    reset();
  }, [isSubmitting, reset]);

  const logout = useCallback(() => {
    void showConfirm({
      message: 'Em có chắc chắn muốn đăng xuất không?',
      confirmLabel: 'Đăng xuất',
      onConfirm: () => {
        logoutStudent();
        useAuthStore.getState().logout();
      },
    });
  }, [logoutStudent]);

  const clearDeviceData = useCallback(() => {
    void showConfirm({
      message: 'Xóa toàn bộ dữ liệu TôHiệuQuiz đã lưu trên thiết bị này và đăng xuất?',
      confirmLabel: 'Xóa dữ liệu',
      destructive: true,
      onConfirm: () => {
        logoutStudent();
        useAuthStore.getState().logout();
        showSuccess('Đã xóa dữ liệu TôHiệuQuiz trên thiết bị này.');
      },
    });
  }, [logoutStudent]);

  const submit = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setErrorMessage('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải từ 6 ký tự.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Mật khẩu mới nhập lại chưa khớp.');
      return;
    }
    if (!studentSession?.studentId) {
      setErrorMessage('Không xác định được tài khoản học sinh.');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await changeMyPassword(studentSession.studentId, currentPassword, newPassword);
      if (!ok) {
        setErrorMessage(classroomError || 'Không thể đổi mật khẩu.');
        return;
      }
      showSuccess('Đổi mật khẩu thành công.');
      setIsOpen(false);
      reset();
    } finally {
      setIsSubmitting(false);
    }
  }, [changeMyPassword, classroomError, confirmNewPassword, currentPassword, newPassword, reset, studentSession?.studentId]);

  return {
    isOpen,
    currentPassword,
    newPassword,
    confirmNewPassword,
    errorMessage,
    isSubmitting,
    open,
    close,
    logout,
    clearDeviceData,
    submit,
    setCurrentPassword,
    setNewPassword,
    setConfirmNewPassword,
  };
};

export type StudentAccountController = ReturnType<typeof useStudentAccount>;
