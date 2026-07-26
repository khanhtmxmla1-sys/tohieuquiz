/**
 * TrueFalseEditor.tsx
 * Editor for TRUE_FALSE question type.
 */
import React from 'react';
import type { TrueFalseEditorDraft } from '../../../types/quiz-editor.types';
import { RemoveBtn, AddRowBtn, TextInput } from './shared';
import { toBoolean } from '../../../utils/questionNormalizers';

interface TrueFalseEditorProps {
    draft: TrueFalseEditorDraft;
    onChange: (next: TrueFalseEditorDraft) => void;
}

const TrueFalseEditor: React.FC<TrueFalseEditorProps> = ({ draft, onChange }) => (
    <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
            Các mệnh đề (Đúng/Sai)
        </label>
        {draft.items.map((item, i) => (
            <div key={item.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                <span className="text-gray-500 text-sm w-5">
                    {String.fromCharCode(97 + i)}.
                </span>
                <TextInput
                    value={item.statement}
                    onChange={(e) => {
                        const next = [...draft.items];
                        next[i] = { ...next[i], statement: e.target.value };
                        onChange({ ...draft, items: next });
                    }}
                    placeholder={`Mệnh đề ${i + 1}`}
                />
                <select
                    value={toBoolean(item.isCorrect) ? 'true' : 'false'}
                    onChange={(e) => {
                        const next = [...draft.items];
                        next[i] = { ...next[i], isCorrect: e.target.value === 'true' };
                        onChange({ ...draft, items: next });
                    }}
                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                    <option value="true">Đúng</option>
                    <option value="false">Sai</option>
                </select>
                {draft.items.length > 1 && (
                    <RemoveBtn
                        onClick={() =>
                            onChange({
                                ...draft,
                                items: draft.items.filter((_, idx) => idx !== i),
                            })
                        }
                    />
                )}
            </div>
        ))}
        <AddRowBtn
            onClick={() =>
                onChange({
                    ...draft,
                    items: [
                        ...draft.items,
                        { id: String(Date.now()), statement: '', isCorrect: true },
                    ],
                })
            }
            label="Thêm mệnh đề"
        />
    </div>
);

export default TrueFalseEditor;
