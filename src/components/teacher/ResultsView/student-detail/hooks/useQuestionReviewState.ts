import { useEffect, useMemo, useState } from 'react';
import {
    filterDisplayQuestions,
    type DisplayQuestion,
    type QuestionFilterMode,
} from '../models/questionModel';

export const useQuestionReviewState = (displayQuestions: DisplayQuestion[]) => {
    const [filterMode, setFilterMode] = useState<QuestionFilterMode>('all');
    const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
    const filteredQuestions = useMemo(
        () => filterDisplayQuestions(displayQuestions, filterMode),
        [displayQuestions, filterMode]
    );

    useEffect(() => {
        setSelectedQuestionIndex(0);
    }, [filterMode]);

    return {
        filterMode,
        setFilterMode,
        selectedQuestionIndex,
        setSelectedQuestionIndex,
        filteredQuestions,
        selectedQuestion: filteredQuestions[selectedQuestionIndex] ?? null,
    };
};
