import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { PracticeSubjectId } from '../../../components/HomePage/student-dashboard/dashboard.types';
import { buildPracticeCatalog } from '../model';
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
    // A plain navigate('/') is a PUSH, which useScrollReset would send to the top of the dashboard.
    // react-router keys the first history entry "default", so any other key means we pushed our way
    // here in-app and a real Back returns the student to the spot they left. Deep links and new tabs
    // start at "default" and get a replace instead, so this never walks them off the site.
    closeSubject: () => (location.key === 'default'
      ? navigate('/', { replace: true })
      : navigate(-1)),
  };
};

export type StudentPracticeCatalogController = ReturnType<typeof useStudentPracticeCatalog>;
