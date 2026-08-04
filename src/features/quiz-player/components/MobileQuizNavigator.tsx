import React, { useCallback, useId, useRef, useState } from 'react';
import { ListChecks, X } from 'lucide-react';
import type { Question } from '../../../types';
import type { QuestionProgressResult, QuestionProgressState } from '../../../domain/quiz-progress';
import { useDialogFocus } from '../../../hooks/useDialogFocus';
import type { QuizPageChangeHandler } from '../hooks/useQuizPageNavigation';
import { QuestionProgressButton, progressButtonClasses } from './answer-state';

interface MobileQuizNavigatorProps {
  questions: Question[];
  progressByQuestionId: Record<string, QuestionProgressResult>;
  activeQuestionId: string | null;
  questionsPerPage: number;
  onPageChange: QuizPageChangeHandler;
}

const EMPTY_PROGRESS: QuestionProgressResult = {
  state: 'empty',
  hasInteraction: false,
  completedParts: 0,
  requiredParts: 1,
};

const LEGEND_ITEMS: Array<{ state: QuestionProgressState; label: string }> = [
  { state: 'empty', label: 'Chưa trả lời' },
  { state: 'partial', label: 'Đang làm' },
  { state: 'complete', label: 'Đã hoàn thành' },
];

const MobileQuizNavigator: React.FC<MobileQuizNavigatorProps> = ({
  questions,
  progressByQuestionId,
  activeQuestionId,
  questionsPerPage,
  onPageChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = useCallback(() => setIsOpen(false), []);

  useDialogFocus({
    isOpen,
    dialogRef,
    initialFocusRef: closeRef,
    onClose: close,
  });

  const selectQuestion = (question: Question, index: number) => {
    setIsOpen(false);
    onPageChange(Math.floor(index / questionsPerPage) + 1, question.id);
  };

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        aria-label="Mở danh sách câu hỏi"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-sky-600 px-4 text-sm font-semibold text-white shadow-lg shadow-sky-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 lg:hidden"
      >
        <ListChecks className="h-5 w-5" aria-hidden="true" />
        Danh sách câu
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            aria-hidden="true"
            onClick={close}
            className="absolute inset-0 bg-slate-950/55"
          />
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[22px] bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-slate-900">Danh sách câu hỏi</h2>
                <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                  Chọn số câu để chuyển nhanh đến vị trí cần làm.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label="Đóng danh sách câu hỏi"
                onClick={close}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-6 gap-2 sm:grid-cols-8">
              {questions.map((question, index) => {
                const progress = progressByQuestionId[question.id] ?? EMPTY_PROGRESS;
                return (
                  <QuestionProgressButton
                    key={question.id}
                    questionNumber={index + 1}
                    state={progress.state}
                    active={question.id === activeQuestionId}
                    onClick={() => selectQuestion(question, index)}
                  />
                );
              })}
            </div>

            <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4 text-xs text-slate-600 sm:grid-cols-3">
              {LEGEND_ITEMS.map(({ state, label }) => (
                <div key={state} className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-[3px] border ${progressButtonClasses[state]}`} aria-hidden="true" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default MobileQuizNavigator;
