import { useCallback, useMemo, useState } from 'react';
import { callApi } from '@/src/services/apiAdapter';
import { useGamificationStore } from '@/src/stores/useGamificationStore';
import { showError, showInfo } from '@/src/utils/toast';
import {
  getAttendanceBadgeText,
  type AttendanceAttemptData,
} from '../model';
import { useAttendanceStatus } from './useAttendanceStatus';

interface AttendanceApiResponse {
  status: 'success' | 'error';
  data?: AttendanceAttemptData;
  message?: string;
}

export const useStudentAttendance = (username?: string) => {
  const status = useAttendanceStatus(username);
  const [isOpen, setIsOpen] = useState(false);
  const [attempt, setAttempt] = useState<AttendanceAttemptData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const currentItem = attempt?.items[currentIndex] ?? null;
  const completed = Boolean(attempt?.completed);
  const resumableAttempt = status.attempt?.status === 'IN_PROGRESS' && !status.claimedToday;

  const open = useCallback(async () => {
    if (status.claimedToday) {
      showInfo('Hôm nay em đã điểm danh rồi. Mai quay lại nhé!');
      return;
    }
    if (!status.statusAvailable) {
      showError('Chưa thể xác minh trạng thái điểm danh. Em thử lại sau nhé!');
      return;
    }
    if (!status.available && !resumableAttempt) {
      showInfo('Giáo viên chưa bật điểm danh.');
      return;
    }
    if (!username || isSubmitting) return;

    setIsSubmitting(true);
    setMessage('');
    try {
      const response = await callApi<AttendanceApiResponse>('start_daily_attendance', { username });
      if (response?.status !== 'success' || !response.data) {
        showError(response?.message || 'Không thể bắt đầu điểm danh.');
        return;
      }
      const nextAttempt = response.data;
      setAttempt(nextAttempt);
      const firstUnanswered = nextAttempt.items.findIndex((item) => !item.isAnswered);
      setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
      setSelectedAnswer(null);
      setIsOpen(true);
    } catch (error) {
      console.error('Attendance start failed:', error);
      showError('Không thể bắt đầu điểm danh. Em thử lại sau nhé!');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, resumableAttempt, status.available, status.claimedToday, status.statusAvailable, username]);

  const submit = useCallback(async () => {
    if (!username || !attempt || !currentItem || !selectedAnswer || isSubmitting || completed) return;
    setIsSubmitting(true);
    setMessage('');
    try {
      const response = await callApi<AttendanceApiResponse>('answer_daily_attendance', {
        username,
        attemptId: attempt.attemptId,
        itemId: currentItem.id,
        selectedAnswer,
      });
      if (response?.status !== 'success' || !response.data) {
        setMessage(response?.message || 'Không thể lưu câu trả lời. Em thử lại nhé!');
        return;
      }

      const nextAttempt = response.data;
      setAttempt(nextAttempt);
      status.setAttempt({
        attemptId: nextAttempt.attemptId,
        status: nextAttempt.status,
        answeredCount: nextAttempt.answeredCount,
        correctCount: nextAttempt.correctCount,
        totalQuestions: nextAttempt.totalQuestions,
      });

      if (nextAttempt.completed) {
        status.setClaimedToday(true);
        setSelectedAnswer(null);
        await useGamificationStore.getState().fetchPetData(username);
        return;
      }

      const nextIndex = nextAttempt.items.findIndex((item) => !item.isAnswered);
      setCurrentIndex(nextIndex >= 0 ? nextIndex : Math.min(currentIndex + 1, nextAttempt.items.length - 1));
      setSelectedAnswer(null);
    } catch (error) {
      console.error('Attendance answer failed:', error);
      setMessage('Không thể lưu câu trả lời. Em thử lại nhé!');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    attempt, completed, currentIndex, currentItem, isSubmitting,
    selectedAnswer, status, username,
  ]);

  const close = useCallback(() => {
    if (!isSubmitting) setIsOpen(false);
  }, [isSubmitting]);

  const badgeText = useMemo(() => {
    if (resumableAttempt && status.attempt) {
      const remaining = Math.max(1, status.attempt.totalQuestions - status.attempt.answeredCount);
      return `Tiếp tục điểm danh · còn ${remaining} câu`;
    }
    return getAttendanceBadgeText(
      status.claimedToday,
      status.available,
      status.rewardPreview,
    );
  }, [resumableAttempt, status.attempt, status.available, status.claimedToday, status.rewardPreview]);

  return {
    isOpen,
    attempt,
    currentItem,
    currentNumber: currentIndex + 1,
    selectedAnswer,
    message,
    isSubmitting,
    completed,
    claimedToday: status.claimedToday,
    isVisible: status.statusAvailable && (status.enabled || resumableAttempt),
    isAvailable: status.statusAvailable && (status.available || resumableAttempt) && !status.claimedToday,
    badgeText,
    open,
    close,
    submit,
    selectAnswer: setSelectedAnswer,
  };
};

export type StudentAttendanceController = ReturnType<typeof useStudentAttendance>;
