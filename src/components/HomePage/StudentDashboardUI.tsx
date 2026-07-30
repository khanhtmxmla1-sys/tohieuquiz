import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router';
import SubjectLibrary from '../student/PracticeLibrary/SubjectLibrary';
import { StudentFloatingSidebar } from '../gamification/StudentFloatingSidebar';
import ResultScreen from '../student/ResultScreen';
import {
  StudentDashboardContent,
  StudentDashboardModals,
  StudentLiveExamScreen,
  useStudentDashboardController,
} from '../../features/student-dashboard';
import { isPracticeSubjectId } from '../../features/student-dashboard/model';
import { useQuizStore } from '../../../stores/quizStore';
import { StudentQuizView } from '../../app/StudentQuizView';

const StudentDashboardUI = () => {
  const location = useLocation();
  const { subjectId, sessionId } = useParams<{ subjectId?: string; sessionId?: string }>();
  const controller = useStudentDashboardController(sessionId);
  const quizView = useQuizStore((state) => state.view);
  const selectedQuiz = useQuizStore((state) => state.selectedQuiz);
  const {
    studentSession, liveExam, practice, activeSection, giftShopEnabled,
    assignments, attendance, rewards, account,
  } = controller;

  useEffect(() => {
    const targetId = location.pathname === '/student/assignments'
      ? 'assigned-work'
      : location.pathname === '/student/practice'
        ? 'practice-library'
        : null;
    if (!targetId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  if (liveExam.shouldRenderScreen) return <StudentLiveExamScreen controller={liveExam} />;
  if (!studentSession) return null;
  if (quizView === 'student' && selectedQuiz) return <StudentQuizView />;
  if (assignments.reviewState) {
    return (
      <ResultScreen
        quiz={assignments.reviewState.quiz}
        result={assignments.reviewState.result}
        answers={assignments.reviewState.answers}
        initialTab="review"
        onExit={assignments.closeReview}
        studentName={studentSession.fullName}
        studentClass={studentSession.className}
      />
    );
  }
  if (subjectId) {
    return (
      <SubjectLibrary
        subjectId={subjectId}
        isValidSubject={isPracticeSubjectId(subjectId)}
        onBack={practice.closeSubject}
      />
    );
  }

  return (
    <div className="student-dashboard flex min-h-dvh flex-col items-center bg-[#FFFDF7] font-['Be_Vietnam_Pro'] text-[#172033]">
      <StudentDashboardContent
        studentSession={studentSession}
        activeSection={activeSection}
        selectedResultReportId={controller.selectedResultReportId}
        giftShopEnabled={giftShopEnabled}
        isOnline={controller.isOnline}
        dashboardUpdatedAt={controller.dashboardUpdatedAt}
        assignments={assignments}
        attendance={attendance}
        practice={practice}
        rewards={rewards}
        onSelectSection={controller.setActiveSection}
        onOpenAssignments={controller.openAssignments}
        onOpenPractice={controller.openPractice}
        onOpenPrimaryLearning={controller.openPrimaryLearning}
        onOpenResultReport={controller.openResultReport}
        onOpenGiftShop={controller.openGiftShop}
        onOpenLiveExam={() => {
          if (controller.isOnline) liveExam.openJoinModal();
        }}
        onOpenAvatar={controller.openAvatar}
        onOpenChangePassword={account.open}
        onClearDeviceData={account.clearDeviceData}
        onOpenBadges={controller.openBadgeGallery}
        onLogout={account.logout}
        onSelectHomework={controller.setSelectedHomework}
      />
      <StudentDashboardModals
        studentSession={studentSession}
        attendance={attendance}
        account={account}
        rewards={rewards}
        liveExam={liveExam}
        selectedHomework={controller.selectedHomework}
        homeworkSubmission={controller.homeworkSubmission}
        isAvatarOpen={controller.isAvatarOpen}
        isBadgeGalleryOpen={controller.isBadgeGalleryOpen}
        onCloseHomework={() => controller.setSelectedHomework(null)}
        onCloseAvatar={controller.closeAvatar}
        onCloseBadgeGallery={controller.closeBadgeGallery}
      />
      <StudentFloatingSidebar />
    </div>
  );
};

export default StudentDashboardUI;
