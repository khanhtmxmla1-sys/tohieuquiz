import React from 'react';
import MathSpan from './MathSpan';

type WrapperTag = 'div' | 'span' | 'p';

interface NewlineMathTextProps {
    content: unknown;
    className?: string;
    lineClassName?: string;
    as?: WrapperTag;
}

const toRenderableString = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map((item) => toRenderableString(item)).join(', ');
    return String(value);
};

export const normalizePreservedText = (value: unknown): string => {
    return toRenderableString(value)
        .replace(/\r\n?/g, '\n')
        .replace(/\\n/g, '\n');
};

export const renderMathWithNewlines = (
    value: unknown,
    keyPrefix: string,
    lineClassName?: string
): React.ReactNode[] => {
    const lines = normalizePreservedText(value).split('\n');

    return lines.map((line, idx) => (
        <React.Fragment key={`${keyPrefix}-${idx}`}>
            {line ? <MathSpan content={line} className={lineClassName} /> : null}
            {idx < lines.length - 1 && <br />}
        </React.Fragment>
    ));
};

const NewlineMathText: React.FC<NewlineMathTextProps> = ({
    content,
    className,
    lineClassName,
    as = 'span',
}) => {
    const Tag = as;
    return (
        <Tag className={className}>
            {renderMathWithNewlines(content, 'nlm', lineClassName)}
        </Tag>
    );
};

export default NewlineMathText;
