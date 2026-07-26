import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';

const mocks = vi.hoisted(() => ({
    authUsername: 'teacher-a' as string | null,
    editor: {
        editingQuestion: null as any,
        draft: null as any,
        questionTextRef: { current: null },
        openEditor: vi.fn(),
        closeEditor: vi.fn(),
        setDraft: vi.fn(),
        saveEdit: vi.fn(),
        isAddMode: false,
        openAddEditor: vi.fn(),
    },
    smartOptions: null as any,
    smart: {
        generatingDistractorId: null as string | null,
        isGeneratingDistractors: false,
        distractorCount: 3,
        setDistractorCount: vi.fn(),
        showDistractorPopover: null as string | null,
        setShowDistractorPopover: vi.fn(),
        distractorError: null as string | null,
        generateDistractors: vi.fn(),
    },
    generateQuizDocx: vi.fn(),
    saveQuestion: vi.fn(async () => undefined),
    questionCardProps: [] as any[],
}));

vi.mock('../stores/authStore', () => ({
    useAuthStore: () => ({ username: mocks.authUsername }),
}));

vi.mock('../src/utils/docxGenerator', () => ({
    generateQuizDocx: mocks.generateQuizDocx,
}));

vi.mock('../src/services/testBankService', () => ({
    testBankService: {
        saveQuestion: mocks.saveQuestion,
    },
}));

vi.mock('../src/features/quiz-editor/hooks/useQuestionEditor', () => ({
    useQuestionEditor: vi.fn(() => mocks.editor),
}));

vi.mock('../src/features/quiz-editor/hooks/useSmartDistractors', () => ({
    useSmartDistractors: vi.fn((options) => {
        mocks.smartOptions = options;
        return mocks.smart;
    }),
}));

vi.mock('../src/components/common', () => ({
    Card: ({ title, children }: any) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    ),
    Button: ({ children, onClick, loading, variant }: any) => (
        <button type="button" onClick={onClick} disabled={loading} data-variant={variant}>
            {children}
        </button>
    ),
    Modal: ({ isOpen, onClose, title, children }: any) => isOpen ? (
        <div role="dialog" aria-label={title}>
            <button type="button" onClick={onClose}>modal-close</button>
            {children}
        </div>
    ) : null,
}));

vi.mock('../src/features/quiz-editor/components/QuestionCard/QuestionCard', () => ({
    default: (props: any) => {
        mocks.questionCardProps.push(props);
        return (
            <article data-testid={`question-card-${props.question.id}`}>
                <span>{props.question.question || props.question.mainQuestion}</span>
                <span>{props.isGeneratingSingle ? `loading-${props.question.id}` : ''}</span>
                <button type="button" onClick={() => props.onEdit?.()}>edit-{props.question.id}</button>
                <button type="button" onClick={() => props.onDelete?.(props.question.id)}>delete-{props.question.id}</button>
                <button type="button" onClick={() => props.onRegenerate?.()}>regenerate-{props.question.id}</button>
                <button type="button" onClick={() => props.onSaveToBank?.(props.question)}>bank-save-{props.question.id}</button>
                <button type="button" onClick={() => props.onGenerateDistractors?.(props.question.id, 4)}>distractors-{props.question.id}</button>
            </article>
        );
    },
}));

vi.mock('../src/components/TeacherDashboard/WorksheetExportModal', () => ({
    default: ({ quiz, onClose }: any) => (
        <div data-testid="worksheet-modal">
            worksheet-{quiz.title}
            <button type="button" onClick={onClose}>worksheet-close</button>
        </div>
    ),
}));

vi.mock('../src/features/quiz-editor/components/TestBankModal', () => ({
    TestBankModal: ({ isOpen, onClose, onAddQuestion, teacherId }: any) => isOpen ? (
        <div data-testid="test-bank-modal" data-teacher-id={teacherId}>
            <button
                type="button"
                onClick={() => onAddQuestion({ id: 'bank-q', type: QuestionType.SHORT_ANSWER, question: 'Bank question' })}
            >
                bank-add
            </button>
            <button type="button" onClick={onClose}>bank-close</button>
        </div>
    ) : null,
}));

vi.mock('../src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorModal', () => ({
    default: (props: any) => (
        <div data-testid="question-editor-modal">
            <span>{props.editingQuestion.id}</span>
            <button type="button" onClick={props.onSave}>editor-save</button>
            <button type="button" onClick={props.onCancel}>editor-cancel</button>
            <button
                type="button"
                onClick={() => props.onGenerateDistractors(props.editingQuestion.id, 5)}
            >
                editor-distractors
            </button>
        </div>
    ),
}));

