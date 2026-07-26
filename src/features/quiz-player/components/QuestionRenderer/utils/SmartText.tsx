import React from 'react';
import MathSpan from '../atoms/MathSpan';
import { hasMathSyntax } from '../../../../../utils/mathText';

interface SmartTextProps {
    content: string;
    className?: string;
}

/**
 * SmartText: Renders text by automatically choosing between plain text, 
 * MathJax, or safe HTML rendering.
 */
const SmartText: React.FC<SmartTextProps> = ({ content, className }) => {
    if (!content && content !== '0') return null;

    const text = String(content);
    
    // If it contains math delimiters or HTML-like patterns
    const hasMath = hasMathSyntax(text);
    const hasHtml = /<[^>]+>/.test(text);

    if (hasMath || hasHtml) {
        return <MathSpan content={text} className={className} />;
    }

    return <span className={className}>{text}</span>;
};

export default React.memo(SmartText);
