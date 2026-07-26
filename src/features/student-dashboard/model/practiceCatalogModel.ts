import type {
  PracticeSubjectId,
  PracticeTopicSummary,
  SubjectCardViewModel,
} from '@/src/components/HomePage/student-dashboard/dashboard.types';
import { SUBJECT_CONFIG, SUBJECT_ORDER } from './dashboardConstants';

export interface PracticeCatalog {
  topicsBySubject: Record<PracticeSubjectId, PracticeTopicSummary[]>;
  subjects: SubjectCardViewModel[];
  availableSubjects: SubjectCardViewModel[];
  comingSoonSubjects: SubjectCardViewModel[];
}

const stripVietnameseMarks = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

export const normalizePracticeTopic = (value: string): string => {
  const normalized = stripVietnameseMarks(value.trim().toLowerCase())
    .replace(/[^a-z0-9#]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) return '#';
  return normalized.startsWith('#') ? normalized : `#${normalized}`;
};

export const isPracticeSubjectId = (value: string): value is PracticeSubjectId =>
  SUBJECT_ORDER.includes(value as PracticeSubjectId);

export const matchesPracticeSubject = (
  topicName: string,
  subjectId: PracticeSubjectId,
): boolean => {
  const normalizedTopic = normalizePracticeTopic(topicName);
  const subject = SUBJECT_CONFIG[subjectId];
  const routeAlias = `#${subjectId.replace(/-/g, '_')}`;

  return [routeAlias, ...subject.aliases]
    .map(normalizePracticeTopic)
    .some(alias => normalizedTopic.includes(alias));
};

export const getTopicsForSubject = (
  topics: PracticeTopicSummary[],
  subjectId: PracticeSubjectId,
): PracticeTopicSummary[] =>
  topics
    .filter(topic => matchesPracticeSubject(topic.name, subjectId))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));

export const buildPracticeCatalog = (topics: PracticeTopicSummary[]): PracticeCatalog => {
  const topicsBySubject = Object.fromEntries(
    SUBJECT_ORDER.map(subjectId => [subjectId, getTopicsForSubject(topics, subjectId)]),
  ) as Record<PracticeSubjectId, PracticeTopicSummary[]>;

  const subjects = SUBJECT_ORDER
    .map(subjectId => {
      const definition = SUBJECT_CONFIG[subjectId];
      const subjectTopics = topicsBySubject[subjectId];
      const questionCount = subjectTopics.reduce((sum, topic) => sum + topic.count, 0);

      return {
        id: definition.id,
        title: definition.title,
        description: definition.description,
        icon: definition.icon,
        topicCount: subjectTopics.length,
        questionCount,
        status: questionCount > 0 ? 'available' : 'coming-soon',
        accentClass: definition.accentClass,
        iconSurfaceClass: definition.iconSurfaceClass,
      } satisfies SubjectCardViewModel;
    })
    .filter(subject => SUBJECT_CONFIG[subject.id].showOnHome);

  return {
    topicsBySubject,
    subjects,
    availableSubjects: subjects.filter(subject => subject.status === 'available'),
    comingSoonSubjects: subjects.filter(subject => subject.status === 'coming-soon'),
  };
};
