import React, { useRef } from 'react';
import { Save, X } from 'lucide-react';
import { QuestionType } from '../../../../types';
import type { Question } from '../../../../types';
import type { AnyEditorDraft, Difficulty } from '../../types/quiz-editor.types';
import { getTypeLabel } from '../../utils/questionHelpers';
import { MCQEditor, MultipleSelectEditor } from './editors/MCQEditor';
import TrueFalseEditor from './editors/TrueFalseEditor';
import MatchingEditor from './editors/MatchingEditor';
import DragDropEditor from './editors/DragDropEditor';
import OrderingEditor from './editors/OrderingEditor';
import ImageQuestionEditor from './editors/ImageQuestionEditor';
import DropdownEditor from './editors/DropdownEditor';
import UnderlineEditor from './editors/UnderlineEditor';
import CategorizationEditor from './editors/CategorizationEditor';
import WordScrambleEditor from './editors/WordScrambleEditor';
import RiddleEditor from './editors/RiddleEditor';
import ErrorCorrectionEditor from './editors/ErrorCorrectionEditor';
import { FieldRow, MathTextarea, TextInput } from './editors/shared';
import MediaDropzone from '../../../manual-quiz-workspace/components/MediaDropzone';

export interface QuestionEditorFormProps {
    editingQuestion: Question;
    draft: AnyEditorDraft;
    onDraftChange: (updater: (prev: AnyEditorDraft) => AnyEditorDraft) => void;
    onSave: () => void;
    onCancel?: () => void;
    mode: 'inline' | 'modal';
    isGeneratingDistractors?: boolean;
    distractorCount?: number;
    distractorError?: string | null;
    onSetDistractorCount?: (n: number) => void;
    onGenerateDistractors?: (questionId: string, count: number, inEditMode: boolean) => void;
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
    { value: 1, label: 'Dễ' },
    { value: 2, label: 'Trung bình' },
    { value: 3, label: 'Khó' },
];

