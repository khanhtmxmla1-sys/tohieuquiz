/**
 * DropdownEditor.tsx
 * Editor for DROPDOWN (fill-in-the-blank dropdown) question type.
 */
import React from 'react';
import type { DropdownEditorDraft } from '../../../types/quiz-editor.types';
import { FieldRow, RemoveBtn, AddRowBtn, MathTextarea, TextInput } from './shared';

interface DropdownEditorProps {
    draft: DropdownEditorDraft;
    onChange: (next: DropdownEditorDraft) => void;
}

const DropdownEditor: React.FC<DropdownEditorProps> = ({ draft, onChange }) => (
    <div className="space-y-4">
        {/* Optional illustration image */}
        <FieldRow label="Link ảnh minh họa (tùy chọn)">
            <TextInput
                value={draft.image ?? ''}
                onChange={(e) => onChange({ ...draft, image: e.target.value })}
                placeholder="https://example.com/image.jpg"
                showMathPreview={false}
                showMathToolbar={false}
            />
        </FieldRow>

        <FieldRow
            label="Đoạn văn"
            hint="Dùng [1], [2]... để đánh dấu vị trí dropdown. VD: Thủ đô Việt Nam là [1]."
        >
            <MathTextarea
                value={draft.text}
                onChange={(e) => onChange({ ...draft, text: e.target.value })}
                rows={3}
                placeholder="Thủ đô Việt Nam là [1]. Dân số khoảng [2] triệu."
            />
        </FieldRow>

        {/* Blanks editor */}
        <FieldRow label="Các ô chọn (blanks)">
            <div className="space-y-3">
                {draft.blanks.map((blank, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-gray-50 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-700">
                                Ô [{i + 1}]
                            </span>
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
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Đáp án đúng:
                            </label>
                            <TextInput
                                value={blank.correctAnswer}
                                onChange={(e) => {
                                    const next = [...draft.blanks];
                                    next[i] = { ...next[i], correctAnswer: e.target.value };
                                    onChange({ ...draft, blanks: next });
                                }}
                                placeholder="Nhập đáp án đúng"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Các lựa chọn sai (cách nhau bởi dấu phẩy):
                            </label>
                            <TextInput
                                value={blank.options.filter(opt => opt !== blank.correctAnswer).join(', ')}
                                onChange={(e) => {
                                    const next = [...draft.blanks];
                                    const distractors = e.target.value
                                        .split(',')
                                        .map((o) => o.trim())
                                        .filter(Boolean);
                                    next[i] = {
                                        ...next[i],
                                        options: Array.from(new Set([next[i].correctAnswer, ...distractors])),
                                    };
                                    onChange({ ...draft, blanks: next });
                                }}
                                placeholder="Sai 1, Sai 2, Sai 3"
                            />
                        </div>
                    </div>
                ))}
                <AddRowBtn
                    onClick={() =>
                        onChange({
                            ...draft,
                            blanks: [
                                ...draft.blanks,
                                { id: String(Date.now()), correctAnswer: '', options: [] },
                            ],
                        })
                    }
                    label={`Thêm ô [${draft.blanks.length + 1}]`}
                />
            </div>
        </FieldRow>
    </div>
);

export default DropdownEditor;
