import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
    createManualQuestionDraft,
    QUESTION_TYPE_GROUPS,
    QUICK_ADD_TYPES,
} from '../src/components/TeacherDashboard/quiz-preview/questionTypes';
import QuestionNavigator from '../src/features/manual-quiz-workspace/components/QuestionNavigator';
import QuestionTypePicker from '../src/features/manual-quiz-workspace/components/QuestionTypePicker';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const seed = {
    title: 'Đề Toán', classLevel: '4A', category: 'toan', timeLimit: 20,
    tags: [], requireCode: false, showOnHome: true,
};

describe('QuestionTypePicker', () => {
    beforeEach(() => {
        useManualQuizWorkspaceStore.getState().reset();
        useManualQuizWorkspaceStore.getState().initializeFromSeed(seed, 'teacher-a');
    });

    it('exposes four popular one-click question types', () => {
        expect(QUICK_ADD_TYPES.map((item) => item.type)).toEqual([
            QuestionType.MCQ,
            QuestionType.TRUE_FALSE,
            QuestionType.SHORT_ANSWER,
            QuestionType.MATCHING,
        ]);
        expect(QUICK_ADD_TYPES.every((item) => item.description.length > 10)).toBe(true);
    });

    it('groups all supported editor types with descriptions and examples', () => {
        render(<QuestionTypePicker open onClose={() => undefined} onSelect={() => undefined} />);
        const dialog = screen.getByRole('dialog', { name: 'Chọn dạng câu hỏi' });

        for (const group of ['Phổ biến', 'Tương tác', 'Ngôn ngữ', 'Hình ảnh']) {
            expect(within(dialog).getByRole('heading', { name: group })).toBeInTheDocument();
        }
        expect(within(dialog).getAllByRole('button', { name: /^Thêm dạng/ })).toHaveLength(14);
        expect(within(dialog).getByText('Học sinh chọn một đáp án đúng.')).toBeInTheDocument();
        expect(within(dialog).getAllByText(/Ví dụ:/)).toHaveLength(14);
        expect(QUESTION_TYPE_GROUPS.flatMap((group) => group.items).some(
            (item) => item.type === QuestionType.GEOMETRY,
        )).toBe(false);
    });

    it('selects a type immediately without a second confirmation step', () => {
        const selected: QuestionType[] = [];
        render(
            <QuestionTypePicker
                open
                onClose={() => undefined}
                onSelect={(type) => selected.push(type)}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Thêm dạng Sắp xếp thứ tự' }));
        expect(selected).toEqual([QuestionType.ORDERING]);
        expect(screen.queryByRole('button', { name: 'Tiếp tục' })).not.toBeInTheDocument();
    });

    it('creates useful starter rows for every supported type', () => {
        for (const group of QUESTION_TYPE_GROUPS) {
            for (const item of group.items) {
                const draft = createManualQuestionDraft(item.type) as any;
                expect(draft.id).toMatch(/^q-manual-/);
                expect(draft.type).toBe(item.type);
                expect(draft.difficulty).toBe(1);
                expect(draft.points).toBe(1);

                if ('options' in draft) expect(draft.options.length).toBeGreaterThanOrEqual(2);
                if (item.type === QuestionType.TRUE_FALSE) expect(draft.items).toHaveLength(2);
                if (item.type === QuestionType.MATCHING) expect(draft.pairs).toHaveLength(2);
                if (item.type === QuestionType.ORDERING) {
                    expect(draft.items).toHaveLength(2);
                    expect(draft.correctOrder).toEqual([0, 1]);
                }
                if (item.type === QuestionType.DROPDOWN) expect(draft.blanks).toHaveLength(1);
                if (item.type === QuestionType.CATEGORIZATION) {
                    expect(draft.categories).toHaveLength(2);
                    expect(draft.items).toHaveLength(2);
                }
            }
        }
    });

    it('adds popular questions in one click and opens the new question editor', () => {
        render(<QuestionNavigator />);

        fireEvent.click(screen.getByRole('button', { name: 'Thêm nhanh Trắc nghiệm' }));
        const envelope = useManualQuizWorkspaceStore.getState().envelope!;
        expect(envelope.quiz.questions).toHaveLength(1);
        expect(envelope.quiz.questions[0]).toEqual(expect.objectContaining({
            type: QuestionType.MCQ,
            options: ['', '', '', ''],
            points: 1,
        }));
        expect(envelope.selectedQuestionId).toBe(envelope.quiz.questions[0].id);
    });

    it('opens grouped picker for other types and closes after selection', () => {
        render(<QuestionNavigator />);
        fireEvent.click(screen.getByRole('button', { name: 'Thêm dạng khác' }));
        const dialog = screen.getByRole('dialog', { name: 'Chọn dạng câu hỏi' });

        fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm dạng Phân loại vào nhóm' }));

        expect(screen.queryByRole('dialog', { name: 'Chọn dạng câu hỏi' })).not.toBeInTheDocument();
        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.questions[0].type)
            .toBe(QuestionType.CATEGORIZATION);
    });
});