const SharedHeaderEditor: React.FC<{
    draft: AnyEditorDraft;
    onDraftChange: (updater: (prev: AnyEditorDraft) => AnyEditorDraft) => void;
}> = ({ draft, onDraftChange }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const questionField = draft.type === QuestionType.TRUE_FALSE ? 'mainQuestion' : 'question';
    const questionValue = draft.type === QuestionType.TRUE_FALSE
        ? (draft as { mainQuestion: string }).mainQuestion
        : (draft as { question: string }).question;

    return (
        <div className="space-y-4">
            <FieldRow label="Nội dung câu hỏi">
                <MathTextarea
                    ref={textareaRef}
                    value={questionValue}
                    onChange={(event) => onDraftChange((previous) => ({
                        ...previous,
                        [questionField]: event.target.value,
                    }))}
                    rows={4}
                    className="resize-y"
                    placeholder="Nhập nội dung câu hỏi..."
                />
            </FieldRow>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <FieldRow label="Độ khó">
                    <div className="flex flex-wrap gap-2">
                        {DIFFICULTIES.map(({ value, label }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => onDraftChange((previous) => ({
                                    ...previous,
                                    difficulty: value,
                                }))}
                                className={`min-h-10 rounded-full border px-4 text-xs font-semibold transition ${
                                    draft.difficulty === value
                                        ? 'border-sky-500 bg-sky-500 text-white'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-sky-400'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </FieldRow>

                {draft.type !== QuestionType.TRUE_FALSE
                    && draft.type !== QuestionType.MATCHING
                    && draft.type !== QuestionType.IMAGE_QUESTION
                    && draft.type !== QuestionType.DROPDOWN && (
                    <div className="min-w-0 flex-1">
                        <FieldRow label="Ảnh đính kèm (tùy chọn)">
                            <MediaDropzone
                                label="Ảnh đính kèm"
                                value={(draft as { image?: string }).image ?? ''}
                                altText={(draft as { imageAlt?: string }).imageAlt ?? ''}
                                onChange={(image) => onDraftChange((previous) => ({ ...previous, image }))}
                                onAltTextChange={(imageAlt) => onDraftChange((previous) => ({ ...previous, imageAlt }))}
                            />
                        </FieldRow>
                    </div>
                )}
            </div>
        </div>
    );
};

interface TypeEditorDispatcherProps {
    draft: AnyEditorDraft;
    onDraftChange: (updater: (prev: AnyEditorDraft) => AnyEditorDraft) => void;
    isGeneratingDistractors: boolean;
    distractorCount: number;
    distractorError: string | null;
    onSetDistractorCount?: (n: number) => void;
    onGenerateDistractors?: () => void;
}

const TypeEditorDispatcher: React.FC<TypeEditorDispatcherProps> = ({
    draft,
    onDraftChange,
    isGeneratingDistractors,
    distractorCount,
    distractorError,
    onSetDistractorCount,
    onGenerateDistractors,
}) => {
    switch (draft.type) {
        case QuestionType.MCQ:
            return (
                <MCQEditor
                    draft={draft}
                    onChange={(next) => onDraftChange(() => next)}
                    isGeneratingDistractors={isGeneratingDistractors}
                    distractorCount={distractorCount}
                    distractorError={distractorError}
                    onSetDistractorCount={onSetDistractorCount}
                    onGenerateDistractors={onGenerateDistractors}
                />
            );
        case QuestionType.MULTIPLE_SELECT:
            return (
                <MultipleSelectEditor
                    draft={draft}
                    onChange={(next) => onDraftChange(() => next)}
                    isGeneratingDistractors={isGeneratingDistractors}
                    distractorCount={distractorCount}
                    distractorError={distractorError}
                    onSetDistractorCount={onSetDistractorCount}
                    onGenerateDistractors={onGenerateDistractors}
                />
            );
        case QuestionType.TRUE_FALSE:
            return <TrueFalseEditor draft={draft} onChange={(next) => onDraftChange(() => next)} />;
        case QuestionType.SHORT_ANSWER:
            return (
                <FieldRow label="Đáp án đúng">
                    <TextInput
                        value={draft.correctAnswer}
                        onChange={(event) => onDraftChange((previous) => ({
                            ...previous,
                            correctAnswer: event.target.value,
                        }))}
                        placeholder="Nhập đáp án"
                    />
                </FieldRow>
            );
        case QuestionType.MATCHING:
            return <MatchingEditor draft={draft} onChange={(next) => onDraftChange(() => next)} />;
        case QuestionType.DRAG_DROP:
            return <DragDropEditor draft={draft} onChange={(next) => onDraftChange(() => next)} />;
        case QuestionType.ORDERING:
            return <OrderingEditor draft={draft} onChange={(next) => onDraftChange(() => next)} />;
        case QuestionType.IMAGE_QUESTION:
            return <ImageQuestionEditor draft={draft} onChange={(next) => onDraftChange(() => next)} />;
        case QuestionType.DROPDOWN:
            return <DropdownEditor draft={draft} onChange={(next) => onDraftChange(() => next)} />;
        case QuestionType.UNDERLINE:
            return <UnderlineEditor draft={draft} onChange={(next) => onDraftChange(() => next)} />;
        case QuestionType.CATEGORIZATION:
            return <CategorizationEditor draft={draft} onChange={(next) => onDraftChange(() => next)} />;
        case QuestionType.WORD_SCRAMBLE:
            return <WordScrambleEditor draft={draft} onChange={(next) => onDraftChange(() => next)} />;
        case QuestionType.RIDDLE:
            return <RiddleEditor draft={draft} onChange={(next) => onDraftChange(() => next)} />;
        case QuestionType.ERROR_CORRECTION:
            return <ErrorCorrectionEditor draft={draft} onChange={(next) => onDraftChange(() => next)} />;
        default:
            return (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Dạng câu hỏi này chưa có trình soạn phù hợp.
                </p>
            );
    }
};

const QuestionEditorForm: React.FC<QuestionEditorFormProps> = ({
    editingQuestion,
    draft,
    onDraftChange,
    onSave,
    onCancel,
    mode,
    isGeneratingDistractors = false,
    distractorCount = 3,
    distractorError = null,
    onSetDistractorCount,
    onGenerateDistractors,
}) => {
    const typeLabel = getTypeLabel(editingQuestion.type);
    const handleGenerateDistractors = onGenerateDistractors
        ? () => onGenerateDistractors(editingQuestion.id, distractorCount, true)
        : undefined;
    const isInline = mode === 'inline';

    return (
        <section
            data-testid="question-editor-form"
            data-mode={mode}
            className={`flex min-h-0 flex-col bg-white ${isInline ? 'rounded-2xl border border-slate-200' : 'h-full'}`}
        >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 lg:px-6">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                        {isInline ? 'Soạn câu hỏi' : 'Sửa câu hỏi'}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                        Loại: <span className="font-semibold text-sky-700">{typeLabel}</span>
                    </p>
                </div>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            <div className={`min-h-0 flex-1 space-y-6 px-5 py-5 lg:px-6 ${isInline ? '' : 'overflow-y-auto'}`}>
                <SharedHeaderEditor draft={draft} onDraftChange={onDraftChange} />
                <div className="border-t border-slate-100" />
                <TypeEditorDispatcher
                    draft={draft}
                    onDraftChange={onDraftChange}
                    isGeneratingDistractors={isGeneratingDistractors}
                    distractorCount={distractorCount}
                    distractorError={distractorError}
                    onSetDistractorCount={onSetDistractorCount}
                    onGenerateDistractors={handleGenerateDistractors}
                />
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 lg:px-6">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="min-h-10 rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                        Huỷ
                    </button>
                )}
                <button
                    type="button"
                    onClick={onSave}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700"
                >
                    <Save className="h-4 w-4" />
                    {isInline ? 'Lưu câu hỏi' : 'Lưu thay đổi'}
                </button>
            </div>
        </section>
    );
};

export default React.memo(QuestionEditorForm);
