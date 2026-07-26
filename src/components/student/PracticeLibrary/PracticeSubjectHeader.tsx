import {
  ArrowLeft,
  BookOpen,
  Calculator,
  Earth,
  Languages,
  Monitor,
  type LucideIcon,
} from 'lucide-react';
import type {
  PracticeSubjectDefinition,
  PracticeSubjectIcon,
} from '../../HomePage/student-dashboard/dashboard.types';

interface PracticeSubjectHeaderProps {
  subject: PracticeSubjectDefinition;
  topicCount: number;
  questionCount: number;
  onBack: () => void;
}

const SUBJECT_ICONS = {
  calculator: Calculator,
  'book-open': BookOpen,
  earth: Earth,
  languages: Languages,
  monitor: Monitor,
} satisfies Record<PracticeSubjectIcon, LucideIcon>;

export const PracticeSubjectHeader = ({
  subject,
  topicCount,
  questionCount,
  onBack,
}: PracticeSubjectHeaderProps) => {
  const Icon = SUBJECT_ICONS[subject.icon];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-20 w-full max-w-[1280px] items-center gap-4 px-4 py-3 md:px-8">
        <button
          type="button"
          aria-label="Trở về thư viện"
          onClick={onBack}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Trở về thư viện</span>
          <span className="sm:hidden">Trở về</span>
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${subject.iconSurfaceClass} ${subject.accentClass}`}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-slate-900 md:text-2xl">
              {subject.title}
            </h1>
            <p className="mt-0.5 text-sm font-semibold text-slate-600">
              {topicCount} chuyên đề · {questionCount} câu hỏi
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
