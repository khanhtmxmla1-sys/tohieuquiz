import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import QuestionImportReview from '../src/features/manual-quiz-workspace/import/QuestionImportReview';
import type { QuestionImportResult } from '../src/features/manual-quiz-workspace/import/questionImport.types';

const result: QuestionImportResult = {
    accepted: [{
        id: 'candidate-1',
        sourceRow: 2,
        sourceLabel: 'Dòng 2',
        status: 'accepted',
        issues: [],
        question: {
            id: 'import-1',
            type: QuestionType.MCQ,
            question: '1 + 1 = ?',
            options: ['1', '2'],
            correctAnswer: 'B',
            difficulty: 1,
            points: 1,
        },
    }],
    needsReview: [{
        id: 'candidate-2',
        sourceRow: 3,
        sourceLabel: 'Dòng 3',
        status: 'needsReview',
        issues: ['Thiếu đáp án đúng.'],
        question: {
            id: 'import-2',
            type: QuestionType.SHORT_ANSWER,
            question: 'Thủ đô Việt Nam?',
            correctAnswer: '',
            difficulty: 2,
            points: 1,
        },
    }],
    rejected: [{
        id: 'candidate-3',
        sourceRow: 4,
        sourceLabel: 'Dòng 4',
        status: 'rejected',
        issues: ['Thiếu nội dung câu hỏi.'],
        question: {
            id: 'import-3',
            type: QuestionType.SHORT_ANSWER,
            question: '',
            correctAnswer: '',
            difficulty: 1,
            points: 1,
        },
    }],
};

describe('QuestionImportReview', () => {
    it('selects accepted questions by default and allows reviewing uncertain answers', () => {
        const onImport = vi.fn();
        render(<QuestionImportReview result={result} onImport={onImport} />);

        expect(screen.getByRole('checkbox', { name: 'Chọn Dòng 2' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Chọn Dòng 3' })).not.toBeChecked();
        expect(screen.getByText('Thiếu nội dung câu hỏi.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn Dòng 3' }));
        fireEvent.change(screen.getByLabelText('Đáp án đúng Dòng 3'), { target: { value: 'Hà Nội' } });
        fireEvent.click(screen.getByRole('button', { name: 'Nhập 2 câu đã chọn' }));

        expect(onImport).toHaveBeenCalledTimes(1);
        expect(onImport.mock.calls[0][0]).toHaveLength(2);
        expect(onImport.mock.calls[0][0][1]).toEqual(expect.objectContaining({
            correctAnswer: 'Hà Nội',
        }));
    });

    it('can change the inferred type before importing', () => {
        const onImport = vi.fn();
        render(<QuestionImportReview result={result} onImport={onImport} />);
        fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn Dòng 3' }));
        fireEvent.change(screen.getByLabelText('Loại câu hỏi Dòng 3'), {
            target: { value: QuestionType.MCQ },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Nhập 2 câu đã chọn' }));
        expect(onImport.mock.calls[0][0][1].type).toBe(QuestionType.MCQ);
    });
});
