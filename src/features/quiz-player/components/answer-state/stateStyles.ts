import type { QuestionProgressState } from '../../../../domain/quiz-progress';

export const progressButtonClasses: Record<QuestionProgressState, string> = {
  empty: 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
  partial: 'border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200',
  complete: 'border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700',
};

export const selectedAnswerClass = 'border-sky-600 bg-sky-100 text-sky-950';
export const unselectedAnswerClass = 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50';
