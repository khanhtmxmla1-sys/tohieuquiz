import React from 'react';
import { Library } from 'lucide-react';
import { QuestionType } from '../../../types';
import { QUICK_ADD_TYPES } from './questionTypes';

interface AddQuestionControlsProps {
    onStartAdd: (type: QuestionType) => void;
    onOpenTestBank: () => void;
}

const AddQuestionControls: React.FC<AddQuestionControlsProps> = ({ onStartAdd, onOpenTestBank }) => (
    <div className="mt-4 border-t pt-4">
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-600">➕ Thêm câu hỏi:</span>
            {QUICK_ADD_TYPES.map((button) => (
                <button
                    key={button.type}
                    onClick={() => onStartAdd(button.type)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${button.color}`}
                >
                    {button.label}
                </button>
            ))}
            <button
                onClick={() => onStartAdd(QuestionType.MULTIPLE_SELECT)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
                + Dạng khác
            </button>
            <div className="w-px h-6 bg-gray-300 mx-1 border-r" />
            <button
                onClick={onOpenTestBank}
                className="px-3 py-1.5 rounded-lg text-sm font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-sm"
            >
                <Library className="w-4 h-4" /> Bốc từ kho
            </button>
        </div>
    </div>
);

export default AddQuestionControls;
