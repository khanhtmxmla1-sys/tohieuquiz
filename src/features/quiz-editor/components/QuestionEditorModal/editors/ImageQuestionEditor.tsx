/**
 * ImageQuestionEditor.tsx
 * Editor for IMAGE_QUESTION type.
 */
import React from 'react';
import type { ImageQuestionEditorDraft } from '../../../types/quiz-editor.types';
import { FieldRow, TextInput } from './shared';
import MediaDropzone from '../../../../manual-quiz-workspace/components/MediaDropzone';

interface ImageQuestionEditorProps {
    draft: ImageQuestionEditorDraft;
    onChange: (next: ImageQuestionEditorDraft) => void;
}

const ImageQuestionEditor: React.FC<ImageQuestionEditorProps> = ({ draft, onChange }) => (
    <div className="space-y-4">
        {/* Main image */}
        <FieldRow label="🖼️ URL hình ảnh câu hỏi">
            <MediaDropzone
                label="Ảnh câu hỏi"
                value={draft.image}
                altText={draft.imageAlt ?? ''}
                onChange={(image) => onChange({ ...draft, image })}
                onAltTextChange={(imageAlt) => onChange({ ...draft, imageAlt })}
            />
        </FieldRow>

        {/* Option text + optional image URL */}
        <FieldRow
            label="🔗 Đáp án và link ảnh (tùy chọn)"
            hint="Nếu đáp án là hình ảnh, dán URL ảnh vào ô Link. Để trống nếu đáp án là chữ."
        >
            <div className="space-y-2">
                {draft.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const optImg = draft.optionImages?.[i] ?? '';
                    return (
                        <div
                            key={i}
                            className="flex items-start gap-2 border p-3 rounded-lg bg-gray-50"
                        >
                            <span className="w-6 text-center font-bold text-gray-500 flex-shrink-0 mt-2">
                                {letter}.
                            </span>
                            <div className="flex-1 space-y-2">
                                <div>
                                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                                        Nội dung (Text):
                                    </label>
                                    <TextInput
                                        value={opt}
                                        onChange={(e) => {
                                            const next = [...draft.options];
                                            next[i] = e.target.value;
                                            onChange({ ...draft, options: next });
                                        }}
                                        placeholder={`Nội dung đáp án ${letter}`}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                                        Link ảnh (URL) — Tùy chọn:
                                    </label>
                                    <TextInput
                                        value={optImg}
                                        onChange={(e) => {
                                            const next = [
                                                ...(draft.optionImages ?? draft.options.map(() => '')),
                                            ];
                                            next[i] = e.target.value;
                                            onChange({ ...draft, optionImages: next });
                                        }}
                                        placeholder="https://..."
                                        showMathPreview={false}
                                        showMathToolbar={false}
                                    />
                                    {optImg && (
                                        <img
                                            src={optImg}
                                            alt={`Option ${letter}`}
                                            className="mt-2 max-h-24 rounded border bg-white"
                                            onError={(e) =>
                                                ((e.target as HTMLImageElement).style.display = 'none')
                                            }
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </FieldRow>

        {/* Correct Answer */}
        <FieldRow label="✅ Đáp án đúng">
            <div className="grid grid-cols-2 gap-2">
                {draft.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isCorrect = draft.correctAnswer === letter;
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onChange({ ...draft, correctAnswer: letter })}
                            className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                                isCorrect
                                    ? 'border-green-500 bg-green-50 ring-1 ring-green-400'
                                    : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                            }`}
                        >
                            <span
                                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                    isCorrect
                                        ? 'border-green-500 bg-green-500 text-white'
                                        : 'border-gray-300 text-gray-500'
                                }`}
                            >
                                {letter}
                            </span>
                            <span
                                className={`text-sm truncate ${
                                    isCorrect ? 'font-semibold text-green-700' : 'text-gray-600'
                                }`}
                            >
                                {opt || `Đáp án ${letter}`}
                            </span>
                            {isCorrect && <span className="ml-auto text-green-600">✓</span>}
                        </button>
                    );
                })}
            </div>
            {!draft.correctAnswer && (
                <p className="text-xs text-red-500 mt-1">⚠️ Chưa chọn đáp án đúng!</p>
            )}
        </FieldRow>
    </div>
);

export default ImageQuestionEditor;
