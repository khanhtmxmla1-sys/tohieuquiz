/**
 * WordScrambleEditor.tsx
 * Editor for WORD_SCRAMBLE question type.
 */
import React from 'react';
import type { WordScrambleEditorDraft } from '../../../types/quiz-editor.types';
import { FieldRow, TextInput } from './shared';

interface WordScrambleEditorProps {
    draft: WordScrambleEditorDraft;
    onChange: (next: WordScrambleEditorDraft) => void;
}

const WordScrambleEditor: React.FC<WordScrambleEditorProps> = ({ draft, onChange }) => (
    <div className="space-y-4">
        <FieldRow label="Từ đúng">
            <TextInput
                value={draft.correctWord}
                onChange={(e) => onChange({ ...draft, correctWord: e.target.value })}
                placeholder="Nhập từ đúng..."
                className="border-green-300 focus:ring-green-500"
            />
        </FieldRow>

        <FieldRow label="Các chữ cái (đã xáo trộn)">
            <div className="flex flex-wrap gap-2">
                {draft.letters.map((letter, i) => (
                    <input
                        key={i}
                        type="text"
                        value={letter}
                        onChange={(e) => {
                            const next = [...draft.letters];
                            next[i] = e.target.value.slice(0, 1).toUpperCase();
                            onChange({ ...draft, letters: next });
                        }}
                        className="w-10 h-10 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold uppercase"
                        maxLength={1}
                    />
                ))}
            </div>
        </FieldRow>
    </div>
);

export default WordScrambleEditor;
