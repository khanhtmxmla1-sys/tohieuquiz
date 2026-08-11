import React, { useMemo } from 'react';
import { MathJax } from 'better-react-mathjax';
import { hasMathSyntax, normalizeMathText } from '../../utils/mathText';
import SafeFormattedText from './SafeFormattedText';

type WrapperTag = 'span' | 'div' | 'p';

interface MathSpanProps {
    content: unknown;
    className?: string;
    as?: WrapperTag;
}

/** Shared renderer for safe inline formatting and TeX math. */
const MathSpan: React.FC<MathSpanProps> = React.memo(({ content, className, as = 'span' }) => {
    const source = useMemo(() => normalizeMathText(content), [content]);
    const containsMath = hasMathSyntax(source);
    const hasDisplayMath = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/.test(source);
    const Tag = as;
    const body = <SafeFormattedText content={source} />;
    const responsiveClassName = hasDisplayMath
        ? `block min-w-0 max-w-full overflow-x-auto overflow-y-hidden ${className || ''}`
        : className;

    return (
        <Tag className={responsiveClassName} style={{ whiteSpace: 'pre-line' }}>
            {containsMath ? (
                <MathJax key={source} inline={!hasDisplayMath} dynamic hideUntilTypeset="first">
                    <span>{body}</span>
                </MathJax>
            ) : body}
        </Tag>
    );
});

export default MathSpan;
