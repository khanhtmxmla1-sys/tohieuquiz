import { StudentHomeworkSection } from '@/src/features/homework/components/StudentHomeworkSection';
import {
  AssignedWorkSection, LearningProgressPanel, RewardSidebar, StudentDashboardHero,
  SubjectPracticeGrid, WeeklyQuestsPanel,
} from '@/src/components/HomePage/student-dashboard';
import type { StudentDashboardContentProps } from './content.types';

export const StudentDashboardBody = ({
  studentSession, assignments, attendance, practice, rewards,
  giftShopEnabled, onOpenGiftShop, onOpenBadges, onSelectHomework,
}: StudentDashboardContentProps) => (
  <div className="flex flex-col gap-8 md:gap-10">
    <StudentDashboardHero
      firstName={studentSession.fullName.split(' ').pop() || studentSession.fullName}
      hasReadyAssignment={assignments.hasReadyAssignment}
      attendanceClaimed={attendance.claimedToday}
      attendanceLabel={attendance.badgeText}
      attendanceAvailable={attendance.isAvailable}
      onPrimaryAction={assignments.scrollToPrimaryTarget}
      onAttendance={attendance.open}
    />
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,0.9fr)] xl:items-start">
      <div data-testid="student-dashboard-main-column" className="min-w-0 space-y-9">
        <AssignedWorkSection
          quizzes={assignments.pagedQuizzes}
          isLoading={assignments.isLoading}
          errorMessage={assignments.errorMessage}
          page={assignments.page}
          totalPages={assignments.totalPages}
          reviewingAssignmentId={assignments.reviewingAssignmentId}
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
          onRetry={() => void rewards.retryWeeklyQuests()}
          onClaim={rewards.claimWeeklyQuest}
        />
        <SubjectPracticeGrid
          availableSubjects={practice.availableSubjects}
          comingSoonSubjects={practice.comingSoonSubjects}
          isLoading={practice.isLoading}
          errorMessage={practice.errorMessage}
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
          onToggle={rewards.toggleJourney}
          onRetry={() => void rewards.retryDashboard()}
          onClaimMission={rewards.claimMission}
        />
        <RewardSidebar
          dashboard={rewards.dashboard}
          giftShopEnabled={giftShopEnabled}
          isProcessing={rewards.isLoading}
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
