import React, { useMemo, useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import PublishValidationDrawer from '../src/features/manual-quiz-workspace/components/PublishValidationDrawer';
import PointDistributionDialog from '../src/features/manual-quiz-workspace/components/PointDistributionDialog';
import { validateManualQuiz } from '../src/features/manual-quiz-workspace/validation/manualQuizValidation';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const seed = {
    title: 'Đề Toán lớp 4', classLevel: '4A', category: 'toan', timeLimit: 20,
    tags: [], requireCode: false, showOnHome: true,
};

const addQuestion = (id: string, prompt: string, points: number, answer = 'B') => {
    useManualQuizWorkspaceStore.getState().addQuestion({
        id,
        type: QuestionType.MCQ,
        question: prompt,
        options: ['1', '2'],
        correctAnswer: answer,
        difficulty: 1,
        points,
    });
};

const DrawerHarness = ({ onPublish = vi.fn() }: { onPublish?: () => void }) => {
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const selectQuestion = useManualQuizWorkspaceStore((state) => state.selectQuestion);
    const updateQuiz = useManualQuizWorkspaceStore((state) => state.updateQuiz);
    const setQuestionPoints = useManualQuizWorkspaceStore((state) => state.setQuestionPoints);
    const [showPoints, setShowPoints] = useState(false);
    const [lastPoints, setLastPoints] = useState<Record<string, number> | null>(null);
    const issues = useMemo(() => envelope
        ? validateManualQuiz(envelope.quiz, { targetPoints: envelope.targetPoints })
        : [], [envelope]);

    if (!envelope) return null;
    return (
        <>
            <PublishValidationDrawer
                open
                issues={issues}
                quiz={envelope.quiz}
                targetPoints={envelope.targetPoints}
                onClose={vi.fn()}
                onGoToQuestion={(questionId) => selectQuestion(questionId)}
                onFixPoints={() => setShowPoints(true)}
                onFixTime={() => updateQuiz({ timeLimit: 30 })}
                onPublish={onPublish}
                canUndoPoints={lastPoints !== null}
                onUndoPoints={() => {
                    if (lastPoints) setQuestionPoints(lastPoints);
                    setLastPoints(null);
                }}
            />
            {showPoints && (
                <PointDistributionDialog
                    questions={envelope.quiz.questions}
                    targetPoints={envelope.targetPoints}
                    onClose={() => setShowPoints(false)}
                    onApply={(points) => {
                        setLastPoints(Object.fromEntries(
                            envelope.quiz.questions.map((question) => [question.id, Number(question.points || 0)]),
                        ));
                        setQuestionPoints(points);
                        setShowPoints(false);
                    }}
                />
            )}
        </>
    );
};

describe('PublishValidationDrawer', () => {
    beforeEach(() => {
        useManualQuizWorkspaceStore.getState().reset();
        useManualQuizWorkspaceStore.getState().initializeFromSeed(seed, 'teacher-a');
    });

    it('groups errors, warnings and completed checks and disables publish with errors', () => {
        addQuestion('q-1', '', 0, 'D');
        render(<DrawerHarness />);

        const drawer = screen.getByRole('dialog', { name: 'Kiểm tra trước khi xuất bản' });
        expect(within(drawer).getByRole('heading', { name: /Lỗi cần sửa/ })).toBeInTheDocument();
        expect(within(drawer).getByRole('heading', { name: /Cảnh báo/ })).toBeInTheDocument();
        expect(within(drawer).getByRole('heading', { name: /Đã hoàn tất/ })).toBeInTheDocument();
        expect(within(drawer).getByRole('button', { name: 'Xuất bản đề' })).toBeDisabled();
    });

    it('goes to the affected question from an actionable issue', () => {
        addQuestion('q-1', '', 1);
        addQuestion('q-2', 'Câu hợp lệ', 1);
        render(<DrawerHarness />);

        fireEvent.click(screen.getAllByRole('button', { name: 'Đi đến câu' })[0]);
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-1');
    });

    it('distributes target points exactly and supports undo', () => {
        addQuestion('q-1', 'Câu 1', 1);
        addQuestion('q-2', 'Câu 2', 1);
        addQuestion('q-3', 'Câu 3', 1);
        render(<DrawerHarness />);

        fireEvent.click(screen.getByRole('button', { name: 'Chia đều điểm' }));
        const dialog = screen.getByRole('dialog', { name: 'Chia điểm cho các câu hỏi' });
        expect(within(dialog).getByText('10 điểm')).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Áp dụng chia điểm' }));

        const questions = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions;
        expect(questions.reduce((total, question) => total + Number(question.points), 0)).toBeCloseTo(10, 6);
        expect(screen.getByRole('button', { name: 'Hoàn tác chia điểm' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác chia điểm' }));
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions.map((question) => question.points)).toEqual([1, 1, 1]);
    });

    it('updates time from the quick action and enables publish when only warnings remain', () => {
        addQuestion('q-1', 'Câu 1', 10);
        useManualQuizWorkspaceStore.getState().updateQuiz({ timeLimit: 0 });
        const onPublish = vi.fn();
        render(<DrawerHarness onPublish={onPublish} />);

        expect(screen.getByRole('button', { name: 'Xuất bản đề' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Đặt thời gian 30 phút' }));
        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.timeLimit).toBe(30);
        expect(screen.getByRole('button', { name: 'Xuất bản đề' })).toBeEnabled();
        fireEvent.click(screen.getByRole('button', { name: 'Xuất bản đề' }));
        expect(onPublish).toHaveBeenCalledTimes(1);
    });
});
