import React from 'react';
import { BookOpen, FileDown, Save } from 'lucide-react';
import type { Quiz } from '../../../types';
import { Button } from '../../common';
import { generateQuizDocx } from '../../../utils/docxGenerator';

interface QuizPreviewToolbarProps {
    quiz: Quiz;
    onSave: () => void;
    isSaving: boolean;
    onOpenWorksheet: () => void;
}

const QuizPreviewToolbar: React.FC<QuizPreviewToolbarProps> = ({
    quiz,
    onSave,
    isSaving,
    onOpenWorksheet,
}) => (
    <div className="flex items-center justify-between">
        <div>
            <h3 className="font-bold text-lg">{quiz.title}</h3>
            <p className="text-sm text-gray-500">
                Lớp {quiz.classLevel} • {quiz.questions.length} câu • {quiz.timeLimit} phút
            </p>
        </div>
        <div className="flex gap-2 flex-wrap">
            <Button onClick={() => generateQuizDocx(quiz)} variant="secondary" icon={<FileDown className="w-4 h-4" />}>
                Tải file Word
            </Button>
            <button
                onClick={onOpenWorksheet}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-sm hover:shadow-md transition-all"
                title="Xuất Vở Bài Tập để in"
            >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Xuất Vở</span>
            </button>
            <Button onClick={onSave} variant="success" loading={isSaving} icon={<Save className="w-4 h-4" />}>
                {isSaving ? 'Đang lưu...' : 'Lưu đề'}
            </Button>
        </div>
    </div>
);

export default QuizPreviewToolbar;
