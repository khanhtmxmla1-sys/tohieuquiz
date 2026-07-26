import React, { useEffect } from 'react';
import {
  AssignedWorkSkeleton,
  DashboardEmptyState,
  DashboardSectionError,
} from '../../../components/HomePage/student-dashboard';
import { useHomeworkStore } from '../stores/useHomeworkStore';
import type { HomeworkAssignment } from '../types';
import { StudentHomeworkCard } from './StudentHomeworkCard';

interface StudentHomeworkSectionProps {
  studentId: string;
  classId: string;
  onSelectAssignment: (assignment: HomeworkAssignment) => void;
}

export const StudentHomeworkSection: React.FC<StudentHomeworkSectionProps> = ({
  studentId,
  classId,
  onSelectAssignment,
}) => {
  const {
    assignments,
    submissions,
    isLoading,
    error,
    fetchClassAssignments,
    fetchStudentSubmissions,
  } = useHomeworkStore();

  const loadData = async () => {
    await fetchClassAssignments(classId);
    await fetchStudentSubmissions(studentId);
  };

  useEffect(() => {
    if (classId && studentId) {
      loadData();
    }
  }, [classId, studentId, fetchClassAssignments, fetchStudentSubmissions]);

  return (
    <section aria-labelledby="student-homework-title">
      <div className="mb-5">
        <h2 id="student-homework-title" className="text-2xl font-semibold tracking-tight text-[#172033]">
          Bài tập tự luận
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#526174]">
          Luyện viết, nộp bài và xem phản hồi từ giáo viên.
          {assignments.length > 0 ? ` · ${assignments.length} bài tập` : ''}
        </p>
      </div>

      {isLoading && assignments.length === 0 ? <AssignedWorkSkeleton count={3} /> : null}

      {!isLoading && error ? (
        <DashboardSectionError message={error} onRetry={() => void loadData()} />
      ) : null}

      {!isLoading && !error && assignments.length === 0 ? (
        <DashboardEmptyState
          title="Hiện chưa có bài tập tự luận nào."
          description="Thầy cô sẽ giao bài tại đây khi có nhiệm vụ mới cho lớp."
        />
      ) : null}

      {assignments.length > 0 ? (
        <div className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
          {assignments.map((assignment) => (
            <StudentHomeworkCard
              key={assignment.id}
              assignment={assignment}
              submission={submissions.find(
                (submission) => submission.assignment_id === assignment.id,
              )}
              onClick={onSelectAssignment}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
};
