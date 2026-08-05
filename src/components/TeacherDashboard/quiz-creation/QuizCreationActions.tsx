import React from 'react';
import { ArrowRight, FilePenLine, Sparkles } from 'lucide-react';

export interface QuizCreationActionsProps {
  layout: 'sidebar' | 'cards' | 'compact';
  onCreateWithAi: () => void;
  onCreateManually: () => void;
}

const layoutClassNames: Record<QuizCreationActionsProps['layout'], string> = {
  sidebar: 'flex flex-col gap-2',
  cards: 'grid grid-cols-1 gap-3 sm:grid-cols-2',
  compact: 'flex flex-wrap gap-2',
};

const actionClassNames: Record<QuizCreationActionsProps['layout'], string> = {
  sidebar: 'flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-left',
  cards: 'group flex min-h-32 w-full items-start gap-4 rounded-[14px] border p-4 text-left sm:p-5',
  compact: 'inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-left',
};

interface CreationActionButtonProps {
  layout: QuizCreationActionsProps['layout'];
  title: string;
  description: string;
  tone: 'primary' | 'secondary';
  icon: React.ReactNode;
  onClick: () => void;
}

const CreationActionButton = ({
  layout,
  title,
  description,
  tone,
  icon,
  onClick,
}: CreationActionButtonProps) => {
  const isPrimary = tone === 'primary';
  const toneClassName = isPrimary
    ? 'border-sky-700 bg-sky-700 text-white hover:border-sky-800 hover:bg-sky-800'
    : 'border-slate-200 bg-white text-slate-900 hover:border-sky-300 hover:bg-sky-50';
  const iconClassName = isPrimary
    ? 'bg-white/15 text-white'
    : 'bg-sky-100 text-sky-700';
  const descriptionClassName = isPrimary ? 'text-sky-100' : 'text-slate-600';

  return (
    <button
      type="button"
      aria-label={title}
      onClick={onClick}
      className={`${actionClassNames[layout]} border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2 ${toneClassName}`}
    >
      <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${iconClassName}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold sm:text-base">{title}</span>
        <span className={`mt-1 block text-xs font-normal leading-5 sm:text-sm ${descriptionClassName}`}>
          {description}
        </span>
      </span>
      {layout !== 'sidebar' && (
        <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0" />
      )}
    </button>
  );
};

export const QuizCreationActions = ({
  layout,
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
      title="Tạo đề bằng AI"
      description="Tạo nhanh từ chủ đề, nội dung hoặc PDF."
      tone="primary"
      icon={<Sparkles className="size-5" />}
      onClick={onCreateWithAi}
    />
    <CreationActionButton
      layout={layout}
      title="Soạn đề thủ công"
      description="Tự nhập, sắp xếp và kiểm soát từng câu hỏi."
      tone="secondary"
      icon={<FilePenLine className="size-5" />}
      onClick={onCreateManually}
    />
  </div>
);
