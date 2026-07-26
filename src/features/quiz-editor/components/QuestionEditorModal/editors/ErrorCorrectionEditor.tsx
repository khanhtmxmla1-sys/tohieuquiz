/**
 * ErrorCorrectionEditor.tsx
 * Editor for ERROR_CORRECTION question type.
 */
import React from 'react';
import type { ErrorCorrectionEditorDraft } from '../../../types/quiz-editor.types';
import { FieldRow, MathTextarea, TextInput } from './shared';

interface ErrorCorrectionEditorProps {
    draft: ErrorCorrectionEditorDraft;
    onChange: (next: ErrorCorrectionEditorDraft) => void;
}

const ErrorCorrectionEditor: React.FC<ErrorCorrectionEditorProps> = ({ draft, onChange }) => (
    <div className="space-y-4">
        <FieldRow label="Đoạn văn (có chứa lỗi)">
            <MathTextarea
                value={draft.passage}
                onChange={(e) => onChange({ ...draft, passage: e.target.value })}
                rows={3}
                placeholder="Nhập đoạn văn có lỗi..."
            />
        </FieldRow>

        <FieldRow label="Từ sai (trong đoạn văn)">
            <TextInput
                value={draft.wrongWord}
                onChange={(e) => onChange({ ...draft, wrongWord: e.target.value })}
                placeholder="Từ bị viết sai..."
                className="border-red-300 focus:ring-red-400"
            />
        </FieldRow>

        <FieldRow label="Từ đúng (đáp án)">
            <TextInput
                value={draft.correctWord}
                onChange={(e) => onChange({ ...draft, correctWord: e.target.value })}
                placeholder="Từ đúng..."
                className="border-green-300 focus:ring-green-500"
            />
        </FieldRow>
    </div>
);

export default ErrorCorrectionEditor;
