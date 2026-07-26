/**
 * WordScrambleRenderer.tsx
 * Renders a Word Scramble (ghép chữ) question in read-only mode.
 */
import React from 'react';
import type { WordScrambleQuestion } from '../../../../../types';
import { NewlineMathText } from '../../../../../components/common';

interface WordScrambleRendererProps {
    question: WordScrambleQuestion;
}

const WordScrambleRenderer: React.FC<WordScrambleRendererProps> = ({ question }) => (
    <div className="ml-8 space-y-2">
        <div className="flex flex-wrap gap-1">
            <span className="text-sm text-gray-500 mr-2">Chữ cái:</span>
            {question.letters.map((letter, i) => (
                <span
                    key={i}
                    className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 rounded font-bold text-sm"
                >
                    {letter}
                </span>
            ))}
        </div>
        <p className="text-sm">
            <span className="text-gray-500">Đáp án:</span>
            <NewlineMathText
                content={question.correctWord}
                as="span"
                className="font-bold text-green-700 ml-2 quiz-text-preserve-inline"
            />
        </p>
        {question.hint && (
            <p className="text-xs text-amber-600 italic">
                💡 Gợi ý:{' '}
                <NewlineMathText
                    content={question.hint}
                    as="span"
                    className="quiz-text-preserve-inline"
                />
            </p>
        )}
    </div>
);

export default React.memo(WordScrambleRenderer);
