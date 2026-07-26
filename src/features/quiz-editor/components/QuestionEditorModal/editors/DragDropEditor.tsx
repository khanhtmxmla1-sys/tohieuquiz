/**
 * DragDropEditor.tsx
 * Editor for DRAG_DROP question type.
 */
import React from 'react';
import type { DragDropEditorDraft } from '../../../types/quiz-editor.types';
import { FieldRow, RemoveBtn, AddRowBtn, MathTextarea, TextInput } from './shared';

interface DragDropEditorProps {
    draft: DragDropEditorDraft;
    onChange: (next: DragDropEditorDraft) => void;
}

const DragDropEditor: React.FC<DragDropEditorProps> = ({ draft, onChange }) => (
    <div className="space-y-4">
        <FieldRow
            label="Đoạn văn"
            hint="Dùng [từ] để đánh dấu chỗ trống. VD: The sky is [blue] and the grass is [green]."
        >
            <MathTextarea
                value={draft.text}
                onChange={(e) => onChange({ ...draft, text: e.target.value })}
                rows={3}
                placeholder="The sky is [blue] and the grass is [green]."
            />
        </FieldRow>

        <FieldRow label="Các từ đáp án đúng (blanks)">
            <div className="space-y-2">
                {draft.blanks.map((blank, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="w-6 text-center text-gray-500 text-sm">{i + 1}.</span>
                        <TextInput
                            value={blank}
                            onChange={(e) => {
                                const next = [...draft.blanks];
                                next[i] = e.target.value;
                                onChange({ ...draft, blanks: next });
                            }}
                        />
                        {draft.blanks.length > 1 && (
                            <RemoveBtn
                                onClick={() =>
                                    onChange({
                                        ...draft,
                                        blanks: draft.blanks.filter((_, idx) => idx !== i),
                                    })
                                }
                            />
                        )}
                    </div>
                ))}
                <AddRowBtn
                    onClick={() => onChange({ ...draft, blanks: [...draft.blanks, ''] })}
                    label="Thêm blank"
                />
            </div>
        </FieldRow>

        <FieldRow label="Từ gây nhiễu (distractors)">
            <div className="space-y-2">
                {draft.distractors.map((dist, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <TextInput
                            value={dist}
                            onChange={(e) => {
                                const next = [...draft.distractors];
                                next[i] = e.target.value;
                                onChange({ ...draft, distractors: next });
                            }}
                        />
                        <RemoveBtn
                            onClick={() =>
                                onChange({
                                    ...draft,
                                    distractors: draft.distractors.filter(
                                        (_, idx) => idx !== i,
                                    ),
                                })
                            }
                        />
                    </div>
                ))}
                <AddRowBtn
                    onClick={() =>
                        onChange({ ...draft, distractors: [...draft.distractors, ''] })
                    }
                    label="Thêm distractor"
                />
            </div>
        </FieldRow>
    </div>
);

export default DragDropEditor;
