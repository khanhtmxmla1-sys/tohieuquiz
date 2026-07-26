import { AnimatePresence } from 'framer-motion';
import AvatarSelectorModal from '@/src/components/common/AvatarSelectorModal';
import { BadgeGallery } from '@/src/components/gamification/BadgeGallery';
import { JoinLiveExamModal } from '@/src/components/LiveExam/JoinLiveExamModal';
import { HomeworkSubmissionModal } from '@/src/features/homework/components/HomeworkSubmissionModal';
import type { HomeworkAssignment, HomeworkSubmission } from '@/src/features/homework/types';
import type { StudentSession } from '@/src/types/classroom.types';
import { AttendanceModal } from './AttendanceModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { RewardModal } from './RewardModal';
import type { StudentAccountController } from '../hooks/useStudentAccount';
import type { StudentAttendanceController } from '../hooks/useStudentAttendance';
import type { StudentLiveExamController } from '../hooks/useStudentLiveExam';
import type { StudentRewardsController } from '../hooks/useStudentRewards';

interface Props {
  studentSession: StudentSession;
  attendance: StudentAttendanceController;
  account: StudentAccountController;
  rewards: StudentRewardsController;
  liveExam: StudentLiveExamController;
  selectedHomework: HomeworkAssignment | null;
  homeworkSubmission?: HomeworkSubmission;
  isAvatarOpen: boolean;
  isBadgeGalleryOpen: boolean;
  onCloseHomework: () => void;
  onCloseAvatar: () => void;
  onCloseBadgeGallery: () => void;
}

export const StudentDashboardModals = (props: Props) => <>
  <AttendanceModal attendance={props.attendance} />
  <ChangePasswordModal account={props.account} />
  <RewardModal rewards={props.rewards} />
  <AnimatePresence>
    {props.selectedHomework && <HomeworkSubmissionModal assignment={props.selectedHomework}
      submission={props.homeworkSubmission} studentId={props.studentSession.studentId}
      studentName={props.studentSession.fullName} onClose={props.onCloseHomework} />}
  </AnimatePresence>
  <AvatarSelectorModal isOpen={props.isAvatarOpen} onClose={props.onCloseAvatar}
    currentAvatar={props.studentSession.avatar} />
  <BadgeGallery isOpen={props.isBadgeGalleryOpen} onClose={props.onCloseBadgeGallery}
    achievements={props.rewards.dashboard?.achievements || []} />
  <JoinLiveExamModal isOpen={props.liveExam.isJoinModalOpen}
    onClose={props.liveExam.closeJoinModal} onJoinSuccess={props.liveExam.join} />
</>;
