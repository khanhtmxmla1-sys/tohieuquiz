/**
 * QuestionCard.tsx
 *
 * Renders a single question in read-only preview mode.
 *
 * Responsibilities:
 *  - Show question text + optional attached image
 *  - Dispatch rendering to the correct type-specific Renderer
 *  - Render QuestionCardActions (edit/delete/AI buttons)
 *  - Show type badge + difficulty badge
 *
 * This component is intentionally "dumb" — it holds NO state.
 * All state lives in the parent (QuizPreview) via custom hooks.
 */
import React from 'react';
import { QuestionType } from '../../../../types';
import type { Question } from '../../../../types';
import { NewlineMathText } from '../../../../components/common';
import GeometryRenderer from '../../../../components/common/GeometryRenderer';
import QuestionRichTextRenderer from '../../../../components/common/QuestionRichTextRenderer';
import SafeRasterImage from '../../../../components/common/SafeRasterImage';
import SafeSvgDiagram from '../../../../components/common/SafeSvgDiagram';
import { getTypeLabel, getDifficultyLabel, getDifficultyColorClass } from '../../utils/questionHelpers';
import { fixReorderQuestion } from '../../utils/questionNormalizers';
import type { Difficulty } from '../../types/quiz-editor.types';
import QuestionCardActions from './QuestionCardActions';

// Renderers
import MCQRenderer from './renderers/MCQRenderer';
import MultipleSelectRenderer from './renderers/MultipleSelectRenderer';
import TrueFalseRenderer from './renderers/TrueFalseRenderer';
import ShortAnswerRenderer from './renderers/ShortAnswerRenderer';
import MatchingRenderer from './renderers/MatchingRenderer';
import DragDropRenderer from './renderers/DragDropRenderer';
import OrderingRenderer from './renderers/OrderingRenderer';
import ImageQuestionRenderer from './renderers/ImageQuestionRenderer';
import DropdownRenderer from './renderers/DropdownRenderer';
import UnderlineRenderer from './renderers/UnderlineRenderer';
import CategorizationRenderer from './renderers/CategorizationRenderer';
import WordScrambleRenderer from './renderers/WordScrambleRenderer';
import RiddleRenderer from './renderers/RiddleRenderer';
import ErrorCorrectionRenderer from './renderers/ErrorCorrectionRenderer';

// ---------------------------------------------------------------------------
// Type-switch renderer dispatcher
// ---------------------------------------------------------------------------

const QuestionBodyRenderer: React.FC<{ question: Question }> = ({ question }) => {
    switch (question.type) {
        case QuestionType.MCQ:
            return <MCQRenderer question={question} />;
        case QuestionType.MULTIPLE_SELECT:
            return <MultipleSelectRenderer question={question} />;
        case QuestionType.TRUE_FALSE:
            return <TrueFalseRenderer question={question} />;
        case QuestionType.SHORT_ANSWER:
            return <ShortAnswerRenderer question={question} />;
        case QuestionType.MATCHING:
            return <MatchingRenderer question={question} />;
        case QuestionType.DRAG_DROP:
            return <DragDropRenderer question={question} />;
        case QuestionType.ORDERING:
            return <OrderingRenderer question={question} />;
        case QuestionType.IMAGE_QUESTION:
            return <ImageQuestionRenderer question={question} />;
        case QuestionType.DROPDOWN:
            return <DropdownRenderer question={question} />;
        case QuestionType.UNDERLINE:
            return <UnderlineRenderer question={question} />;
        case QuestionType.CATEGORIZATION:
            return <CategorizationRenderer question={question} />;
        case QuestionType.WORD_SCRAMBLE:
            return <WordScrambleRenderer question={question} />;
        case QuestionType.RIDDLE:
            return <RiddleRenderer question={question} />;
        case QuestionType.ERROR_CORRECTION:
            return <ErrorCorrectionRenderer question={question} />;
        case QuestionType.GEOMETRY: {
            const geometryData = (question as unknown as Record<string, unknown>).geometryData;
            return geometryData && typeof geometryData === 'object' ? (
                <div className="ml-8 flex min-w-0 justify-center overflow-x-auto rounded-lg border border-gray-200 bg-white p-3">
                    <GeometryRenderer data={geometryData as any} />
                </div>
            ) : null;
        }
        default:
            return null;
    }
};

// ---------------------------------------------------------------------------
// QuestionCard Props
// ---------------------------------------------------------------------------

export interface QuestionCardProps {
    question: Question;
    index: number;
    // Action callbacks (undefined = read-only mode, no buttons shown)
    onEdit?: (question: Question) => void;
    onDelete?: (questionId: string) => void;
    onRegenerate?: (question: Question) => void;
    onGenerateDistractors?: (questionId: string, count: number) => void;
    onToggleDistractorPopover?: (id: string | null) => void;
    onSetDistractorCount?: (count: number) => void;
    // Bank action
    onSaveToBank?: (question: Question) => void;
    // Action state (passed down from hooks)
    isGeneratingSingle?: string | null;
    generatingDistractorId?: string | null;
    showDistractorPopover?: string | null;
    distractorCount?: number;
    distractorError?: string | null;
}

