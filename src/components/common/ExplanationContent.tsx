import React, { useMemo } from 'react';
import { MathJax } from 'better-react-mathjax';
import { hasMathSyntax, normalizeMathText } from '../../utils/mathText';
import SafeFormattedText from './SafeFormattedText';

interface ExplanationContentProps {
    content: string;
    className?: string;
}

interface ExplanationLine {
    kind: 'numbered' | 'bullet' | 'paragraph';
    marker?: string;
    content: string;
}

const parseExplanationLines = (content: string): ExplanationLine[] => {
    const cleaned = content.replace(/^#{1,6}\s*/gm, '');
    return cleaned
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const numbered = line.match(/^(\d+)\.\s*(.*)$/);
            if (numbered) return { kind: 'numbered', marker: `${numbered[1]}.`, content: numbered[2] };
            const bullet = line.match(/^[-*•]\s*(.*)$/);
            if (bullet) return { kind: 'bullet', marker: '•', content: bullet[1] };
            return { kind: 'paragraph', content: line };
        });
};

const ExplanationContent: React.FC<ExplanationContentProps> = React.memo(({ content, className }) => {
    const normalized = useMemo(() => normalizeMathText(content), [content]);
    const lines = useMemo(() => parseExplanationLines(normalized), [normalized]);
    const body = (
        <div className={`explanation-content ${className || ''}`}>
            {lines.map((line, index) => line.kind === 'paragraph' ? (
                <p key={`explanation-${index}`} className="explanation-paragraph">
                    <SafeFormattedText content={line.content} enableMarkdown />
                </p>
            ) : (
                <div key={`explanation-${index}`} className="explanation-item">
                    <span className="item-bullet">{line.marker}</span>
                    <span className="item-content">
                        <SafeFormattedText content={line.content} enableMarkdown />
                    </span>
                </div>
            ))}
        </div>
    );

    return hasMathSyntax(normalized)
        ? <MathJax key={normalized} dynamic hideUntilTypeset="first">{body}</MathJax>
        : body;
});

export default ExplanationContent;