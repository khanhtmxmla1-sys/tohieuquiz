import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  Bot,
  ClipboardCheck,
  FilePlus2,
  FolderKanban,
  GraduationCap,
  NotebookPen,
  RadioTower,
  UsersRound,
} from 'lucide-react';

export type TeacherDashboardVisualName =
  | 'teacher-welcome'
  | 'ai-quiz-robot'
  | 'manual-quiz'
  | 'classroom'
  | 'test'
  | 'quiz-create'
  | 'assignment'
  | 'live-exam'
  | 'results'
  | 'certificate'
  | 'quiz-management'
  | 'students';

interface TeacherDashboardVisualDefinition {
  src: string;
  width: number;
  height: number;
  maxBytes: number;
  label: string;
}

const illustrationBase = '/illustrations/tohieuquiz/teacher-dashboard-v2';
const iconBase = '/icons/tohieuquiz/dashboard-v2';

export const TEACHER_DASHBOARD_VISUALS: Record<TeacherDashboardVisualName, TeacherDashboardVisualDefinition> = {
  'teacher-welcome': { src: `${illustrationBase}/teacher-welcome.webp`, width: 960, height: 540, maxBytes: 160000, label: 'Giáo viên hướng dẫn học sinh học tập' },
  'ai-quiz-robot': { src: `${illustrationBase}/ai-quiz-robot.webp`, width: 480, height: 360, maxBytes: 90000, label: 'Trợ lý AI tạo đề kiểm tra' },
  'manual-quiz': { src: `${illustrationBase}/manual-quiz.webp`, width: 480, height: 360, maxBytes: 90000, label: 'Sổ tay soạn đề thủ công' },
  classroom: { src: `${iconBase}/classroom.webp`, width: 160, height: 160, maxBytes: 32000, label: 'Lớp học' },
  test: { src: `${iconBase}/quiz-create.webp`, width: 160, height: 160, maxBytes: 32000, label: 'Bài kiểm tra' },
  'quiz-create': { src: `${iconBase}/quiz-create.webp`, width: 160, height: 160, maxBytes: 32000, label: 'Tạo đề' },
  assignment: { src: `${iconBase}/assignment.webp`, width: 160, height: 160, maxBytes: 32000, label: 'Giao bài' },
  'live-exam': { src: `${iconBase}/live-exam.webp`, width: 160, height: 160, maxBytes: 32000, label: 'Thi trực tiếp' },
  results: { src: `${iconBase}/results.webp`, width: 160, height: 160, maxBytes: 32000, label: 'Kết quả học tập' },
  certificate: { src: `${iconBase}/certificate.webp`, width: 160, height: 160, maxBytes: 32000, label: 'Chứng nhận' },
  'quiz-management': { src: `${iconBase}/quiz-management.webp`, width: 160, height: 160, maxBytes: 32000, label: 'Quản lý đề' },
  students: { src: `${iconBase}/students.webp`, width: 160, height: 160, maxBytes: 32000, label: 'Học sinh' },
};

const fallbackIcons: Record<TeacherDashboardVisualName, React.ElementType> = {
  'teacher-welcome': GraduationCap,
  'ai-quiz-robot': Bot,
  'manual-quiz': NotebookPen,
  classroom: GraduationCap,
  test: FilePlus2,
  'quiz-create': FilePlus2,
  assignment: ClipboardCheck,
  'live-exam': RadioTower,
  results: BarChart3,
  certificate: Award,
  'quiz-management': FolderKanban,
  students: UsersRound,
};

export interface TeacherDashboardVisualProps {
  name: TeacherDashboardVisualName;
  alt?: string;
  decorative?: boolean;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'eager' | 'lazy';
}

const TeacherDashboardVisual: React.FC<TeacherDashboardVisualProps> = ({
  name,
  alt,
  decorative = true,
  className,
  style,
  loading = 'lazy',
}) => {
  const [failed, setFailed] = useState(false);
  const definition = TEACHER_DASHBOARD_VISUALS[name];
  const FallbackIcon = fallbackIcons[name];
  const accessibleLabel = alt || definition.label;

  if (failed) {
    return (
      <span
        data-testid="teacher-dashboard-visual-fallback"
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : accessibleLabel}
        aria-hidden={decorative ? true : undefined}
        className={`inline-grid place-items-center text-current ${className || ''}`}
        style={style}
      >
        <FallbackIcon aria-hidden="true" className="h-1/2 w-1/2" />
      </span>
    );
  }

  return (
    <img
      src={definition.src}
      width={definition.width}
      height={definition.height}
      alt={decorative ? '' : accessibleLabel}
      aria-hidden={decorative ? true : undefined}
      loading={loading}
      decoding="async"
      draggable={false}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
};

export default TeacherDashboardVisual;
