import { BookOpen } from 'lucide-react';
import type { Quiz } from '../../../types';

interface AssignmentQuizFieldProps {
  selectedQuizId: string;
  setSelectedQuizId: (value: string) => void;
  quizzes: Quiz[];
  recommendedQuizIds: Set<string>;
}

export const AssignmentQuizField = ({
  selectedQuizId,
  setSelectedQuizId,
  quizzes,
  recommendedQuizIds,
}: AssignmentQuizFieldProps) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      <BookOpen className="w-3.5 h-3.5 inline mr-1 text-gray-400" /> Chọn đề bài
    </label>
    <select
      value={selectedQuizId}
      onChange={event => setSelectedQuizId(event.target.value)}
      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none appearance-none cursor-pointer text-sm"
    >
      <option value="">-- Chọn đề --</option>
      {quizzes.map(quiz => (
        <option key={quiz.id} value={quiz.id}>
          {recommendedQuizIds.has(quiz.id) ? '[Goi y] ' : ''}{quiz.title} ({quiz.questions?.length || 0} câu)
        </option>
      ))}
    </select>
  </div>
);
