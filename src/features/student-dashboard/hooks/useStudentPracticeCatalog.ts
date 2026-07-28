import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { PracticeSubjectId } from '../../../components/HomePage/student-dashboard/dashboard.types';
import { buildPracticeCatalog } from '../model';
import { getStudentRoute } from '../../../app/navigationRoutes';
import { usePracticeTopics } from './usePracticeTopics';

export const useStudentPracticeCatalog = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
    // Preserve the in-app history position; direct subject links fall back to the practice route.
    closeSubject: () => (location.key === 'default'
      ? navigate(getStudentRoute('practice'), { replace: true })
      : navigate(-1)),
  };
};

export type StudentPracticeCatalogController = ReturnType<typeof useStudentPracticeCatalog>;
