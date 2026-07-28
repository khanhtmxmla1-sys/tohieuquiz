import type { HomeworkAssignment } from '@/src/features/homework/types';
import type { StudentSession } from '@/src/types/classroom.types';
import type { StudentAssignmentsController } from '../hooks/useStudentAssignments';
import type { StudentAttendanceController } from '../hooks/useStudentAttendance';
import type { StudentPracticeCatalogController } from '../hooks/useStudentPracticeCatalog';
import type { StudentRewardsController } from '../hooks/useStudentRewards';

export type StudentDashboardSection = 'dashboard' | 'achievements' | 'resultReports';

export interface StudentDashboardContentProps {
  studentSession: StudentSession;
  activeSection: StudentDashboardSection;
  selectedResultReportId: string | null;
  giftShopEnabled: boolean;
  isOnline: boolean;
  dashboardUpdatedAt: number | null;
  assignments: StudentAssignmentsController;
  attendance: StudentAttendanceController;
  practice: StudentPracticeCatalogController;
  rewards: StudentRewardsController;
  onSelectSection: (section: StudentDashboardSection) => void;
  onOpenAssignments: () => void;
  onOpenPractice: () => void;
  onOpenPrimaryLearning: () => void;
  onOpenResultReport: (phieuId: string) => void;
  onOpenGiftShop: () => void;
  onOpenLiveExam: () => void;
  onOpenAvatar: () => void;
  onOpenChangePassword: () => void;
  onClearDeviceData: () => void;
  onOpenBadges: () => void;
  onLogout: () => void;
  onSelectHomework: (assignment: HomeworkAssignment) => void;
}
