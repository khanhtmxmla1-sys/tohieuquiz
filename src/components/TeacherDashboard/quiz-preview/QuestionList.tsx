import React, { useRef } from 'react';
import type { Quiz, Question } from '../../../types';
import QuestionCard from '../../../features/quiz-editor/components/QuestionCard/QuestionCard';
import type { useSmartDistractors } from '../../../features/quiz-editor/hooks/useSmartDistractors';
import AddQuestionControls from './AddQuestionControls';

interface QuestionListProps {
    quiz: Quiz;
    onUpdateQuestions?: (questions: Question[]) => void;
    onEdit: (question: Question) => void;
    onRegenerate: (question: Question) => void;
    onSaveToBank: (question: Question) => void;
    onStartAdd: (type: Question['type']) => void;
    onOpenTestBank: () => void;
    isGeneratingSingle: string | null;
    distractors: ReturnType<typeof useSmartDistractors>;
}

const QuestionList: React.FC<QuestionListProps> = ({
    quiz,
    onUpdateQuestions,
    onEdit,
    onRegenerate,
    onSaveToBank,
    onStartAdd,
    onOpenTestBank,
    isGeneratingSingle,
    distractors,
}) => {
    const previewContainerRef = useRef<HTMLDivElement>(null);

    return (
        <div ref={previewContainerRef} className="border-t pt-4 max-h-[500px] overflow-y-auto space-y-4 pr-2">
            {quiz.questions.map((question, index) => (
                <QuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    onEdit={() => onEdit(question)}
                    onDelete={(id) => onUpdateQuestions?.(quiz.questions.filter((item) => item.id !== id))}
                    onRegenerate={() => onRegenerate(question)}
                    onSaveToBank={onSaveToBank}
                    isGeneratingSingle={isGeneratingSingle === question.id ? question.id : null}
                    generatingDistractorId={distractors.generatingDistractorId}
                    showDistractorPopover={distractors.showDistractorPopover}
                    distractorCount={distractors.distractorCount}
                    distractorError={distractors.distractorError}
                    onGenerateDistractors={(id, count) => distractors.generateDistractors(id, count, false)}
                    onToggleDistractorPopover={distractors.setShowDistractorPopover}
                    onSetDistractorCount={distractors.setDistractorCount}
                />
            ))}
            {onUpdateQuestions && (
                <AddQuestionControls onStartAdd={onStartAdd} onOpenTestBank={onOpenTestBank} />
            )}
        </div>
    );
};

export default QuestionList;
