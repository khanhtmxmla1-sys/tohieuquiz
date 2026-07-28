import { useMemo, useState } from 'react';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
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

export const useStudentDashboardController = () => {
  const { isOnline } = useOnlineStatus();
  const studentSession = useClassroomStore((state) => state.studentSession);
  const homeworkSubmissions = useHomeworkStore((state) => state.submissions);
  const setView = useQuizStore((state) => state.setView);
  const quizzes = useQuizStore((state) => state.quizzes);
  const [activeSection, setActiveSection] = useState<StudentDashboardSection>('dashboard');
  const [selectedResultReportId, setSelectedResultReportId] = useState<string | null>(null);
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
  const liveExam = useStudentLiveExam();
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
    setActiveSection(section);
    if (section !== 'resultReports') setSelectedResultReportId(null);
  };
  const openResultReport = (phieuId: string) => {
    setSelectedResultReportId(phieuId);
    setActiveSection('resultReports');
  };

  return {
    studentSession,
    activeSection,
    setActiveSection: selectSection,
    selectedResultReportId,
    openResultReport,
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
      if (giftShopEnabled && isOnline) setView('shop');
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

