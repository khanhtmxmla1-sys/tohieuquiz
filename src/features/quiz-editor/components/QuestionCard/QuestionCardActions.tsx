/**
 * QuestionCardActions.tsx
 *
 * Renders the action buttons for a single QuestionCard:
 *   - AI Smart Distractors (MCQ / MultipleSelect / ImageQuestion only)
 *   - Regenerate via AI
 *   - Edit (pencil)
 *   - Delete (trash)
 */
import React, { useState } from 'react';
import { Edit3, Trash2, Sparkles, Loader2, RefreshCw, BookmarkPlus, Check } from 'lucide-react';
import type { Question } from '../../../../types';
import { supportsDistractors } from '../../index';

interface QuestionCardActionsProps {
    question: Question;
    /** ID currently being AI-regenerated (or null). */
    isGeneratingSingle: string | null;
    /** ID currently generating distractors in list mode (or null). */
    generatingDistractorId: string | null;
    /** ID whose distractor popover is open (or null). */
    showDistractorPopover: string | null;
    /** Currently selected distractor count. */
    distractorCount: number;
    /** Error message from last distractor generation attempt. */
    distractorError: string | null;
    onEdit: (question: Question) => void;
    onDelete: (questionId: string) => void;
    onRegenerate: (question: Question) => void;
    onGenerateDistractors: (questionId: string, count: number) => void;
    onToggleDistractorPopover: (questionId: string | null) => void;
    onSetDistractorCount: (count: number) => void;
    /** Whether the parent allows mutations. */
    canEdit: boolean;
    /** Whether the parent provides AI regeneration. */
    canRegenerate: boolean;
    /** Callback to save the question to the teacher's personal bank. */
    onSaveToBank?: (question: Question) => void;
}

const QuestionCardActions: React.FC<QuestionCardActionsProps> = ({
    question,
    isGeneratingSingle,
    generatingDistractorId,
    showDistractorPopover,
    distractorCount,
    distractorError,
    onEdit,
    onDelete,
    onRegenerate,
    onGenerateDistractors,
    onToggleDistractorPopover,
    onSetDistractorCount,
    canEdit,
    canRegenerate,
    onSaveToBank
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    if (!canEdit) return null;

    const isGeneratingThis = generatingDistractorId === question.id;
    const isRegeneratingThis = isGeneratingSingle === question.id;
    const popoverOpen = showDistractorPopover === question.id;

    const handleSaveToBank = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onSaveToBank) return;
        setIsSaving(true);
        try {
            await onSaveToBank(question);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex items-center gap-1 relative">
            {/* Smart Distractor button */}
            {supportsDistractors(question.type) && (
                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleDistractorPopover(popoverOpen ? null : question.id);
                        }}
                        disabled={isGeneratingThis}
                        className={`p-1.5 rounded-lg transition-colors ${
                            isGeneratingThis
                                ? 'text-purple-400 bg-purple-50 cursor-wait'
                                : 'text-purple-500 hover:bg-purple-50'
                        }`}
                        title="Tạo đáp án nhiễu bằng AI"
                    >
                        {isGeneratingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                    </button>

                    {popoverOpen && (
                        <div
                            className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-lg border border-gray-200 p-3 w-56"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <p className="text-xs font-medium text-gray-600 mb-2">
                                Số đáp án nhiễu:
                            </p>
                            <div className="flex gap-1 mb-3">
                                {[2, 3, 4, 5].map((n) => (
                                    <button
                                        key={n}
                                        onClick={() => onSetDistractorCount(n)}
                                        className={`w-9 h-9 rounded-lg font-bold text-sm transition-all ${
                                            distractorCount === n
                                                ? 'bg-purple-500 text-white shadow-md'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() =>
                                    onGenerateDistractors(question.id, distractorCount)
                                }
                                className="w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-semibold rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-1.5"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Tạo {distractorCount} đáp án nhiễu
                            </button>
                            {distractorError && (
                                <p className="text-xs text-red-500 mt-2">{distractorError}</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Regenerate button */}
            {canRegenerate && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRegenerate(question);
                    }}
                    disabled={isRegeneratingThis}
                    className={`p-1.5 rounded-lg transition-colors ${
                        isRegeneratingThis
                            ? 'text-blue-400 bg-blue-50 cursor-wait'
                            : 'text-blue-500 hover:bg-blue-50'
                    }`}
                    title="Sinh lại câu hỏi này (AI)"
                >
                    {isRegeneratingThis ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4" />
                    )}
                </button>
            )}

            {/* Save to Bank */}
            {onSaveToBank && (
                <button
                    onClick={handleSaveToBank}
                    disabled={isSaving || saved}
                    className={'p-1.5 rounded-lg transition-colors ' + (
                        saved ? 'text-green-500 bg-green-50' : 
                        isSaving ? 'text-orange-400 bg-orange-50 cursor-wait' : 'text-orange-500 hover:bg-orange-50'
                    )}
                    title="Lưu câu hỏi này vào ngân hàng chung của bạn"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                     saved ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                </button>
            )}

            {/* Edit */}
            <button
                onClick={() => onEdit(question)}
                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                title="Sửa câu hỏi (nhấp đúp vào thẻ để sửa)"
            >
                <Edit3 className="w-4 h-4" />
            </button>

            {/* Delete */}
            <button
                onClick={() => onDelete(question.id)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Xóa câu hỏi"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
};

export default React.memo(QuestionCardActions);
