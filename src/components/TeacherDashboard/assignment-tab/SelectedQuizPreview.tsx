import { BookOpen } from 'lucide-react';
import type { Quiz } from '../../../types';

export const SelectedQuizPreview = ({ quiz }: { quiz?: Quiz }) => {
  if (!quiz) return null;
  return (
    <div className="bg-orange-50/50 rounded-xl p-3 mb-4 flex items-center gap-3">
      <BookOpen className="w-4 h-4 text-orange-400 flex-shrink-0" />
      <div className="text-sm">
        <span className="font-medium text-gray-700">{quiz.title}</span>
        <span className="text-gray-400 ml-2">
          • {quiz.questions?.length || 0} câu • {quiz.timeLimit} phút
        </span>
      </div>
    </div>
  );
};
