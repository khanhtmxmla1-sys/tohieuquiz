/**
 * Statistics Utility Functions
 * 
 * Provides mathematical calculations for results analysis
 */

import { StudentResult } from '../types';

/**
 * Calculate mean (average) of an array
 */
export const calculateMean = (values: number[]): number => {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
};

/**
 * Calculate median of an array
 */
export const calculateMedian = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Calculate standard deviation
 */
export const calculateStdDev = (values: number[]): number => {
    if (values.length === 0) return 0;
    const mean = calculateMean(values);
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(calculateMean(squareDiffs));
};

/**
 * Calculate comprehensive statistics from results
 */
export interface ResultsStatistics {
    totalResults: number;
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    passRate: number; // Percentage of students with score >= 5
    passCount: number;
    failCount: number;
    scoreDistribution: { range: string; count: number; percentage: number }[];
}

export const calculateResultsStatistics = (results: StudentResult[]): ResultsStatistics => {
    if (results.length === 0) {
        return {
            totalResults: 0,
            mean: 0,
            median: 0,
            stdDev: 0,
            min: 0,
            max: 0,
            passRate: 0,
            passCount: 0,
            failCount: 0,
            scoreDistribution: [],
        };
    }

    const scores = results.map(r => r.score);
    const passCount = scores.filter(s => s >= 5).length;
    const failCount = scores.length - passCount;

    // Score distribution
    const ranges = [
        { label: '0-2', min: 0, max: 2 },
        { label: '3-4', min: 2.01, max: 4 },
        { label: '5-6', min: 4.01, max: 6 },
        { label: '7-8', min: 6.01, max: 8 },
        { label: '9-10', min: 8.01, max: 10 },
    ];

    const scoreDistribution = ranges.map(range => {
        const count = scores.filter(s => s >= range.min && s <= range.max).length;
        return {
            range: range.label,
            count,
            percentage: (count / scores.length) * 100,
        };
    });

    return {
        totalResults: results.length,
        mean: Math.round(calculateMean(scores) * 100) / 100,
        median: Math.round(calculateMedian(scores) * 100) / 100,
        stdDev: Math.round(calculateStdDev(scores) * 100) / 100,
        min: Math.min(...scores),
        max: Math.max(...scores),
        passRate: Math.round((passCount / scores.length) * 100),
        passCount,
        failCount,
        scoreDistribution,
    };
};

export interface QuestionAnalysis {
    questionId: string;
    questionNumber: number;
    questionText: string;
    correctCount: number;
    wrongCount: number;
    skippedCount: number;
    unknownCount: number;
    evaluatedCount: number;
    correctRate: number; // Percentage
    wrongRate: number; // Percentage
    avgTimeSpent?: number; // Seconds
    difficulty: 'easy' | 'medium' | 'hard';
    priority: 'low' | 'medium' | 'high';
    correctAnswerText?: string;
    commonWrongAnswers: Array<{ answer: string; count: number }>;
    affectedStudents: string[];
}

export type AnalysisAttemptMode = 'latest' | 'all';

// Question with additional fields for fallback calculation
export interface QuestionWithCorrect {
    id: string;
    question: string;
    type?: string;
    correctAnswer?: any;
    correctAnswers?: string[];  // For MULTIPLE_SELECT questions
    items?: any[];
    blanks?: any[];
    pairs?: any[];
    options?: any[];
}

const isSkippedAnswer = (value: any): boolean => {
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') {
        const meaningfulKeys = Object.keys(value).filter(key => key !== '__shuffledIds' && key !== 'selectedLeft');
        return meaningfulKeys.length === 0;
    }
    return false;
};

const formatAnswerValue = (value: any): string => {
    if (isSkippedAnswer(value)) return 'Bỏ trống';
    if (Array.isArray(value)) return value.map(formatAnswerValue).join(', ');
    if (typeof value === 'object') {
        return Object.entries(value)
            .filter(([key]) => key !== '__shuffledIds' && key !== 'selectedLeft')
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => `${key}: ${formatAnswerValue(item)}`)
            .join('; ');
    }
    if (typeof value === 'boolean') return value ? 'Đúng' : 'Sai';
    return String(value).trim();
};

