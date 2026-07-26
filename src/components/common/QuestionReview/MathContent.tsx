import React from 'react';
import MathSpan from '../MathSpan';

interface MathContentProps {
    content: string;
    className?: string;
}

/** Result review uses the same renderer as player and teacher preview. */
const MathContent: React.FC<MathContentProps> = ({ content, className = '' }) => (
    <MathSpan
        content={content}
        as="div"
        className={`math-content ${className} mathjax-skeleton`}
    />
);

export default MathContent;