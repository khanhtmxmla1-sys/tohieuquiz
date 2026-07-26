import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MathTextarea } from '../src/features/quiz-editor/components/QuestionEditorModal/editors/shared';
import MathComposerPanel from '../src/features/manual-quiz-workspace/math-composer/MathComposerPanel';
import { MathComposerProvider } from '../src/features/manual-quiz-workspace/math-composer/useMathComposer';
import {
    loadRecentMathFormulas,
    saveRecentMathFormula,
} from '../src/features/manual-quiz-workspace/math-composer/recentMathFormulaRepository';

vi.mock('../src/components/common', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/components/common')>();
    return {
        ...actual,
        NewlineMathText: ({ content }: { content: string }) => (
            <span data-testid="math-preview">{content}</span>
        ),
    };
});

const ComposerHarness = ({ username = 'teacher-a' }: { username?: string }) => {
    const [value, setValue] = useState('');
    const [open, setOpen] = useState(true);

    return (
        <MathComposerProvider>
            <label htmlFor="question-field">Nội dung câu hỏi</label>
            <MathTextarea
                id="question-field"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                showMathToolbar={false}
            />
            <MathComposerPanel
                ownerUsername={username}
                open={open}
                onClose={() => setOpen(false)}
            />
        </MathComposerProvider>
    );
};

describe('MathComposerPanel', () => {
    beforeEach(() => localStorage.clear());

    it('shows five Vietnamese tool groups with touch-sized buttons', () => {
        render(<ComposerHarness />);

        const tabs = screen.getByRole('tablist', { name: 'Nhóm công thức toán' });
        for (const name of ['Cơ bản', 'Phân số & số học', 'Hình học', 'Ký hiệu', 'Mẫu thường dùng']) {
            expect(within(tabs).getByRole('tab', { name })).toBeInTheDocument();
        }

        const fractionButton = screen.getByRole('button', { name: 'Phân số' });
        expect(fractionButton).toHaveClass('h-11');
        fireEvent.click(screen.getByRole('tab', { name: 'Hình học' }));
        expect(screen.getByRole('button', { name: 'Góc' })).toBeInTheDocument();
    });

    it('builds a fraction visually and inserts it at the active cursor', () => {
        render(<ComposerHarness />);
        const field = screen.getByLabelText('Nội dung câu hỏi') as HTMLTextAreaElement;
        fireEvent.focus(field);
        fireEvent.change(field, { target: { value: 'Tính: ' } });
        field.setSelectionRange(6, 6);
        fireEvent.select(field);

        fireEvent.click(screen.getByRole('button', { name: 'Phân số' }));
        const dialog = screen.getByRole('dialog', { name: 'Tạo công thức Phân số' });
        expect(within(dialog).queryByText('Mã LaTeX')).not.toBeInTheDocument();

        fireEvent.change(within(dialog).getByLabelText('Tử số'), { target: { value: '3' } });
        fireEvent.change(within(dialog).getByLabelText('Mẫu số'), { target: { value: '4' } });
        expect(within(dialog).getByTestId('math-preview')).toHaveTextContent('$\\frac{3}{4}$');
        fireEvent.click(within(dialog).getByRole('button', { name: 'Chèn công thức' }));

        expect(field).toHaveValue('Tính: $\\frac{3}{4}$');
        expect(screen.getByText('Công thức vừa dùng')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Chèn lại Phân số' })).toBeInTheDocument();
    });

    it('keeps raw LaTeX hidden until the advanced toggle is enabled', () => {
        render(<ComposerHarness />);
        fireEvent.focus(screen.getByLabelText('Nội dung câu hỏi'));
        fireEvent.click(screen.getByRole('button', { name: 'Căn bậc hai' }));
        const dialog = screen.getByRole('dialog', { name: 'Tạo công thức Căn bậc hai' });

        expect(within(dialog).queryByLabelText('Mã LaTeX')).not.toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Hiện mã LaTeX nâng cao' }));
        expect(within(dialog).getByLabelText('Mã LaTeX')).toHaveValue('$\\sqrt{}$');
    });

    it('stores at most eight recent formulas per teacher and keeps accounts isolated', () => {
        for (let index = 0; index < 10; index += 1) {
            saveRecentMathFormula('teacher-a', {
                templateId: 'percent',
                values: { value: String(index) },
                label: `Phần trăm ${index}`,
                preview: `$${index}\\%$`,
            });
        }
        saveRecentMathFormula('teacher-b', {
            templateId: 'sqrt',
            values: { radicand: '9' },
            label: 'Căn riêng',
            preview: '$\\sqrt{9}$',
        });

        expect(loadRecentMathFormulas('teacher-a')).toHaveLength(8);
        expect(loadRecentMathFormulas('teacher-a')[0].label).toBe('Phần trăm 9');
        expect(loadRecentMathFormulas('teacher-a').map((item) => item.label)).not.toContain('Căn riêng');
        expect(loadRecentMathFormulas('teacher-b')).toHaveLength(1);
    });
});