const formatAnswerForQuestion = (value: any, question: QuestionWithCorrect): string => {
    const formatted = formatAnswerValue(value);
    if (
        (question.type === 'MCQ' || question.type === 'IMAGE_QUESTION')
        && /^[A-Z]$/i.test(formatted)
        && Array.isArray(question.options)
    ) {
        const optionIndex = formatted.toUpperCase().charCodeAt(0) - 65;
        const option = question.options[optionIndex];
        const optionText = typeof option === 'string'
            ? option
            : option?.text ?? option?.content ?? option?.label;
        if (optionText) return `${formatted.toUpperCase()}. ${String(optionText)}`;
    }
    return formatted;
};

const getCorrectAnswerText = (question: QuestionWithCorrect): string | undefined => {
    const value = question.correctAnswers ?? question.correctAnswer;
    if (!isSkippedAnswer(value)) return formatAnswerForQuestion(value, question);
    if (Array.isArray(question.pairs) && question.pairs.length > 0) {
        return question.pairs.map((pair: any) => `${pair.left} → ${pair.right}`).join('; ');
    }
    if (Array.isArray(question.blanks) && question.blanks.length > 0) {
        const values = question.blanks.map((blank: any) => blank?.correctAnswer ?? blank).filter(Boolean);
        return values.length > 0 ? values.map(formatAnswerValue).join(', ') : undefined;
    }
    return undefined;
};

/**
 * A class analysis should normally count each student once. The latest mode
 * prevents repeat attempts by one student from outweighing the whole class.
 */
export const selectResultsForQuestionAnalysis = (
    results: StudentResult[],
    attemptMode: AnalysisAttemptMode = 'latest'
): StudentResult[] => {
    if (attemptMode === 'all') return [...results];

    const latestByStudent = new Map<string, StudentResult>();
    [...results]
        .sort((left, right) => {
            const timeDifference = new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime();
            return timeDifference || String(right.id).localeCompare(String(left.id));
        })
        .forEach((result) => {
            const key = [result.quizId, result.studentClass, result.studentName]
                .map(value => String(value || '').trim().toLocaleLowerCase('vi-VN'))
                .join('::');
            if (!latestByStudent.has(key)) latestByStudent.set(key, result);
        });

    return Array.from(latestByStudent.values());
};

/**
 * Fallback function to calculate isCorrect from answer and question data
 */
