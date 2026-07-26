import { Quiz, QuestionType, StudentResult, Question } from '../../../types';

/**
 * [SENIOR ENGINEERING SERVICE]
 * Centralized scoring logic for all quiz question types.
 * Separated from the UI to ensure testability and maintenance.
 */

export interface ScoringResult {
    score: number;
    correctCount: number;
    totalItems: number;
    details: Array<{
        questionId: string;
        isCorrect: boolean;
        correctAnswer?: any;
    }>;
}

export const calculateStudentScore = (quiz: Quiz, answers: Record<string, any>): ScoringResult => {
    let correctCount = 0;
    let totalItems = 0;
    const details: ScoringResult['details'] = [];

    quiz.questions.forEach(q => {
        let isCorrect = false;
        const qa = q as any;
        let correctAnswer: any = qa.correctAnswer;

        if (q.type === QuestionType.MCQ) {
            totalItems++;
            isCorrect = answers[q.id] === qa.correctAnswer;
        } 
        else if (q.type === QuestionType.SHORT_ANSWER) {
            totalItems++;
            const questionText = qa.question || "";
            const hasInlineBlanks = /\[blank\]|\[_+\]|_{3,}|\[\d+\]/.test(questionText);

            if (hasInlineBlanks) {
                const studentAns = (answers[q.id] as Record<number, string>) || {};
                const correctAnswers = qa.correctAnswers || []; 
                let allCorrect = true;

                for (let i = 0; i < correctAnswers.length; i++) {
                    const studentVal = (studentAns[i] || "").toString().trim().toLowerCase();
                    const correctVal = correctAnswers[i].toString().trim().toLowerCase();
                    const correctOptions = correctVal.split('|').map((s: string) => s.trim());
                    if (!correctOptions.includes(studentVal)) {
                        allCorrect = false;
                        break;
                    }
                }
                isCorrect = allCorrect && correctAnswers.length > 0;
                correctAnswer = correctAnswers;
            } else {
                const studentAns = (answers[q.id] || "").toString().trim().replace(/^'/, '').toLowerCase();
                const correctAns = String(qa.correctAnswer || "").toString().trim().replace(/^'/, '').toLowerCase();
                const correctOptions = correctAns.split('|').map((s: string) => s.trim());
                isCorrect = correctOptions.includes(studentAns);
            }
        } 
        else if (q.type === QuestionType.TRUE_FALSE) {
            totalItems++;
            let allSubItemsCorrect = true;
            (qa.items || []).forEach((item: any, i: number) => {
                const itemKey = item.id || `item-${i}`;
                const studentAns = answers[q.id]?.[itemKey];
                if (studentAns !== item.isCorrect) {
                    allSubItemsCorrect = false;
                }
            });
            isCorrect = allSubItemsCorrect;
        } 
        else if (q.type === QuestionType.MATCHING) {
            totalItems++;
            const correctPairs = qa.pairs || [];
            const rawPairs = answers[q.id] || {};
            const normalizeMatchingMap = (input: any): Record<string, string> => {
                if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
                const mapped: Record<string, string> = {};
                Object.entries(input).forEach(([key, value]) => {
                    if (key === 'selectedLeft' || key === '__shuffledIds') return;
                    if (typeof value !== 'string') return;

                    const leftMatch = key.match(/^l-(\d+)$/i);
                    const rightMatch = value.match(/^r-(\d+)$/i);
                    const leftKey = leftMatch ? String(correctPairs[Number(leftMatch[1])]?.left ?? key) : key;
                    const rightVal = rightMatch ? String(correctPairs[Number(rightMatch[1])]?.right ?? value) : value;
                    mapped[leftKey] = rightVal;
                });
                return mapped;
            };
            const userPairs = normalizeMatchingMap(rawPairs);
            let allMatch = true;
            const actualUserPairsCount = Object.keys(userPairs).length;
            
            if (actualUserPairsCount !== correctPairs.length) {
                allMatch = false;
            } else {
                for (const correctPair of correctPairs) {
                    if (userPairs[correctPair.left] !== correctPair.right) {
                        allMatch = false;
                        break;
                    }
                }
            }
            isCorrect = allMatch;
        } 
        else if (q.type === QuestionType.MULTIPLE_SELECT) {
            totalItems++;
            const studentAns = (answers[q.id] as string[]) || [];
            const rawCorrect = qa.correctAnswer || qa.correctAnswers || "";
            let correctAns: string[] = [];

            if (Array.isArray(rawCorrect)) {
                correctAns = rawCorrect;
            } else if (typeof rawCorrect === 'string') {
                if (rawCorrect.startsWith('[') && rawCorrect.endsWith(']')) {
                    try { correctAns = JSON.parse(rawCorrect); } catch { correctAns = []; }
                } else {
                    correctAns = rawCorrect.split('|').map((s: string) => s.trim()).filter(Boolean);
                }
            }
            isCorrect = studentAns.length === correctAns.length &&
                studentAns.every(val => correctAns.includes(val));
            correctAnswer = correctAns;
        } 
        else if (q.type === QuestionType.DRAG_DROP) {
            totalItems++;
            const studentAns = (answers[q.id] as Record<number, string>) || {};
            let ddText = qa.text || "";
            const ddBlanks = qa.blanks || [];

            if ((!ddText || !ddText.includes('[')) && ddBlanks.length > 0) {
                ddText = ddBlanks.map((_: any, i: number) => `[blank_${i}]`).join(" ");
            }

            const parts = ddText.split(/(\[.*?\])/g);
            const blanks: number[] = [];
            parts.forEach((part: string, idx: number) => {
                if (part.startsWith('[') && part.endsWith(']')) {
                    blanks.push(idx);
                }
            });

            let allMatch = true;
            blanks.forEach((blankIdx, i) => {
                if (studentAns[blankIdx] !== ddBlanks[i]) {
                    allMatch = false;
                }
            });
            isCorrect = allMatch && blanks.length > 0;
            correctAnswer = ddBlanks;
        } 
        else if (q.type === QuestionType.ORDERING) {
            totalItems++;
            const studentAns = answers[q.id];
            let correctOrder = qa.correctOrder || [];
            if (!Array.isArray(correctOrder) || correctOrder.length === 0) {
                if (qa.correctAnswer) {
                    try { correctOrder = JSON.parse(qa.correctAnswer); } catch { }
                }
            }
            const items = qa.items || [];
            if (!Array.isArray(correctOrder) || correctOrder.length === 0) {
                correctOrder = Array.from({ length: items.length }, (_, i) => i);
            }

            if (Array.isArray(studentAns)) {
                isCorrect = studentAns.length === correctOrder.length &&
                    studentAns.every((val, idx) => Number(val) === Number(correctOrder[idx]));
            } else if (typeof studentAns === 'object' && studentAns !== null) {
                let allMatch = true;
                for (let i = 0; i < correctOrder.length; i++) {
                    if (Number(studentAns[correctOrder[i]]) !== i + 1) {
                        allMatch = false;
                        break;
                    }
                }
                isCorrect = allMatch && correctOrder.length > 0;
            }
            correctAnswer = correctOrder;
        } 
        else if (q.type === QuestionType.IMAGE_QUESTION) {
            totalItems++;
            isCorrect = answers[q.id] === qa.correctAnswer;
        } 
        else if (q.type === QuestionType.DROPDOWN) {
            totalItems++;
            const studentAns = (answers[q.id] as Record<string, string>) || {};
            const blanks = qa.blanks || [];
            let allMatch = true;

            for (const blank of blanks) {
                if (studentAns[blank.id] !== blank.correctAnswer) {
                    allMatch = false;
                    break;
                }
            }
            isCorrect = allMatch && blanks.length > 0;
            correctAnswer = blanks.map((b: any) => b.correctAnswer);
        } 
        else if (q.type === QuestionType.UNDERLINE) {
            totalItems++;
            const studentSelection = (answers[q.id] as number[]) || [];
            let correctIndexes = qa.correctWordIndexes;
            
            if (!correctIndexes && qa.correctAnswer) {
                try {
                    const parsed = JSON.parse(qa.correctAnswer);
                    if (Array.isArray(parsed)) correctIndexes = parsed;
                } catch { }
            }
            if (!correctIndexes) correctIndexes = [];

            const studentSorted = [...studentSelection].sort((a, b) => a - b);
            const correctSorted = [...correctIndexes].sort((a, b) => a - b);
            isCorrect = studentSorted.length === correctSorted.length &&
                studentSorted.every((val, idx) => val === correctSorted[idx]);
            correctAnswer = correctSorted;
        } 
        else if (q.type === QuestionType.CATEGORIZATION) {
            totalItems++;
            const studentAns = (answers[q.id] as Record<string, string>) || {};
            const items = qa.items || [];

            let allMatch = true;
            for (const item of items) {
                const studentCatId = studentAns[item.id];
                if (!item.categoryId) {
                    if (studentCatId) { allMatch = false; break; }
                } else {
                    if (studentCatId !== item.categoryId) { allMatch = false; break; }
                }
            }
            isCorrect = allMatch && items.length > 0;
            correctAnswer = items.map((it: any) => ({ id: it.id, categoryId: it.categoryId }));
        } 
        else if (q.type === QuestionType.WORD_SCRAMBLE) {
            totalItems++;
            const letters = qa.letters || [];
            const correctWord = ((qa.correctWord || qa.correctAnswer || '').toString()).toLowerCase().replace(/\s+/g, '');
            const studentSelection = (answers[q.id] as number[]) || [];
            const studentWord = studentSelection.map(idx => letters[idx]).join('').toLowerCase();
            isCorrect = studentWord === correctWord;
        } 
        else if (q.type === QuestionType.RIDDLE) {
            totalItems++;
            const correctAns = (qa.correctAnswer || '').toString().toLowerCase().trim();
            const studentAns = (answers[q.id] || '').toString().toLowerCase().trim();
            isCorrect = studentAns === correctAns;
        } 
        else if (q.type === QuestionType.ERROR_CORRECTION) {
            totalItems++;
            const ecStudent = (answers[q.id] as { wrongWord?: string; correctWord?: string }) || {};
            const ecWrongWord = ((qa.wrongWord || qa.distractors || '').toString()).toString().trim().toLowerCase();
            const ecCorrectWord = ((qa.correctWord || qa.correctAnswer || '').toString()).toString().trim().toLowerCase();
            const sWrong = String(ecStudent.wrongWord || '').trim().toLowerCase();
            const sCorrect = String(ecStudent.correctWord || '').trim().toLowerCase();
            isCorrect = sWrong === ecWrongWord && sCorrect === ecCorrectWord && !!sWrong && !!sCorrect;
        }

        if (isCorrect) correctCount++;
        details.push({ questionId: q.id, isCorrect, correctAnswer });
    });

    const score = totalItems === 0 ? 0 : parseFloat(((correctCount / totalItems) * 10).toFixed(1));
    return { score, correctCount, totalItems, details };
};
