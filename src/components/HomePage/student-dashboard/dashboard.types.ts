import type { Assignment, Quiz } from '../../../types';
import type { GameLoopDashboard, GameLoopMission } from '../../../types/gameLoop.types';

export type AssignedQuiz = Quiz & { _assignmentData?: Assignment };

export type AssignmentVisualState = 'ready' | 'completed' | 'closed';

export interface StudentDashboardHeaderProps {
  studentName: string;
  className?: string;
  avatarUrl: string;
  level: number;
  coins: number;
  activeSection: 'dashboard' | 'achievements' | 'resultReports';
  giftShopEnabled: boolean;
  studentId: string;
  unifiedNotificationsReady: boolean;
  unifiedNotificationsEnabled: boolean;
  onSelectSection: (section: 'dashboard' | 'achievements' | 'resultReports') => void;
  onOpenAssignment: (assignmentId: string) => void;
  onOpenResultReport: (phieuId: string) => void;
  onOpenGiftShop: () => void;
  onOpenLiveExam: () => void;
  onOpenAvatar: () => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

export interface StudentDashboardHeroProps {
  firstName: string;
  hasReadyAssignment: boolean;
  attendanceClaimed: boolean;
  attendanceLabel: string;
  attendanceAvailable: boolean;
  onPrimaryAction: () => void;
  onAttendance: () => void;
}

export interface AssignedWorkSectionProps {
  quizzes: AssignedQuiz[];
  isLoading: boolean;
  errorMessage?: string | null;
  page: number;
  totalPages: number;
  reviewingAssignmentId?: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onStartQuiz: (quiz: AssignedQuiz) => void;
  onReviewQuiz: (quiz: AssignedQuiz) => void;
}

export interface LearningProgressPanelProps {
  dashboard: GameLoopDashboard | null;
  isLoading: boolean;
  errorMessage?: string | null;
  expanded: boolean;
  claimingMissionId?: GameLoopMission['id'] | null;
  onToggle: () => void;
  onRetry: () => void;
  onClaimMission: (missionId: GameLoopMission['id']) => void;
}

export interface WeeklyQuestViewModel {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  reward: { coins: number; exp: number; items: string[]; itemCount: number };
}

export interface WeeklyQuestsPanelProps {
  quests: WeeklyQuestViewModel[];
  isLoading: boolean;
  errorMessage?: string | null;
  claimingQuestId?: string | null;
  onRetry: () => void;
  onClaim: (questId: string) => void;
}

export interface RewardSidebarProps {
  dashboard: GameLoopDashboard | null;
  giftShopEnabled: boolean;
  isProcessing: boolean;
  onOpenChest: () => void;
  onOpenGiftShop: () => void;
  onOpenBadges: () => void;
}

export type PracticeSubjectId =
  | 'toan'
  | 'tieng-viet'
  | 'tu-nhien-xa-hoi'
  | 'tieng-anh'
  | 'tin-hoc';

export type PracticeSubjectIcon =
  | 'calculator'
  | 'book-open'
  | 'earth'
  | 'languages'
  | 'monitor';

export interface PracticeTopicSummary {
  name: string;
  count: number;
}

export interface PracticeSubjectDefinition {
  id: PracticeSubjectId;
  title: string;
  description: string;
  icon: PracticeSubjectIcon;
  aliases: readonly string[];
  accentClass: string;
  iconSurfaceClass: string;
  showOnHome: boolean;
}

export interface SubjectPracticeGridProps {
  availableSubjects: SubjectCardViewModel[];
  comingSoonSubjects: SubjectCardViewModel[];
  isLoading: boolean;
  errorMessage?: string | null;
  onRetry: () => void;
  onSelectSubject: (subjectId: PracticeSubjectId) => void;
}

export interface SubjectCardViewModel {
  id: PracticeSubjectId;
  title: string;
  description: string;
  icon: PracticeSubjectIcon;
  topicCount: number;
  questionCount: number;
  status: 'available' | 'coming-soon';
  accentClass: string;
  iconSurfaceClass: string;
}
