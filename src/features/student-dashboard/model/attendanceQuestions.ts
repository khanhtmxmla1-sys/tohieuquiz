import type { Quiz } from '@/src/types';
import type { AttendanceQuestion } from './attendanceTypes';

export const cleanOptionText = (value: unknown) => String(value ?? '')
  .replace(/^\s*[A-Z]\s*[\.\)\:\-]\s*/i, '')
  .trim();

export const resolveCorrectLabel = (answer: unknown, options: string[]): string | null => {
  const raw = String(answer ?? '').trim();
  if (!raw) return null;
  const direct = raw.toUpperCase().match(/^([A-Z])(?:[\.\)\:\-].*)?$/);
  if (direct) return direct[1];
  if (/^\d+$/.test(raw)) {
    const index = Number(raw);
    if (index >= 0 && index < options.length) return String.fromCharCode(65 + index);
  }
  const normalized = cleanOptionText(raw).toUpperCase();
  const index = options.findIndex(
    (option) => cleanOptionText(option).toUpperCase() === normalized,
  );
  return index >= 0 ? String.fromCharCode(65 + index) : null;
};

const normalizeCategory = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'toan' || normalized.includes('toán')) return 'toan';
  if (normalized === 'tieng-viet' || normalized.includes('việt')) return 'tieng-viet';
  return normalized;
};

export const buildAttendanceQuestionPool = (quizzes: Quiz[]): AttendanceQuestion[] => {
  const preferred = quizzes.filter((quiz) => {
    const value = (quiz as Quiz & { topic?: string }).category
      || (quiz as Quiz & { topic?: string }).topic || '';
    return ['toan', 'tieng-viet'].includes(normalizeCategory(value));
  });
  return (preferred.length > 0 ? preferred : quizzes).flatMap((quiz) =>
    (Array.isArray(quiz.questions) ? quiz.questions : []).flatMap((question, index) => {
      const raw = question as typeof question & {
        type?: string; options?: unknown[]; correctAnswer?: unknown; question?: unknown;
      };
      const options = Array.isArray(raw.options)
        ? raw.options.map((option) => String(option ?? '').trim()).filter(Boolean) : [];
      const correctLabel = resolveCorrectLabel(raw.correctAnswer, options);
      if (String(raw.type || '').toUpperCase() !== 'MCQ' || options.length < 2 || !correctLabel) return [];
      return [{
        id: `${quiz.id}-${question.id || index}`,
        quizTitle: quiz.title || 'Ngân hàng câu hỏi',
        question: String(raw.question || ''), options, correctLabel,
      }];
    }),
  );
};

export const pickAttendanceQuestion = (
  questions: AttendanceQuestion[], currentId?: string,
): AttendanceQuestion | null => {
  if (questions.length === 0) return null;
  const alternatives = currentId ? questions.filter((question) => question.id !== currentId) : [];
  const source = alternatives.length > 0 ? alternatives : questions;
  return source[Math.floor(Math.random() * source.length)];
};
