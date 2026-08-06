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
  cards: 'grid grid-cols-1 gap-3 lg:grid-cols-2',
  compact: 'flex flex-wrap gap-2',
};

interface CreationActionButtonProps {
  layout: QuizCreationActionsProps['layout'];
  title: string;
  description: string;
  visual: 'ai-quiz-robot' | 'manual-quiz';
  tone: 'blue' | 'green';
  onClick: () => void;
  fullWidth?: boolean;
}

const CreationActionButton = ({
  layout,
  title,
  description,
  visual,
  tone,
  onClick,
  fullWidth = false,
}: CreationActionButtonProps) => {
  const isCards = layout === 'cards';
  const toneClasses = tone === 'blue'
    ? {
      card: 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50/60 hover:border-blue-300',
      title: 'text-blue-800',
      button: 'bg-blue-600 text-white group-hover:bg-blue-700',
    }
    : {
      card: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50/60 hover:border-emerald-300',
      title: 'text-emerald-800',
      button: 'bg-emerald-600 text-white group-hover:bg-emerald-700',
    };

  return (
    <button
      type="button"
      aria-label={title}
      onClick={onClick}
      className={`group relative overflow-hidden border text-left transition-[transform,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:scale-[0.99] ${
        isCards
          ? `min-h-44 rounded-2xl p-5 shadow-[var(--dashboard-card-shadow)] hover:-translate-y-0.5 hover:shadow-lg ${toneClasses.card}`
          : 'inline-flex min-h-11 items-center gap-3 rounded-xl border-slate-200 bg-white px-3.5 py-2.5 hover:border-blue-200 hover:bg-blue-50'
      } ${fullWidth ? 'lg:col-span-2' : ''}`}
    >
      {isCards ? (
        <>
          <span className="relative z-10 block max-w-[62%] sm:max-w-[66%]">
            <span className={`block text-lg font-bold ${toneClasses.title}`}>{title}</span>
            <span className="mt-2 block text-sm font-normal leading-6 text-slate-600">{description}</span>
            <span className={`mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${toneClasses.button}`}>
              Bắt đầu
              <ArrowRight aria-hidden="true" className="size-4" />
            </span>
          </span>
          <TeacherDashboardVisual
            name={visual}
            decorative
            className="pointer-events-none absolute -bottom-3 -right-3 h-36 w-44 object-contain object-bottom-right sm:h-40 sm:w-52"
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
        ? 'Tạo nhanh từ chủ đề, nội dung hoặc PDF.'
        : 'Mở công cụ tạo đề hiện tại và bắt đầu soạn bài kiểm tra.'}
      visual="ai-quiz-robot"
      tone="blue"
      onClick={onCreateWithAi}
      fullWidth={!manualQuizWorkspaceEnabled}
    />
    {manualQuizWorkspaceEnabled && (
      <CreationActionButton
        layout={layout}
        title="Soạn đề thủ công"
        description="Tự nhập, sắp xếp và kiểm soát từng câu hỏi."
        visual="manual-quiz"
        tone="green"
        onClick={onCreateManually}
      />
    )}
  </div>
);
