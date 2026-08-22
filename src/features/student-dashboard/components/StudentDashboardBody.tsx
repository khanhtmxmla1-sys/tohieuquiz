import { StudentHomeworkSection } from '@/src/features/homework/components/StudentHomeworkSection';
import {
  AssignedWorkSection, LearningProgressPanel, RewardSidebar, StudentDashboardHero,
  SubjectPracticeGrid, WeeklyQuestsPanel,
} from '@/src/components/HomePage/student-dashboard';
import type { StudentDashboardContentProps } from './content.types';
import { isCompetitionV1Enabled } from '../../../config/featureFlags';

export const StudentDashboardBody = ({
  studentSession, assignments, attendance, practice, rewards,
  giftShopEnabled, isOnline, onOpenGiftShop, onOpenBadges, onSelectHomework,
  onOpenPrimaryLearning, onSelectSection,
}: StudentDashboardContentProps) => {
  const competitionEnabled = isCompetitionV1Enabled();
  return (
  <div className="flex flex-col gap-8 md:gap-10">
    <StudentDashboardHero
      firstName={studentSession.fullName.split(' ').pop() || studentSession.fullName}
      hasReadyAssignment={assignments.hasReadyAssignment}
      attendanceClaimed={attendance.claimedToday}
      attendanceLabel={attendance.badgeText}
      attendanceAvailable={attendance.isAvailable && isOnline}
      onPrimaryAction={onOpenPrimaryLearning}
      onAttendance={attendance.open}
    />
    {competitionEnabled && (
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5" aria-labelledby="student-competition-entry-title">
        <h2 id="student-competition-entry-title" className="text-lg font-bold text-sky-950">Cuộc thi</h2>
        <p className="mt-1 text-sm text-sky-800">Xem vòng đang mở, số lượt còn lại và kết quả chính thức.</p>
        <button type="button" onClick={() => onSelectSection('competition')} className="mt-3 min-h-11 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">Mở cuộc thi</button>
      </section>
    )}
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,0.9fr)] xl:items-start">
      <div data-testid="student-dashboard-main-column" className="min-w-0 space-y-9">
        <AssignedWorkSection
          quizzes={assignments.pagedQuizzes}
          isLoading={assignments.isLoading}
          errorMessage={assignments.errorMessage}
          page={assignments.page}
          totalPages={assignments.totalPages}
          reviewingAssignmentId={assignments.reviewingAssignmentId}
          isOffline={!isOnline}
          onRetry={() => void assignments.retry()}
          onPageChange={assignments.setPage}
          onStartQuiz={assignments.startQuiz}
          onReviewQuiz={(quiz) => void assignments.reviewQuiz(quiz)}
        />
        <StudentHomeworkSection
          studentId={studentSession.studentId}
          classId={studentSession.classId}
          onSelectAssignment={onSelectHomework}
        />
        <WeeklyQuestsPanel
          quests={rewards.weeklyQuests}
          isLoading={rewards.isWeeklyQuestsLoading}
          errorMessage={rewards.weeklyQuestsError}
          claimingQuestId={rewards.claimingWeeklyQuestId}
          isOffline={!isOnline}
          onRetry={() => void rewards.retryWeeklyQuests()}
          onClaim={rewards.claimWeeklyQuest}
        />
        <SubjectPracticeGrid
          availableSubjects={practice.availableSubjects}
          comingSoonSubjects={practice.comingSoonSubjects}
          isLoading={practice.isLoading}
          errorMessage={practice.errorMessage}
          isOffline={!isOnline}
          onRetry={() => void practice.retry()}
          onSelectSubject={practice.selectSubject}
        />
      </div>
      <aside
        data-testid="student-dashboard-side-column"
        className="min-w-0 space-y-4 xl:sticky xl:top-24"
      >
        <LearningProgressPanel
          dashboard={rewards.dashboard}
          isLoading={rewards.isLoading}
          errorMessage={rewards.errorMessage}
          expanded={rewards.isJourneyExpanded}
          claimingMissionId={rewards.claimingMissionId}
          isOffline={!isOnline}
          onToggle={rewards.toggleJourney}
          onRetry={() => void rewards.retryDashboard()}
          onClaimMission={rewards.claimMission}
        />
        <RewardSidebar
          dashboard={rewards.dashboard}
          giftShopEnabled={giftShopEnabled}
          isProcessing={rewards.isLoading}
          isOffline={!isOnline}
          onOpenChest={rewards.claimChest}
          onOpenGiftShop={onOpenGiftShop}
          onOpenBadges={onOpenBadges}
        />
      </aside>
    </div>
    <div className="hidden border-t border-slate-200 pb-12 pt-6 text-center md:block">
      <p className="text-sm font-medium text-slate-500">
        ÍtOngQuiz © 2026 · Không gian học tập dành cho học sinh
      </p>
    </div>
  </div>
  );
};
