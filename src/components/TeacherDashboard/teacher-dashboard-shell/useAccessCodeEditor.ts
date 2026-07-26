import { useState } from 'react';
import { useQuizStore } from '../../../../stores/quizStore';
import { showError, showSuccess } from '../../../utils/toast';

export const useAccessCodeEditor = () => {
  const quizStore = useQuizStore();
  const [editingAccessCode, setEditingAccessCode] = useState<{
    quizId: string;
    currentCode: string;
  } | null>(null);
  const [newAccessCode, setNewAccessCode] = useState('');

  const openAccessCodeEditor = (quizId: string, currentCode: string) => {
    setEditingAccessCode({ quizId, currentCode });
    setNewAccessCode(currentCode);
  };
  const closeAccessCodeEditor = () => setEditingAccessCode(null);
  const updateAccessCode = async () => {
    if (!editingAccessCode) return;
    const quiz = quizStore.quizzes.find(item => item.id === editingAccessCode.quizId);
    if (!quiz) return;
    const hasCode = newAccessCode.trim().length > 0;
    try {
      await quizStore.modifyQuiz({
        ...quiz,
        accessCode: hasCode ? newAccessCode.toUpperCase() : undefined,
        requireCode: hasCode,
      });
      setEditingAccessCode(null);
      setNewAccessCode('');
      showSuccess('Cap nhat ma lam bai thanh cong!');
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      showError(`Loi khi cap nhat: ${normalized.message || 'Unknown error'}`);
    }
  };

  return {
    editingAccessCode,
    newAccessCode,
    setNewAccessCode,
    openAccessCodeEditor,
    closeAccessCodeEditor,
    updateAccessCode,
  };
};
