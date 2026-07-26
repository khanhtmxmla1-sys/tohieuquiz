/**
 * UnderlineEditor.tsx
 * Editor for UNDERLINE question type.
 */
import React from 'react';
import type { UnderlineEditorDraft } from '../../../types/quiz-editor.types';
import { FieldRow, TextInput } from './shared';

interface UnderlineEditorProps {
    draft: UnderlineEditorDraft;
    onChange: (next: UnderlineEditorDraft) => void;
}

const UnderlineEditor: React.FC<UnderlineEditorProps> = ({ draft, onChange }) => (
    <div className="space-y-4">
        <FieldRow label="Câu hoàn chỉnh">
            <TextInput
                value={draft.sentence}
                onChange={(e) => {
                    const newSentence = e.target.value;
                    // Split by whitespace
                    const newWords = newSentence.trim() === '' ? [] : newSentence.split(/\s+/).filter(w => w.length > 0);
                    onChange({ 
                        ...draft, 
                        sentence: newSentence,
                        words: newWords,
                        // Filter indexes to stay within valid range
                        correctWordIndexes: draft.correctWordIndexes.filter(idx => idx < newWords.length)
                    });
                }}
                placeholder="Nhập câu hoàn chỉnh..."
            />
        </FieldRow>

        <FieldRow
            label="Các từ để chọn"
            hint="Click vào từ bên dưới để đánh dấu là đáp án đúng (gạch dưới)."
        >
            <div className="flex flex-wrap gap-2">
                {draft.words.map((word, i) => {
                    const isCorrect = draft.correctWordIndexes.includes(i);
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => {
                                const next = isCorrect
                                    ? draft.correctWordIndexes.filter((idx) => idx !== i)
                                    : [...draft.correctWordIndexes, i].sort((a, b) => a - b);
                                onChange({ ...draft, correctWordIndexes: next });
                            }}
                            className={`px-2 py-1 rounded text-sm transition-all ${
                                isCorrect
                                    ? 'bg-green-100 text-green-800 font-semibold underline border border-green-400'
                                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:border-gray-400'
                            }`}
                        >
                            {word}
                        </button>
                    );
                })}
            </div>
            {draft.correctWordIndexes.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">⚠️ Chưa chọn từ đúng</p>
            )}
        </FieldRow>
    </div>
);

export default UnderlineEditor;