const calculateIsCorrectFallback = (
    answer: any,
    question: QuestionWithCorrect
): boolean | undefined => {
    if (answer === undefined || answer === null) return undefined;

    const { correctAnswer, type, items, blanks, pairs } = question;

    // If answer is new format with isCorrect, use it directly
    if (typeof answer === 'object' && typeof answer.isCorrect === 'boolean') {
        return answer.isCorrect;
    }

    // Old format: answer is just the value (e.g., "A", "100", etc.)
    const selectedAnswer = typeof answer === 'object' ? answer.selectedAnswer : answer;

    // MCQ / IMAGE_QUESTION: Compare letters
    if (type === 'MCQ' || type === 'IMAGE_QUESTION') {
        if (correctAnswer === undefined || correctAnswer === null) return undefined;
        const studentVal = String(selectedAnswer).trim().toUpperCase();
        let correctVal = String(correctAnswer).trim().toUpperCase();
        // Handle "B. Answer text" format -> "B"
        const letterMatch = correctVal.match(/^([A-Z])[.)\s]/);
        if (letterMatch) correctVal = letterMatch[1];
        return studentVal === correctVal;
    }

    // SHORT_ANSWER: Case-insensitive
    if (type === 'SHORT_ANSWER') {
        if (correctAnswer === undefined || correctAnswer === null) return undefined;
        const cleanStudent = String(selectedAnswer || '').trim().replace(/^'/, '').toLowerCase();
        const cleanCorrect = String(correctAnswer || '').trim().replace(/^'/, '').toLowerCase();
        return cleanStudent === cleanCorrect;
    }

    // MULTIPLE_SELECT: Array comparison (use correctAnswers first, fallback to correctAnswer)
    if (type === 'MULTIPLE_SELECT') {
        const correctData = question.correctAnswers || correctAnswer;
        if (correctData === undefined || correctData === null) return undefined;
        try {
            const correctArr = Array.isArray(correctData) ? correctData : JSON.parse(correctData);
            const studentArr = Array.isArray(selectedAnswer) ? selectedAnswer : [];
            return correctArr.length === studentArr.length &&
                correctArr.every((c: string) => studentArr.includes(c));
        } catch { return undefined; }
    }

    // TRUE_FALSE: Check all items
    if (type === 'TRUE_FALSE' && items && Array.isArray(items)) {
        const studentItems = typeof selectedAnswer === 'object' ? selectedAnswer : {};
        return items.every((item: any, i: number) => {
            const itemKey = item.id || `item-${i}`;
            return studentItems[itemKey] === item.isCorrect;
        });
    }

    // MATCHING: Compare pairs
    if (type === 'MATCHING' && pairs && Array.isArray(pairs)) {
        const rawPairs = typeof selectedAnswer === 'object' ? selectedAnswer : {};
        const cleanedPairs: Record<string, string> = {};
        Object.entries(rawPairs || {}).forEach(([key, value]) => {
            if (key === 'selectedLeft' || key === '__shuffledIds') return;
            if (typeof value !== 'string') return;

            const leftMatch = key.match(/^l-(\d+)$/i);
            const rightMatch = value.match(/^r-(\d+)$/i);
            const leftKey = leftMatch ? String(pairs[Number(leftMatch[1])]?.left ?? key) : key;
            const rightVal = rightMatch ? String(pairs[Number(rightMatch[1])]?.right ?? value) : value;
            cleanedPairs[leftKey] = rightVal;
        });

        if (Object.keys(cleanedPairs).length !== pairs.length) return false;
        return pairs.every((pair: any) => cleanedPairs[pair.left] === pair.right);
    }

    // DRAG_DROP: Compare blanks
    if (type === 'DRAG_DROP' && blanks && Array.isArray(blanks)) {
        const studentBlanks = typeof selectedAnswer === 'object' ? selectedAnswer : {};
        const studentValues = Object.values(studentBlanks);
        if (studentValues.length !== blanks.length) return false;
        const sortedKeys = Object.keys(studentBlanks).sort((a, b) => Number(a) - Number(b));
        return sortedKeys.every((key, idx) => {
            const studentWord = String(studentBlanks[key]).trim().toLowerCase();
            const correctWord = String(blanks[idx]).trim().toLowerCase();
            return studentWord === correctWord;
        });
    }

    // DROPDOWN: Compare with blanks correctAnswer
    if (type === 'DROPDOWN' && blanks && Array.isArray(blanks)) {
        const studentDropdowns = typeof selectedAnswer === 'object' ? selectedAnswer : {};
        return blanks.every((blank: any) => {
            const studentVal = String(studentDropdowns[blank.id] || '').trim();
            const correctVal = String(blank.correctAnswer || '').trim();
            return studentVal === correctVal;
        });
    }

    return undefined;
};

export const analyzeQuestionDifficulty = (
    results: StudentResult[],
    questions: QuestionWithCorrect[]
): QuestionAnalysis[] => {
    interface QuestionStats {
        correct: number;
        wrong: number;
        skipped: number;
        unknown: number;
        totalTime: number;
        wrongAnswers: Map<string, number>;
        affectedStudents: Set<string>;
    }

    const questionStats: Record<string, QuestionStats> = {};
    const questionMap = new Map(questions.map(q => [q.id, q]));

    // Initialize stats for each question
    questions.forEach(q => {
        questionStats[q.id] = {
            correct: 0,
            wrong: 0,
            skipped: 0,
            unknown: 0,
            totalTime: 0,
            wrongAnswers: new Map(),
            affectedStudents: new Set(),
        };
    });

    // Aggregate completed result payloads. A result with no matching question
    // IDs is not loaded (or belongs to another quiz), so it must not alter rates.
    results.forEach(result => {
        const answers = result.answers && typeof result.answers === 'object' ? result.answers : {};
        const hasMatchingAnswer = Object.keys(answers).some(questionId => questionMap.has(questionId));
        if (!hasMatchingAnswer) return;

        questions.forEach(question => {
            const stats = questionStats[question.id];
            const hasAnswer = Object.prototype.hasOwnProperty.call(answers, question.id);
            const answer = hasAnswer ? answers[question.id] : undefined;
            const selectedAnswer = answer && typeof answer === 'object' && 'selectedAnswer' in answer
                ? answer.selectedAnswer
                : answer;
            const skipped = !hasAnswer || isSkippedAnswer(selectedAnswer);
            const persistedCorrectness = answer && typeof answer === 'object' && typeof answer.isCorrect === 'boolean'
                ? answer.isCorrect
                : undefined;
            const isCorrect = persistedCorrectness ?? calculateIsCorrectFallback(answer, question);

            if (skipped) {
                stats.skipped++;
                stats.wrong++;
                stats.affectedStudents.add(result.studentName);
                stats.wrongAnswers.set('Bỏ trống', (stats.wrongAnswers.get('Bỏ trống') || 0) + 1);
            } else if (isCorrect === true) {
                stats.correct++;
            } else if (isCorrect === false) {
                stats.wrong++;
                stats.affectedStudents.add(result.studentName);
                const label = formatAnswerForQuestion(selectedAnswer, question);
                stats.wrongAnswers.set(label, (stats.wrongAnswers.get(label) || 0) + 1);
            } else {
                stats.unknown++;
            }

            const timeSpent = answer && typeof answer === 'object' ? Number(answer.timeSpent) : 0;
            if (Number.isFinite(timeSpent) && timeSpent > 0) stats.totalTime += timeSpent;
        });
    });

    // Calculate analysis
    return questions.map((q, questionIndex) => {
        const stats = questionStats[q.id];
        const evaluatedCount = stats.correct + stats.wrong;
        const correctRate = evaluatedCount > 0 ? (stats.correct / evaluatedCount) * 100 : 0;
        const wrongRate = evaluatedCount > 0 ? (stats.wrong / evaluatedCount) * 100 : 0;

        let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
        if (correctRate >= 80) difficulty = 'easy';
        else if (correctRate < 50) difficulty = 'hard';

        let priority: 'low' | 'medium' | 'high' = 'low';
        if (evaluatedCount > 0 && wrongRate >= 50) priority = 'high';
        else if (evaluatedCount > 0 && wrongRate >= 25) priority = 'medium';

        const commonWrongAnswers = Array.from(stats.wrongAnswers.entries())
            .map(([answer, count]) => ({ answer, count }))
            .sort((left, right) => right.count - left.count || left.answer.localeCompare(right.answer, 'vi-VN'))
            .slice(0, 3);

        return {
            questionId: q.id,
            questionNumber: questionIndex + 1,
            questionText: q.question,
            correctCount: stats.correct,
            wrongCount: stats.wrong,
            skippedCount: stats.skipped,
            unknownCount: stats.unknown,
            evaluatedCount,
            correctRate: Math.round(correctRate),
            wrongRate: Math.round(wrongRate),
            avgTimeSpent: evaluatedCount > 0 && stats.totalTime > 0
                ? Math.round(stats.totalTime / evaluatedCount)
                : undefined,
            difficulty,
            priority,
            correctAnswerText: getCorrectAnswerText(q),
            commonWrongAnswers,
            affectedStudents: Array.from(stats.affectedStudents).sort((left, right) => left.localeCompare(right, 'vi-VN')),
        };
    });
};

/**
 * Get top N most missed questions
 */
export const getMostMissedQuestions = (
    analysis: QuestionAnalysis[],
    topN: number = 5
): QuestionAnalysis[] => {
    return [...analysis]
        .sort((a, b) => a.correctRate - b.correctRate)
        .slice(0, topN);
};

/**
 * Filter results by date range
 */
export const filterResultsByDateRange = (
    results: StudentResult[],
    startDate?: Date,
    endDate?: Date
): StudentResult[] => {
    return results.filter(r => {
        const submittedDate = new Date(r.submittedAt);
        if (startDate && submittedDate < startDate) return false;
        if (endDate && submittedDate > endDate) return false;
        return true;
    });
};

/**
 * Filter results by score range
 */
export const filterResultsByScoreRange = (
    results: StudentResult[],
    minScore: number,
    maxScore: number
): StudentResult[] => {
    return results.filter(r => r.score >= minScore && r.score <= maxScore);
};

/**
 * Search results by student name
 */
export const searchResultsByName = (
    results: StudentResult[],
    searchTerm: string
): StudentResult[] => {
    if (!searchTerm.trim()) return results;
    const term = searchTerm.toLowerCase();
    return results.filter(r =>
        String(r.studentName || '').toLowerCase().includes(term)
    );
};
