/**
 * MatchingEditor.tsx
 * Editor for MATCHING question type.
 */
import React from 'react';
import type { MatchingEditorDraft } from '../../../types/quiz-editor.types';
import { AddRowBtn, FieldRow, RemoveBtn, TextInput } from './shared';

interface MatchingEditorProps {
    draft: MatchingEditorDraft;
    onChange: (next: MatchingEditorDraft) => void;
}

const MatchingEditor: React.FC<MatchingEditorProps> = ({ draft, onChange }) => {
    const addPair = () => {
        onChange({
            ...draft,
            pairs: [...draft.pairs, { left: '', right: '', image: '' }],
        });
    };

    return (
        <div className="space-y-3">
            <FieldRow label="Các cặp nối">
                <div className="space-y-2">
                    {draft.pairs.length === 0 && (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                            Chưa có cặp nối nào. Bấm "Thêm cặp nối" để nhập vế trái và vế phải.
                        </div>
                    )}

                    {draft.pairs.map((pair, i) => (
                        <div key={i} className="space-y-2 rounded-lg bg-gray-50 p-2">
                            <div className="flex items-center gap-2">
                                <TextInput
                                    value={pair.left}
                                    onChange={(e) => {
                                        const next = [...draft.pairs];
                                        next[i] = { ...next[i], left: e.target.value };
                                        onChange({ ...draft, pairs: next });
                                    }}
                                    placeholder="Vế trái"
                                />
                                <span className="text-gray-400 flex-shrink-0">→</span>
                                <TextInput
                                    value={pair.right}
                                    onChange={(e) => {
                                        const next = [...draft.pairs];
                                        next[i] = { ...next[i], right: e.target.value };
                                        onChange({ ...draft, pairs: next });
                                    }}
                                    placeholder="Vế phải"
                                />
                                <RemoveBtn
                                    onClick={() =>
                                        onChange({
                                            ...draft,
                                            pairs: draft.pairs.filter((_, idx) => idx !== i),
                                        })
                                    }
                                />
                            </div>
                            <TextInput
                                value={pair.image ?? ''}
                                onChange={(e) => {
                                    const next = [...draft.pairs];
                                    next[i] = { ...next[i], image: e.target.value };
                                    onChange({ ...draft, pairs: next });
                                }}
                                placeholder="URL hình cho cặp nối này (tùy chọn)"
                                showMathPreview={false}
                                showMathToolbar={false}
                            />
                        </div>
                    ))}

                    <AddRowBtn onClick={addPair} label="Thêm cặp nối" />
                </div>
            </FieldRow>
        </div>
    );
};

export default MatchingEditor;