import QuizPreview from '../src/components/TeacherDashboard/QuizPreview';

const q1 = {
    id: 'q1',
    type: QuestionType.MCQ,
    question: 'Question one',
    options: ['A1', 'B1'],
    correctAnswer: 'A',
    difficulty: 1,
} as any;

const q2 = {
    id: 'q2',
    type: QuestionType.TRUE_FALSE,
    mainQuestion: 'Question two',
    items: [],
    difficulty: 2,
} as any;

const makeQuiz = (questions = [q1, q2]) => ({
    id: 'quiz-1',
    title: 'Quiz title',
    classLevel: '4',
    category: 'Toán',
    timeLimit: 30,
    createdAt: '2026-07-19T00:00:00.000Z',
    createdBy: 'teacher-a',
    questions,
}) as any;

describe('QuizPreview contracts', () => {
    beforeEach(() => {
        mocks.authUsername = 'teacher-a';
        mocks.editor.editingQuestion = null;
        mocks.editor.draft = null;
        mocks.editor.isAddMode = false;
        mocks.smartOptions = null;
        mocks.smart.generatingDistractorId = null;
        mocks.smart.isGeneratingDistractors = false;
        mocks.smart.distractorCount = 3;
        mocks.smart.showDistractorPopover = null;
        mocks.smart.distractorError = null;
        mocks.questionCardProps.length = 0;
        vi.clearAllMocks();
    });

    it('keeps the legacy QuizPreview import path as a compatibility barrel', async () => {
        const source = await import('../src/components/TeacherDashboard/QuizPreview?raw');
        expect(source.default.trim()).toBe("export { default } from './quiz-preview';");
    });

    it('shows the empty/manual-start state when no quiz exists', () => {
        const onStartManual = vi.fn();
        render(<QuizPreview quiz={null} onSave={vi.fn()} onStartManual={onStartManual} />);

        expect(screen.getByText('Chưa có dữ liệu đề thi')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Mở phòng soạn đề thủ công' }));
        expect(onStartManual).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Tải file Word')).not.toBeInTheDocument();
    });

    it('preserves header metadata and export/save toolbar behavior', () => {
        const quiz = makeQuiz();
        const onSave = vi.fn();
        render(<QuizPreview quiz={quiz} onSave={onSave} />);

        expect(screen.getByText('Quiz title')).toBeInTheDocument();
        expect(screen.getByText('Lớp 4 • 2 câu • 30 phút')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Tải file Word' }));
        expect(mocks.generateQuizDocx).toHaveBeenCalledWith(quiz);

        fireEvent.click(screen.getByRole('button', { name: 'Xuất Vở' }));
        expect(screen.getByTestId('worksheet-modal')).toHaveTextContent('worksheet-Quiz title');
        fireEvent.click(screen.getByRole('button', { name: 'worksheet-close' }));
        expect(screen.queryByTestId('worksheet-modal')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Lưu đề' }));
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('renders each question and wires edit, delete, and list distractor callbacks', () => {
        const quiz = makeQuiz();
        const onUpdateQuestions = vi.fn();
        render(<QuizPreview quiz={quiz} onSave={vi.fn()} onUpdateQuestions={onUpdateQuestions} />);

        expect(screen.getAllByTestId(/question-card-/)).toHaveLength(2);
        fireEvent.click(screen.getByRole('button', { name: 'edit-q1' }));
        expect(mocks.editor.openEditor).toHaveBeenCalledWith(q1);

        fireEvent.click(screen.getByRole('button', { name: 'delete-q1' }));
        expect(onUpdateQuestions).toHaveBeenCalledWith([q2]);

        fireEvent.click(screen.getByRole('button', { name: 'distractors-q1' }));
        expect(mocks.smart.generateDistractors).toHaveBeenCalledWith('q1', 4, false);
    });

    it('replaces only the regenerated question and clears its loading state', async () => {
        const quiz = makeQuiz();
        const regenerated = { ...q1, question: 'Regenerated question' };
        let resolveRegeneration!: (question: any) => void;
        const onRegenerateQuestion = vi.fn(() => new Promise<any>((resolve) => {
            resolveRegeneration = resolve;
        }));
        const onUpdateQuestions = vi.fn();

        render(
            <QuizPreview
                quiz={quiz}
                onSave={vi.fn()}
                onUpdateQuestions={onUpdateQuestions}
                onRegenerateQuestion={onRegenerateQuestion}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'regenerate-q1' }));
        expect(onRegenerateQuestion).toHaveBeenCalledWith(q1);
        expect(await screen.findByText('loading-q1')).toBeInTheDocument();

        resolveRegeneration(regenerated);
        await waitFor(() => expect(onUpdateQuestions).toHaveBeenCalledWith([regenerated, q2]));
        await waitFor(() => expect(screen.queryByText('loading-q1')).not.toBeInTheDocument());
    });

    it('creates a useful starter draft for quick-add question types', () => {
        render(<QuizPreview quiz={makeQuiz()} onSave={vi.fn()} onUpdateQuestions={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Đúng/Sai' }));
        expect(screen.getByRole('dialog', { name: 'Thêm câu hỏi mới' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));

        expect(mocks.editor.openAddEditor).toHaveBeenCalledWith(expect.objectContaining({
            id: expect.stringMatching(/^q-manual-/),
            type: QuestionType.TRUE_FALSE,
            difficulty: 1,
            points: 1,
            mainQuestion: '',
            items: [
                expect.objectContaining({ statement: '', isCorrect: true }),
                expect.objectContaining({ statement: '', isCorrect: false }),
            ],
        }));
    });

    it('supports selecting another type from the add modal before opening the editor', () => {
        render(<QuizPreview quiz={makeQuiz()} onSave={vi.fn()} onUpdateQuestions={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: '+ Dạng khác' }));
        fireEvent.change(screen.getByRole('combobox'), { target: { value: QuestionType.RIDDLE } });
        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));

        expect(mocks.editor.openAddEditor).toHaveBeenCalledWith(expect.objectContaining({
            type: QuestionType.RIDDLE,
            difficulty: 1,
            question: '',
        }));
    });

    it('opens the personal test bank, appends selected questions, and saves cards for the teacher', async () => {
        const quiz = makeQuiz();
        const onUpdateQuestions = vi.fn();
        render(<QuizPreview quiz={quiz} onSave={vi.fn()} onUpdateQuestions={onUpdateQuestions} />);

        fireEvent.click(screen.getByRole('button', { name: 'Bốc từ kho' }));
        expect(screen.getByTestId('test-bank-modal')).toHaveAttribute('data-teacher-id', 'teacher-a');
        fireEvent.click(screen.getByRole('button', { name: 'bank-add' }));
        expect(onUpdateQuestions).toHaveBeenCalledWith([
            q1,
            q2,
            expect.objectContaining({ id: 'bank-q', question: 'Bank question' }),
        ]);

        fireEvent.click(screen.getByRole('button', { name: 'bank-save-q1' }));
        await waitFor(() => expect(mocks.saveQuestion).toHaveBeenCalledWith('teacher-a', q1, [q1.type]));
    });

    it('does not save a question to the bank without an authenticated username', async () => {
        mocks.authUsername = null;
        render(<QuizPreview quiz={makeQuiz()} onSave={vi.fn()} onUpdateQuestions={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'bank-save-q1' }));
        await Promise.resolve();
        expect(mocks.saveQuestion).not.toHaveBeenCalled();
    });

    it('wires editor save/cancel/modal distractors and merges supported draft options', () => {
        mocks.editor.editingQuestion = q1;
        mocks.editor.draft = { ...q1, type: QuestionType.MCQ };
        mocks.editor.isAddMode = true;

        render(<QuizPreview quiz={makeQuiz()} onSave={vi.fn()} onUpdateQuestions={vi.fn()} />);

        expect(screen.getByTestId('question-editor-modal')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'editor-save' }));
        expect(mocks.editor.saveEdit).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'editor-cancel' }));
        expect(mocks.editor.closeEditor).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'editor-distractors' }));
        expect(mocks.smart.generateDistractors).toHaveBeenCalledWith('q1', 5, true);

        mocks.smartOptions.onUpdateEditOptions(['Correct', 'Distractor']);
        expect(mocks.editor.setDraft).toHaveBeenCalledTimes(1);
        const updater = mocks.editor.setDraft.mock.calls[0][0];
        expect(updater({ type: QuestionType.MCQ, options: [] })).toEqual({
            type: QuestionType.MCQ,
            options: ['Correct', 'Distractor'],
        });
        const unsupported = { type: QuestionType.TRUE_FALSE, items: [] };
        expect(updater(unsupported)).toBe(unsupported);
    });
});
