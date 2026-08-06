import React from 'react';
import { ArrowRight } from 'lucide-react';
import TeacherDashboardVisual from '../overview/TeacherDashboardVisual';

export interface QuizCreationActionsProps {
  layout: 'cards' | 'compact';
  manualQuizWorkspaceEnabled?: boolean;
  onCreateWithAi: () => void;
  onCreateManually: () => void;
}

const layoutClassNames: Record<QuizCreationActionsProps['layout'], string> = {
  cards: 'grid grid-cols-1 gap-4 lg:grid-cols-2',
  compact: 'flex flex-wrap gap-2',
};

interface CreationActionButtonProps {
  layout: QuizCreationActionsProps['layout'];
  title: string;
  description: string;
  actionLabel: string;
  visual: 'ai-quiz-robot' | 'manual-quiz';
  tone: 'blue' | 'green';
  onClick: () => void;
  fullWidth?: boolean;
}

const CreationActionButton = ({
  layout,
  title,
  description,
  actionLabel,
  visual,
  tone,
  onClick,
  fullWidth = false,
}: CreationActionButtonProps) => {
  const isCards = layout === 'cards';
  const toneClasses = tone === 'blue'
    ? {
      card: 'border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50/70 hover:border-blue-300',
      title: 'text-blue-800',
      button: 'bg-blue-600 text-white group-hover:bg-blue-700',
      orb: 'bg-blue-200/50',
    }
    : {
      card: 'border-emerald-100 bg-gradient-to-br from-white via-emerald-50/60 to-cyan-50/70 hover:border-emerald-300',
      title: 'text-emerald-800',
      button: 'bg-emerald-600 text-white group-hover:bg-emerald-700',
      orb: 'bg-emerald-200/50',
    };

  return (
    <button
      type="button"
      aria-label={title}
      onClick={onClick}
      className={`group relative overflow-hidden border text-left transition-[transform,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:scale-[0.99] ${
        isCards
          ? `min-h-48 rounded-2xl p-5 shadow-[var(--dashboard-card-shadow)] hover:-translate-y-0.5 hover:shadow-lg sm:p-6 ${toneClasses.card}`
          : 'inline-flex min-h-11 items-center gap-3 rounded-xl border-slate-200 bg-white px-3.5 py-2.5 hover:border-blue-200 hover:bg-blue-50'
      } ${fullWidth ? 'lg:col-span-2' : ''}`}
    >
      {isCards ? (
        <>
          <span aria-hidden="true" className={`absolute -bottom-14 -right-10 size-44 rounded-full ${toneClasses.orb}`} />
          <span className="relative z-10 block max-w-[64%] sm:max-w-[68%]">
            <span className={`block text-lg font-bold sm:text-xl ${toneClasses.title}`}>{title}</span>
            <span className="mt-2 block text-sm font-normal leading-6 text-slate-600">{description}</span>
            <span className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${toneClasses.button}`}>
              {actionLabel}
              <ArrowRight aria-hidden="true" className="size-4" />
            </span>
          </span>
          <TeacherDashboardVisual
            name={visual}
            decorative
            loading="eager"
            className="pointer-events-none absolute -bottom-2 -right-2 h-36 w-40 object-contain object-bottom-right sm:h-44 sm:w-52"
          />
        </>
      ) : (
        <>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50">
            <TeacherDashboardVisual name={visual} decorative className="size-8 object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">{title}</span>
            <span className="hidden text-xs font-normal text-slate-500 sm:block">{description}</span>
          </span>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
        </>
      )}
    </button>
  );
};

export const QuizCreationActions = ({
  layout,
  manualQuizWorkspaceEnabled = true,
  onCreateWithAi,
  onCreateManually,
}: QuizCreationActionsProps) => (
  <div
    data-testid="quiz-creation-actions"
    data-layout={layout}
    className={layoutClassNames[layout]}
  >
    <CreationActionButton
      layout={layout}
      title={manualQuizWorkspaceEnabled ? 'Tạo đề bằng AI' : 'Tạo đề mới'}
      description={manualQuizWorkspaceEnabled
        ? 'Tạo nhanh đề kiểm tra, câu hỏi và gợi ý đáp án theo từng khối lớp.'
        : 'Mở công cụ tạo đề hiện tại và bắt đầu soạn bài kiểm tra.'}
      actionLabel={manualQuizWorkspaceEnabled ? 'Tạo ngay' : 'Bắt đầu'}
      visual="ai-quiz-robot"
      tone="blue"
      onClick={onCreateWithAi}
      fullWidth={!manualQuizWorkspaceEnabled}
    />
    {manualQuizWorkspaceEnabled && (
      <CreationActionButton
        layout={layout}
        title="Soạn đề thủ công"
        description="Tự xây dựng đề kiểm tra với trình soạn thảo quen thuộc và kiểm soát từng câu hỏi."
        actionLabel="Soạn ngay"
        visual="manual-quiz"
        tone="green"
        onClick={onCreateManually}
      />
    )}
  </div>
);
