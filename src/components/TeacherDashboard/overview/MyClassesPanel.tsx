import React from 'react';
import { ArrowRight } from 'lucide-react';
import TeacherDashboardVisual from './TeacherDashboardVisual';

interface MyClassesPanelProps {
  teacherClass?: string | null;
  isAdmin: boolean;
  studentCount: number;
  onOpenClasses: () => void;
}

const MyClassesPanel: React.FC<MyClassesPanelProps> = ({ teacherClass, isAdmin, studentCount, onOpenClasses }) => {
  const classLabel = isAdmin ? 'Toàn trường' : (teacherClass ? `Lớp ${teacherClass.replace(/^Lớp\s+/i, '')}` : 'Lớp phụ trách');
  return (
    <section aria-labelledby="my-classes-heading" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[var(--dashboard-card-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-700">Không gian giảng dạy</p>
          <h2 id="my-classes-heading" className="mt-1 text-xl font-bold text-slate-900">Lớp học của tôi</h2>
        </div>
        <TeacherDashboardVisual name="classroom" decorative className="size-14 object-contain" />
      </div>
      <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
        <p className="text-sm font-semibold text-slate-900">{classLabel}</p>
        <p className="mt-1 text-sm text-slate-600">{studentCount > 0 ? `${studentCount} học sinh đã tham gia hoạt động` : 'Chưa có dữ liệu học sinh tham gia'}</p>
      </div>
      <button type="button" onClick={onOpenClasses} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
        Mở quản lý lớp <ArrowRight aria-hidden="true" className="size-4" />
      </button>
    </section>
  );
};

export default MyClassesPanel;
