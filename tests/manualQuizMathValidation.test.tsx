import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';

vi.mock('../src/components/common', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/components/common')>();
    return {
        ...actual,
        NewlineMathText: ({ content }: { content: string }) => <span>{content}</span>,
    };
});
import { analyzeMathText } from '../src/utils/mathText';
import {
    getTeacherMathIssueMessage,
    useMathFieldValidation,
} from '../src/features/manual-quiz-workspace/math-composer/useMathFieldValidation';
import QuestionEditorPane from '../src/features/manual-quiz-workspace/components/QuestionEditorPane';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const ValidationHarness = ({ onTelemetry }: { onTelemetry?: (codes: string[]) => void }) => {
    const [value, setValue] = useState('');
    const result = useMathFieldValidation(value, { onTelemetry });
    return (
        <>
            <label htmlFor="math-field">Công thức</label>
            <input id="math-field" value={value} onChange={(event) => setValue(event.target.value)} />
            <span data-testid="validation-status">{result.status}</span>
            <span data-testid="validation-message">{result.issues[0]?.message ?? ''}</span>
        </>
    );
};

const seed = {
    title: 'Đề Toán',
    classLevel: '4A',
    category: 'toan',
    timeLimit: 20,
    tags: [],
    requireCode: false,
    showOnHome: true,
};

describe('teacher-friendly live math validation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        useManualQuizWorkspaceStore.getState().reset();
    });

    it('reports missing delimiters, braces and unsupported commands with repair guidance', () => {
        expect(analyzeMathText('$\\frac{1}{2')).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'unclosed-delimiter' }),
        ]));
        expect(analyzeMathText('$\\frac{1}{2$')).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'unbalanced-braces' }),
        ]));
        expect(analyzeMathText('$\\unknown{1}$')).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'unsupported-command' }),
        ]));

        expect(getTeacherMathIssueMessage({
            code: 'unsupported-command',
            message: 'technical',
            index: 4,
        })).toMatchObject({
            message: expect.stringContaining('ký hiệu chưa được hỗ trợ'),
            suggestion: expect.stringContaining('bảng Công thức toán'),
            position: 5,
        });
    });

    it('debounces analysis for 150ms and telemetry only receives issue codes', async () => {
        const onTelemetry = vi.fn();
        render(<ValidationHarness onTelemetry={onTelemetry} />);

        fireEvent.change(screen.getByLabelText('Công thức'), {
            target: { value: '$\\unknown{1}$' },
        });
        expect(screen.getByTestId('validation-status')).toHaveTextContent('checking');
        expect(onTelemetry).not.toHaveBeenCalled();

        await act(async () => { vi.advanceTimersByTime(149); });
        expect(screen.getByTestId('validation-status')).toHaveTextContent('checking');
        await act(async () => { vi.advanceTimersByTime(1); });

        expect(screen.getByTestId('validation-status')).toHaveTextContent('invalid');
        expect(screen.getByTestId('validation-message')).toHaveTextContent('ký hiệu chưa được hỗ trợ');
        expect(onTelemetry).toHaveBeenCalledWith(['unsupported-command']);
        expect(JSON.stringify(onTelemetry.mock.calls)).not.toContain('unknown');
    });

    it('marks valid math as ready without warnings', async () => {
        render(<ValidationHarness />);
        fireEvent.change(screen.getByLabelText('Công thức'), {
            target: { value: 'Tính $\\frac{1}{2} + \\sqrt{9}$' },
        });
        await act(async () => { vi.advanceTimersByTime(150); });

        expect(screen.getByTestId('validation-status')).toHaveTextContent('valid');
        expect(screen.getByTestId('validation-message')).toBeEmptyDOMElement();
    });

    it('allows saving an in-progress formula into the draft and shows a non-blocking warning', async () => {
        useManualQuizWorkspaceStore.getState().initializeFromSeed(seed, 'teacher-a');
        useManualQuizWorkspaceStore.getState().addQuestion({
            id: 'q-1',
            type: QuestionType.MCQ,
            question: 'Câu hỏi cũ',
            options: ['1', '2'],
            correctAnswer: 'B',
            difficulty: 1,
            points: 1,
        });
        render(<QuestionEditorPane />);

        const prompt = screen.getByPlaceholderText('Nhập nội dung câu hỏi...');
        fireEvent.change(prompt, { target: { value: 'Tính $\\frac{1}{2' } });
        await act(async () => { vi.advanceTimersByTime(150); });

        expect(screen.getByRole('status', { name: 'Cảnh báo công thức toán' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Lưu câu hỏi' }));

        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.questions[0]).toEqual(
            expect.objectContaining({ question: 'Tính $\\frac{1}{2' }),
        );
    });
});
