import { useState } from 'react';
import { getDefaultDeadline } from './assignmentComposerHelpers';

export const useAssignmentFormState = (initialQuizId = '') => {
  const [selectedQuizId, setSelectedQuizId] = useState(initialQuizId);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [deadline, setDeadline] = useState(getDefaultDeadline);
  const [maxAttempts, setMaxAttempts] = useState(1);

  const resetForm = () => {
    setSelectedQuizId(initialQuizId);
    setSelectedClassId('');
    setSelectedStudentId('');
    setDeadline(getDefaultDeadline());
    setMaxAttempts(1);
  };

  return {
    selectedQuizId,
    setSelectedQuizId,
    selectedClassId,
    setSelectedClassId,
    selectedStudentId,
    setSelectedStudentId,
    deadline,
    setDeadline,
    maxAttempts,
    setMaxAttempts,
    resetForm,
  };
};
