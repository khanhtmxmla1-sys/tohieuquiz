import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { Quiz } from '@/src/types';
import {
  buildAttendanceQuestionPool, pickAttendanceQuestion, type AttendanceQuestion,
} from '../model';

export const useAttendanceModalState = (quizzes: Quiz[], claimedToday: boolean) => {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState<AttendanceQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const questionPool = useMemo(() => buildAttendanceQuestionPool(quizzes), [quizzes]);

  const open = useCallback(() => {
    if (claimedToday) {
      toast('Hôm nay em đã điểm danh nhận thưởng rồi. Mai quay lại nhé!', { icon: '📅' });
      return;
    }
    const nextQuestion = pickAttendanceQuestion(questionPool, question?.id);
    if (!nextQuestion) {
      toast.error('Hiện chưa có câu hỏi trắc nghiệm phù hợp trong ngân hàng đề.');
      return;
    }
    setQuestion(nextQuestion);
    setSelectedAnswer(null);
    setResult(null);
    setMessage('');
    setIsOpen(true);
  }, [claimedToday, question?.id, questionPool]);

  return {
    isOpen, question, selectedAnswer, result, message, isSubmitting,
    hasQuestions: questionPool.length > 0,
    open, close: () => setIsOpen(false), selectAnswer: setSelectedAnswer,
    setResult, setMessage, setIsSubmitting,
  };
};
