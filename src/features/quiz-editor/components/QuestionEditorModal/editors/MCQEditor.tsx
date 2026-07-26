/**
 * MCQEditor.tsx + MultipleSelectEditor.tsx — combined in this file
 * because they share nearly identical option-editing UI.
 *
 * Split into separate named exports for lazy-loading.
 */
import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { MCQEditorDraft, MultipleSelectEditorDraft } from '../../../types/quiz-editor.types';
import { FieldRow, RemoveBtn, AddRowBtn, TextInput } from './shared';

// ---------------------------------------------------------------------------
// Shared Options Editor
// ---------------------------------------------------------------------------

interface OptionsEditorProps {
    options: string[];
    onChange: (opts: string[]) => void;
}

const OptionsEditor: React.FC<OptionsEditorProps> = ({ options, onChange }) => (
    <FieldRow label="Các đáp án">
        <div className="space-y-2">
            {options.map((opt, i) => (
                <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="w-6 text-center font-bold text-gray-500 text-sm">
                            {String.fromCharCode(65 + i)}.
                        </span>
                        <TextInput
                            value={opt}
                            onChange={(e) => {
                                const next = [...options];
                                next[i] = e.target.value;
                                onChange(next);
                            }}
                            placeholder={`Đáp án ${String.fromCharCode(65 + i)}`}
                        />
                        {options.length > 2 && (
                            <RemoveBtn
                                onClick={() => onChange(options.filter((_, idx) => idx !== i))}
                            />
                        )}
                    </div>

                </div>
            ))}
            {options.length < 8 && (
                <AddRowBtn
                    onClick={() => onChange([...options, ''])}
                    label={`Thêm đáp án ${String.fromCharCode(65 + options.length)}`}
                />
            )}
        </div>
    </FieldRow>
);

// ---------------------------------------------------------------------------
// MCQEditor
// ---------------------------------------------------------------------------

interface MCQEditorProps {
    draft: MCQEditorDraft;
    onChange: (next: MCQEditorDraft) => void;
    // Smart distractor props (optional — only shown when editing, not adding)
    isGeneratingDistractors?: boolean;
    distractorCount?: number;
    distractorError?: string | null;
    onSetDistractorCount?: (n: number) => void;
    onGenerateDistractors?: () => void;
}

export const MCQEditor: React.FC<MCQEditorProps> = ({
    draft,
    onChange,
    isGeneratingDistractors = false,
    distractorCount = 3,
    distractorError,
    onSetDistractorCount,
    onGenerateDistractors,
}) => (
    <div className="space-y-4">
        <OptionsEditor
            options={draft.options}
            onChange={(opts) => onChange({ ...draft, options: opts })}
        />

        {/* Smart Distractors */}
        {onGenerateDistractors && (
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-500">Số đáp án nhiễu:</label>
                    <div className="flex gap-1">
                        {[2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => onSetDistractorCount?.(n)}
                                className={`w-7 h-7 rounded-md font-bold text-xs transition-all ${
                                    distractorCount === n
                                        ? 'bg-purple-500 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onGenerateDistractors}
                    disabled={isGeneratingDistractors || !draft.correctAnswer}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        isGeneratingDistractors || !draft.correctAnswer
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-md'
                    }`}
                >
                    {isGeneratingDistractors ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" /> Tạo {distractorCount} đáp án nhiễu bằng AI
                        </>
                    )}
                </button>
                {!draft.correctAnswer && (
                    <p className="text-xs text-amber-600">⚠️ Cần nhập đáp án đúng trước</p>
                )}
                {distractorError && (
                    <p className="text-xs text-red-500">❌ {distractorError}</p>
                )}
            </div>
        )}

        {/* Correct Answer */}
        <FieldRow label="Đáp án đúng">
            <TextInput
                value={draft.correctAnswer}
                onChange={(e) => onChange({ ...draft, correctAnswer: e.target.value })}
                placeholder="A, B, C hoặc D"
            />
        </FieldRow>
    </div>
);

// ---------------------------------------------------------------------------
// MultipleSelectEditor
// ---------------------------------------------------------------------------

interface MultipleSelectEditorProps {
    draft: MultipleSelectEditorDraft;
    onChange: (next: MultipleSelectEditorDraft) => void;
    isGeneratingDistractors?: boolean;
    distractorCount?: number;
    distractorError?: string | null;
    onSetDistractorCount?: (n: number) => void;
    onGenerateDistractors?: () => void;
}

export const MultipleSelectEditor: React.FC<MultipleSelectEditorProps> = ({
    draft,
    onChange,
    isGeneratingDistractors = false,
    distractorCount = 3,
    distractorError,
    onSetDistractorCount,
    onGenerateDistractors,
}) => (
    <div className="space-y-4">
        <OptionsEditor
            options={draft.options}
            onChange={(opts) => onChange({ ...draft, options: opts })}
        />

        {/* Smart Distractors */}
        {onGenerateDistractors && (
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-500">Số đáp án nhiễu:</label>
                    <div className="flex gap-1">
                        {[2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => onSetDistractorCount?.(n)}
                                className={`w-7 h-7 rounded-md font-bold text-xs transition-all ${
                                    distractorCount === n
                                        ? 'bg-purple-500 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onGenerateDistractors}
                    disabled={isGeneratingDistractors || draft.correctAnswers.length === 0}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        isGeneratingDistractors || draft.correctAnswers.length === 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-md'
                    }`}
                >
                    {isGeneratingDistractors ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" /> Tạo {distractorCount} đáp án nhiễu bằng AI
                        </>
                    )}
                </button>
                {distractorError && (
                    <p className="text-xs text-red-500">❌ {distractorError}</p>
                )}
            </div>
        )}

        {/* Correct Answers (checkboxes) */}
        <FieldRow label="Đáp án đúng (chọn nhiều)">
            <div className="flex flex-wrap gap-3">
                {draft.options.map((_, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const checked = draft.correctAnswers.includes(letter);
                    return (
                        <label key={letter} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                    const next = e.target.checked
                                        ? [...draft.correctAnswers, letter].sort()
                                        : draft.correctAnswers.filter((a) => a !== letter);
                                    onChange({ ...draft, correctAnswers: next });
                                }}
                                className="w-4 h-4 text-green-600"
                            />
                            <span className="font-medium text-sm">{letter}</span>
                        </label>
                    );
                })}
            </div>
        </FieldRow>
    </div>
);
