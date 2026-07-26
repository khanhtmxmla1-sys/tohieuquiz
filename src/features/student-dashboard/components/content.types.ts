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
  assignments: StudentAssignmentsController;
  attendance: StudentAttendanceController;
  practice: StudentPracticeCatalogController;
  rewards: StudentRewardsController;
  onSelectSection: (section: StudentDashboardSection) => void;
  onOpenResultReport: (phieuId: string) => void;
  onOpenGiftShop: () => void;
  onOpenLiveExam: () => void;
  onOpenAvatar: () => void;
  onOpenChangePassword: () => void;
  onOpenBadges: () => void;
  onLogout: () => void;
  onSelectHomework: (assignment: HomeworkAssignment) => void;
}
