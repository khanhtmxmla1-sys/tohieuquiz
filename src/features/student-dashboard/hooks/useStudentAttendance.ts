import { useCallback } from 'react';
import type { Quiz } from '@/src/types';
import { callApi } from '@/src/services/apiAdapter';
import { useGamificationStore } from '@/src/stores/useGamificationStore';
import {
  getAttendanceBadgeText, getAttendanceSuccessMessage, getWrongAnswerMessage,
  type AttendanceClaimData,
} from '../model';
import { useAttendanceModalState } from './useAttendanceModalState';
import { useAttendanceStatus } from './useAttendanceStatus';

export const useStudentAttendance = (username: string | undefined, quizzes: Quiz[]) => {
  const status = useAttendanceStatus(username);
  const modal = useAttendanceModalState(quizzes, status.claimedToday);

  const submit = useCallback(async () => {
    if (!modal.question || !modal.selectedAnswer || status.claimedToday || modal.isSubmitting) return;
    if (modal.selectedAnswer !== modal.question.correctLabel) {
      modal.setResult('wrong');
      modal.setMessage(getWrongAnswerMessage(modal.question));
      return;
    }
    if (!username) {
      modal.setResult('wrong');
      modal.setMessage('Không xác định tài khoản học sinh để cộng thưởng.');
      return;
    }
    modal.setIsSubmitting(true);
    try {
      const response = await callApi<{
        status: 'success' | 'error'; data?: AttendanceClaimData; message?: string;
      }>('claim_daily_attendance', { username });
      if (response?.status !== 'success' || !response.data) {
        modal.setResult('wrong');
        modal.setMessage(response?.message || 'Không thể cộng thưởng lúc này. Em thử lại sau nhé!');
        return;
      }
      status.setClaimDates(Array.isArray(response.data.claimDates)
        ? response.data.claimDates : status.claimDates);
      if (response.data.alreadyClaimed || !response.data.claimed) {
        status.setClaimedToday(true);
        modal.setResult('wrong');
        modal.setMessage(response.data.message || 'Hôm nay em đã điểm danh rồi. Mai quay lại nhé!');
        return;
      }
      status.setClaimedToday(true);
      modal.setResult('correct');
      modal.setMessage(getAttendanceSuccessMessage(response.data));
      await useGamificationStore.getState().fetchPetData(username);
    } catch (error) {
      console.error('Attendance claim failed:', error);
      modal.setResult('wrong');
      modal.setMessage('Không thể cộng thưởng lúc này. Em thử lại sau nhé!');
    } finally {
      modal.setIsSubmitting(false);
    }
  }, [modal, status, username]);

  return {
    isOpen: modal.isOpen, question: modal.question, selectedAnswer: modal.selectedAnswer,
    result: modal.result, message: modal.message, isSubmitting: modal.isSubmitting,
    claimedToday: status.claimedToday,
    isAvailable: status.claimedToday || modal.hasQuestions,
    badgeText: getAttendanceBadgeText(
      status.claimedToday, status.claimDates.length, modal.hasQuestions,
    ),
    open: modal.open, close: modal.close, submit, selectAnswer: modal.selectAnswer,
  };
};

export type StudentAttendanceController = ReturnType<typeof useStudentAttendance>;
