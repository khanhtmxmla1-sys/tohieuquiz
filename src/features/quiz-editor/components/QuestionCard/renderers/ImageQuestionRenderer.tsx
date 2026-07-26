/**
 * ImageQuestionRenderer.tsx
 * Renders an Image Question (câu hỏi có hình bắt buộc) in read-only mode.
 *
 * Handles three image sources in order of priority:
 *   1. `geometry` (TikZ code or GeoGebra data object) — legacy field
 *   2. `image` containing TikZ code (starts with \begin{tikzpicture})
 *   3. `image` as a regular URL/Base64
 */
import React from 'react';
import type { ImageQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';
import GeometryPreview from '../../../../../components/TeacherDashboard/GeometryPreview';
import TikZPreview from '../../../../../components/common/TikZPreview';

// Legacy field not in the typed interface — safe extension
type ImageQuestionWithLegacy = ImageQuestion & {
    geometry?: string | object;
};

interface ImageQuestionRendererProps {
    question: ImageQuestion;
}

const ImageRenderer: React.FC<{ question: ImageQuestionWithLegacy }> = ({ question }) => {
    const { geometry, image } = question;

    if (geometry) {
        if (typeof geometry === 'string' && geometry.includes('\\begin{tikzpicture}')) {
            return <TikZPreview code={geometry} />;
        }
        // Cast via unknown: GeometryPreview accepts GeometryData objects only.
        // string TikZ already handled above, so if we reach here geometry is an object.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return <GeometryPreview data={geometry as any} />;
    }

    if (image) {
        if (image.includes('\\begin{tikzpicture}')) {
            return <TikZPreview code={image} />;
        }
        return <img src={image} alt="Question" className="max-h-32 rounded-lg border" />;
    }

    return null;
};

const ImageQuestionRenderer: React.FC<ImageQuestionRendererProps> = ({ question }) => {
    const q = question as ImageQuestionWithLegacy;

    return (
        <div className="ml-8 space-y-2">
            <ImageRenderer question={q} />
            {question.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                const isCorrect = letter === question.correctAnswer;
                const cleanOpt = opt.replace(/^[A-Da-d][.)]\s*/, '');
                return (
                    <div
                        key={i}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                            isCorrect
                                ? 'bg-green-100 text-green-800 font-semibold'
                                : 'text-gray-600'
                        }`}
                    >
                        <span className="font-bold">{letter}.</span>
                        <NewlineMathText
                            content={cleanOpt}
                            as="span"
                            className="quiz-text-preserve-inline flex-1"
                        />
                        {isCorrect && <span className="ml-auto text-green-600">✓</span>}
                    </div>
                );
            })}
        </div>
    );
};

export default React.memo(ImageQuestionRenderer);
