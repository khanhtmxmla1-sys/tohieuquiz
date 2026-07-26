import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { PracticeSubjectId } from '../../../components/HomePage/student-dashboard/dashboard.types';
import { buildPracticeCatalog } from '../model';
import { usePracticeTopics } from './usePracticeTopics';

export const useStudentPracticeCatalog = () => {
  const navigate = useNavigate();
  const topicState = usePracticeTopics();
  const catalog = useMemo(
    () => buildPracticeCatalog(topicState.topics),
    [topicState.topics],
  );

  return {
    ...catalog,
    isLoading: topicState.isLoading,
    errorMessage: topicState.errorMessage,
    retry: topicState.retry,
    selectSubject: (subjectId: PracticeSubjectId) => {
      const subject = catalog.availableSubjects.find(item => item.id === subjectId);
      if (subject) {
        navigate(`/student/practice/${subject.id}`);
      }
    },
    closeSubject: () => navigate('/'),
  };
};

export type StudentPracticeCatalogController = ReturnType<typeof useStudentPracticeCatalog>;
