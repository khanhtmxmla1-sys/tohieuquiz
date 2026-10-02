/**
 * UnderlineEditor.tsx
 * Editor for UNDERLINE question type.
 */
import React from 'react';
import { UnderlineSentence } from '../../../../../components/common/UnderlineSentence';
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
            hint="Nhấn vào từ hoặc các từ trong cụm cần làm đáp án đúng."
        >
            <UnderlineSentence
                sentence={draft.sentence}
                words={draft.words}
                interactive
                stateForIndex={(index) =>
                    draft.correctWordIndexes.includes(index) ? 'correct' : 'idle'
                }
                onToggle={(index) => {
                    const selected = draft.correctWordIndexes.includes(index);
                    const next = selected
                        ? draft.correctWordIndexes.filter((value) => value !== index)
                        : [...draft.correctWordIndexes, index].sort((a, b) => a - b);
                    onChange({ ...draft, correctWordIndexes: next });
                }}
                ariaLabel="Chọn từ hoặc cụm từ làm đáp án đúng"
            />
            {draft.correctWordIndexes.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">⚠️ Chưa chọn từ đúng</p>
            )}
        </FieldRow>
    </div>
);

export default UnderlineEditor;
