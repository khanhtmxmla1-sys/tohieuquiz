import React from 'react';
import type { DisplayQuestion, QuestionFilterMode } from '../models/questionModel';
import { QuestionDetailPanel } from './QuestionDetailPanel';
import { QuestionPalette } from './QuestionPalette';

interface ReviewPanelProps {
    hasAnyData: boolean;
    displayQuestions: DisplayQuestion[];
    filteredQuestions: DisplayQuestion[];
    correctCount: number;
    wrongCount: number;
    filterMode: QuestionFilterMode;
    selectedQuestionIndex: number;
    selectedQuestion: DisplayQuestion | null;
    setFilterMode: (mode: QuestionFilterMode) => void;
    setSelectedQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
}

export const ReviewPanel: React.FC<ReviewPanelProps> = (props) => (
    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
        <QuestionPalette
            hasAnyData={props.hasAnyData}
            displayQuestions={props.displayQuestions}
            filteredQuestions={props.filteredQuestions}
            correctCount={props.correctCount}
            wrongCount={props.wrongCount}
            filterMode={props.filterMode}
            selectedQuestionIndex={props.selectedQuestionIndex}
            onFilterModeChange={props.setFilterMode}
            onQuestionSelect={props.setSelectedQuestionIndex}
        />
        <QuestionDetailPanel
            selectedQuestion={props.selectedQuestion}
            selectedQuestionIndex={props.selectedQuestionIndex}
            filteredQuestionCount={props.filteredQuestions.length}
            displayQuestionCount={props.displayQuestions.length}
            onQuestionSelect={props.setSelectedQuestionIndex}
        />
    </div>
);
