import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import {
  getStudentRoute,
  getStudentSectionRoute,
  resolveStudentSectionFromLocation,
} from '../../../app/navigationRoutes';
import { useClassroomStore } from '@/src/stores/useClassroomStore';
import { useHomeworkStore } from '@/src/features/homework/stores/useHomeworkStore';
import type { HomeworkAssignment } from '@/src/features/homework/types';
import { useQuizStore } from '@/stores/quizStore';
import type { StudentDashboardSection } from '../components/content.types';
import { useStudentAccount } from './useStudentAccount';
import { useStudentAssignments } from './useStudentAssignments';
import { useStudentAttendance } from './useStudentAttendance';
import { useStudentLiveExam } from './useStudentLiveExam';
import { useStudentPracticeCatalog } from './useStudentPracticeCatalog';
import { useStudentRewards } from './useStudentRewards';

export const useStudentDashboardController = (liveExamSessionId?: string) => {
  const { isOnline } = useOnlineStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentSession = useClassroomStore((state) => state.studentSession);
  const homeworkSubmissions = useHomeworkStore((state) => state.submissions);
  const quizzes = useQuizStore((state) => state.quizzes);
  const activeSection = resolveStudentSectionFromLocation(location.pathname);
  const selectedResultReportId = activeSection === 'resultReports'
    ? searchParams.get('report')
    : null;
  const [selectedHomework, setSelectedHomework] = useState<HomeworkAssignment | null>(null);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [isBadgeGalleryOpen, setIsBadgeGalleryOpen] = useState(false);

  const giftShopEnabled = String(import.meta.env.VITE_FEATURE_GIFT_SHOP_V2 || 'false')
    .toLowerCase() === 'true';
  const practice = useStudentPracticeCatalog();
  const assignments = useStudentAssignments(studentSession?.studentId);
  const attendance = useStudentAttendance(studentSession?.username, quizzes);
  const rewards = useStudentRewards(studentSession?.username);
  const account = useStudentAccount(studentSession);
  const liveExam = useStudentLiveExam({
    initialSessionId: liveExamSessionId,
    onJoined: (sessionId) => navigate(getStudentRoute('liveExam', { sessionId })),
    onUnrestoredClose: () => navigate(getStudentRoute('dashboard'), { replace: true }),
  });
  const dashboardUpdatedAt = useMemo(() => {
    const hasDashboardData = assignments.pagedQuizzes.length > 0
      || practice.subjects.length > 0
      || Boolean(rewards.dashboard)
      || rewards.weeklyQuests.length > 0;
    return hasDashboardData ? Date.now() : null;
  }, [
    assignments.pagedQuizzes,
    practice.subjects,
    rewards.dashboard,
    rewards.weeklyQuests,
  ]);
  const homeworkSubmission = selectedHomework
    ? homeworkSubmissions.find((submission) => submission.assignment_id === selectedHomework.id)
    : undefined;

  const selectSection = (section: StudentDashboardSection) => {
    navigate(getStudentSectionRoute(section));
  };
  const openResultReport = (phieuId: string) => {
    const params = new URLSearchParams({ report: phieuId });
    navigate(`${getStudentRoute('results')}?${params.toString()}`);
  };

  return {
    studentSession,
    activeSection,
    setActiveSection: selectSection,
    selectedResultReportId,
    openResultReport,
    openAssignments: () => navigate(getStudentRoute('assignments')),
    openPractice: () => navigate(getStudentRoute('practice')),
    openPrimaryLearning: () => navigate(
      assignments.hasReadyAssignment
        ? getStudentRoute('assignments')
        : getStudentRoute('practice'),
    ),
    selectedHomework,
    setSelectedHomework,
    isAvatarOpen,
    openAvatar: () => setIsAvatarOpen(true),
    closeAvatar: () => setIsAvatarOpen(false),
    isBadgeGalleryOpen,
    openBadgeGallery: () => setIsBadgeGalleryOpen(true),
    closeBadgeGallery: () => setIsBadgeGalleryOpen(false),
    giftShopEnabled,
    isOnline,
    dashboardUpdatedAt,
    openGiftShop: () => {
      if (giftShopEnabled && isOnline) navigate(getStudentRoute('shop'));
    },
    practice,
    assignments,
    attendance,
    rewards,
    account,
    liveExam,
    homeworkSubmission,
  };
};

export type StudentDashboardController = ReturnType<typeof useStudentDashboardController>;
