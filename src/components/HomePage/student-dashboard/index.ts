export { AssignedWorkSection } from './AssignedWorkSection';
export { LearningProgressPanel } from './LearningProgressPanel';
export { RewardSidebar } from './RewardSidebar';
export { StudentDashboardHeader } from './StudentDashboardHeader';
export { StudentDashboardHero } from './StudentDashboardHero';
export { SubjectPracticeGrid } from './SubjectPracticeGrid';
export { WeeklyQuestsPanel } from './WeeklyQuestsPanel';

export {
  AssignedWorkSkeleton,
  DashboardEmptyState,
  DashboardSectionError,
  HeroSkeleton,
  ProgressSkeleton,
} from './DashboardStates';

export type {
  AssignedQuiz,
  AssignedWorkSectionProps,
  AssignmentVisualState,
  LearningProgressPanelProps,
  PracticeSubjectDefinition,
  PracticeSubjectIcon,
  PracticeSubjectId,
  PracticeTopicSummary,
  RewardSidebarProps,
  StudentDashboardHeaderProps,
  StudentDashboardHeroProps,
  SubjectPracticeGridProps,
  SubjectCardViewModel,
  WeeklyQuestsPanelProps,
  WeeklyQuestViewModel,
} from './dashboard.types';

export {
  getAssignmentActionLabel,
  getAssignmentVisualState,
  getMissionProgressPercent,
  getWeeklyProgressPercent,
} from './dashboard.utils';

