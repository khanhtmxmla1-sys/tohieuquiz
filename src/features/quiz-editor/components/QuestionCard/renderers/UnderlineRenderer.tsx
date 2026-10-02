/**
 * UnderlineRenderer.tsx
 * Renders an Underline (gạch chân từ đúng) question in read-only mode.
 */
import React from 'react';
import type { UnderlineQuestion } from '../../../../../types';
import { UnderlineSentence } from '../../../../../components/common/UnderlineSentence';

interface UnderlineRendererProps {
    question: UnderlineQuestion;
}

const UnderlineRenderer: React.FC<UnderlineRendererProps> = ({ question }) => (
    <div className="ml-8 space-y-2">
        <p className="text-sm text-gray-600 mb-2">
            <strong>Câu:</strong>{' '}
            <UnderlineSentence
                sentence={question.sentence}
                words={question.words}
                stateForIndex={(index) =>
                    question.correctWordIndexes.includes(index) ? 'correct' : 'idle'
                }
            />
        </p>
    </div>
);

export default React.memo(UnderlineRenderer);
