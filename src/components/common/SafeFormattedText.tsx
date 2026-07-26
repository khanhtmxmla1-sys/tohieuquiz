import React from 'react';
import { normalizeMathText, splitMathSegments } from '../../utils/mathText';

interface SafeFormattedTextProps {
    content: unknown;
    enableMarkdown?: boolean;
}

const TAG_COMPONENTS: Record<string, React.ElementType> = {
    u: 'u',
    b: 'b',
    i: 'i',
    em: 'em',
    strong: 'strong',
};

const findFirstMarkup = (value: string, enableMarkdown: boolean): RegExpExecArray | null => {
    const tagMatch = /<(u|b|i|em|strong)>([\s\S]*?)<\/\1>/i.exec(value);
    const underline = /_([^_\s]+)_/.exec(value);
    const candidates: Array<RegExpExecArray | null> = [tagMatch, underline];
    if (enableMarkdown) {
        candidates.push(/\*\*([^*]+)\*\*/.exec(value));
        candidates.push(/\*([^*]+)\*/.exec(value));
    }
    return candidates
        .filter((match): match is RegExpExecArray => Boolean(match))
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0] ?? null;
};

const renderPlainSegment = (
    value: string,
    keyPrefix: string,
    enableMarkdown: boolean,
): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    let remaining = value;
    let sequence = 0;

    while (remaining) {
        const match = findFirstMarkup(remaining, enableMarkdown);
        if (!match) {
            nodes.push(remaining);
            break;
        }

        const index = match.index ?? 0;
        if (index > 0) nodes.push(remaining.slice(0, index));

        let tagName: keyof React.JSX.IntrinsicElements = 'u';
        let inner = '';
        if (match[0].startsWith('<')) {
            tagName = match[1].toLowerCase() as keyof React.JSX.IntrinsicElements;
            inner = match[2];
        } else if (match[0].startsWith('**')) {
            tagName = 'strong';
            inner = match[1];
        } else if (match[0].startsWith('*')) {
            tagName = 'em';
            inner = match[1];
        } else {
            tagName = 'u';
            inner = match[1];
        }

        const Tag = TAG_COMPONENTS[tagName] ?? tagName;
        nodes.push(
            <Tag key={`${keyPrefix}-style-${sequence++}`}>
                {renderPlainSegment(inner, `${keyPrefix}-inner-${sequence}`, enableMarkdown)}
            </Tag>,
        );
        remaining = remaining.slice(index + match[0].length);
    }

    return nodes;
};

/**
 * Render a tiny formatting allowlist as React nodes. Unknown HTML stays visible as text,
 * so no raw HTML API is needed and TeX segments remain untouched.
 */
const SafeFormattedText: React.FC<SafeFormattedTextProps> = ({ content, enableMarkdown = false }) => {
    const normalized = normalizeMathText(content);
    return (
        <>
            {splitMathSegments(normalized).map((segment, index) => (
                <React.Fragment key={`safe-text-${index}`}>
                    {segment.type === 'math'
                        ? segment.raw
                        : renderPlainSegment(segment.raw, `safe-text-${index}`, enableMarkdown)}
                </React.Fragment>
            ))}
        </>
    );
};

export default React.memo(SafeFormattedText);