// ---------------------------------------------------------------------------
// QuestionCard component
// ---------------------------------------------------------------------------

const QuestionCard: React.FC<QuestionCardProps> = ({
    question,
    index,
    onEdit,
    onDelete,
    onRegenerate,
    onGenerateDistractors,
    onToggleDistractorPopover,
    onSetDistractorCount,
    onSaveToBank,
    isGeneratingSingle = null,
    generatingDistractorId = null,
    showDistractorPopover = null,
    distractorCount = 3,
    distractorError = null,
}) => {
    const canEdit = Boolean(onEdit && onDelete);
    const canRegenerate = Boolean(onRegenerate);

    // Some legacy questions store text under `mainQuestion` instead of `question`
    const q = question as unknown as Record<string, unknown>;
    const questionText = String(q.question ?? q.mainQuestion ?? '');

    // Optional image for types that aren't IMAGE_QUESTION / DROPDOWN (they handle their own images)
    const showAttachedImage =
        question.type !== QuestionType.IMAGE_QUESTION &&
        question.type !== QuestionType.DROPDOWN &&
        Boolean(q.image);

    const difficulty = q.difficulty as Difficulty | undefined;
    const svgContent = typeof q.svgContent === 'string'
        ? q.svgContent
        : (typeof q.svg_content === 'string' ? q.svg_content : '');
    const svgAlt = typeof q.svgAlt === 'string'
        ? q.svgAlt
        : (typeof q.svg_alt === 'string' ? q.svg_alt : '');
    const hasStructuredGeometry = question.type === QuestionType.GEOMETRY
        && q.geometryData
        && typeof q.geometryData === 'object';

    return (
        <div
            className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-default"
            onDoubleClick={() => canEdit && onEdit?.(question)}
        >
            {/* Header: Question text + Actions */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-start gap-2 flex-1">
                    <span className="bg-indigo-100 text-indigo-800 text-sm font-bold px-3 py-1 rounded-lg">
                        Câu {index + 1}:
                    </span>
                    <div className="flex-1">
                        {q.questionRichText ? (
                            <QuestionRichTextRenderer
                                value={q.questionRichText as any}
                                fallback={fixReorderQuestion(questionText)}
                                className="text-gray-800 font-medium quiz-text-preserve-block"
                            />
                        ) : (
                            <NewlineMathText
                                content={fixReorderQuestion(questionText)}
                                as="div"
                                className="text-gray-800 font-medium quiz-text-preserve-block"
                            />
                        )}
                    </div>
                </div>

                {canEdit && onEdit && onDelete && onGenerateDistractors &&
                    onToggleDistractorPopover && onSetDistractorCount && (
                    <QuestionCardActions
                        question={question}
                        isGeneratingSingle={isGeneratingSingle}
                        generatingDistractorId={generatingDistractorId}
                        showDistractorPopover={showDistractorPopover}
                        distractorCount={distractorCount}
                        distractorError={distractorError}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onRegenerate={onRegenerate ?? (() => {})}
                        onGenerateDistractors={onGenerateDistractors}
                        onToggleDistractorPopover={onToggleDistractorPopover}
                        onSetDistractorCount={onSetDistractorCount}
                        onSaveToBank={onSaveToBank}
                        canEdit={canEdit}
                        canRegenerate={canRegenerate}
                    />
                )}
            </div>

            {/* Optional attached image */}
            {showAttachedImage && (
                <div className="ml-8 mt-2 mb-3">
                    <SafeRasterImage
                        src={String(q.image)}
                        alt={String(q.imageAlt ?? q.image_alt ?? `Hình minh họa câu ${index + 1}`)}
                        loading="lazy"
                        decoding="async"
                        className="max-h-32 max-w-full rounded-lg border object-contain bg-gray-50"
                    />
                </div>
            )}

            {svgContent && svgAlt && !hasStructuredGeometry ? (
                <SafeSvgDiagram
                    svgContent={svgContent}
                    alt={svgAlt}
                    className="mb-4 ml-8"
                    maxHeight={320}
                />
            ) : null}

            {/* Type-specific body */}
            <QuestionBodyRenderer question={question} />

            {/* Footer badges */}
            <div className="mt-2 ml-8 flex items-center gap-2">
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    {getTypeLabel(question.type)}
                </span>
                {difficulty && (
                    <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${getDifficultyColorClass(difficulty)}`}
                    >
                        {getDifficultyLabel(difficulty)}
                    </span>
                )}
            </div>
        </div>
    );
};

export default React.memo(QuestionCard);
