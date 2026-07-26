/**
 * RiddleEditor.tsx
 * Editor for RIDDLE question type.
 */
import React from 'react';
import type { RiddleEditorDraft } from '../../../types/quiz-editor.types';
import { FieldRow, RemoveBtn, AddRowBtn, TextInput } from './shared';

interface RiddleEditorProps {
    draft: RiddleEditorDraft;
    onChange: (next: RiddleEditorDraft) => void;
}

const RiddleEditor: React.FC<RiddleEditorProps> = ({ draft, onChange }) => (
    <div className="space-y-4">
        <FieldRow label="Các dòng câu đố">
            <div className="space-y-2">
                {draft.riddleLines.map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="w-6 text-center text-gray-500 text-sm">{i + 1}.</span>
                        <TextInput
                            value={line}
                            onChange={(e) => {
                                const next = [...draft.riddleLines];
                                next[i] = e.target.value;
                                onChange({ ...draft, riddleLines: next });
                            }}
                        />
                        {draft.riddleLines.length > 2 && (
                            <RemoveBtn
                                onClick={() =>
                                    onChange({
                                        ...draft,
                                        riddleLines: draft.riddleLines.filter(
                                            (_, idx) => idx !== i,
                                        ),
                                    })
                                }
                            />
                        )}
                    </div>
                ))}
                {draft.riddleLines.length < 5 && (
                    <AddRowBtn
                        onClick={() =>
                            onChange({ ...draft, riddleLines: [...draft.riddleLines, ''] })
                        }
                        label="Thêm dòng"
                    />
                )}
            </div>
        </FieldRow>

        <FieldRow
            label='Label câu hỏi (VD: "Từ bỏ sắc", "Từ có sắc")'
        >
            <TextInput
                value={draft.answerLabel}
                onChange={(e) => onChange({ ...draft, answerLabel: e.target.value })}
                placeholder="Từ bỏ sắc, Từ để nguyên..."
            />
        </FieldRow>

        <FieldRow label="Đáp án đúng (1 tiếng)">
            <TextInput
                value={draft.correctAnswer}
                onChange={(e) => onChange({ ...draft, correctAnswer: e.target.value })}
                placeholder="Nhập đáp án (1 từ)..."
                className="border-green-300 focus:ring-green-500"
            />
        </FieldRow>
    </div>
);

export default RiddleEditor;
