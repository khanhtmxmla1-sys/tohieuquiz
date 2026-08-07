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

const MATH_TOKEN_OPEN = '\uE100';
const MATH_TOKEN_CLOSE = '\uE101';
const mathTokenPattern = () => new RegExp(`${MATH_TOKEN_OPEN}(\\d+)${MATH_TOKEN_CLOSE}`, 'g');

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

const renderMaskedLiteral = (
    value: string,
    mathSegments: string[],
    keyPrefix: string,
): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    const pattern = mathTokenPattern();
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(value)) !== null) {
        if (match.index > cursor) nodes.push(value.slice(cursor, match.index));
        const mathIndex = Number.parseInt(match[1], 10);
        nodes.push(
            <React.Fragment key={`${keyPrefix}-math-${mathIndex}-${match.index}`}>
                {mathSegments[mathIndex] ?? match[0]}
            </React.Fragment>,
        );
        cursor = pattern.lastIndex;
    }

    if (cursor < value.length) nodes.push(value.slice(cursor));
    return nodes;
};

const renderFormattedSegment = (
    value: string,
    keyPrefix: string,
    enableMarkdown: boolean,
    mathSegments: string[],
): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    let remaining = value;
    let sequence = 0;

    while (remaining) {
        const match = findFirstMarkup(remaining, enableMarkdown);
        if (!match) {
            nodes.push(...renderMaskedLiteral(remaining, mathSegments, `${keyPrefix}-literal-${sequence}`));
            break;
        }

        const index = match.index ?? 0;
        if (index > 0) {
            nodes.push(...renderMaskedLiteral(
                remaining.slice(0, index),
                mathSegments,
                `${keyPrefix}-before-${sequence}`,
            ));
        }

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
            <Tag key={`${keyPrefix}-style-${sequence}`}>
                {renderFormattedSegment(inner, `${keyPrefix}-inner-${sequence}`, enableMarkdown, mathSegments)}
            </Tag>,
        );
        sequence += 1;
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
    const mathSegments: string[] = [];
    const masked = splitMathSegments(normalized)
        .map((segment) => {
            if (segment.type !== 'math') return segment.raw;
            const index = mathSegments.push(segment.raw) - 1;
            return `${MATH_TOKEN_OPEN}${index}${MATH_TOKEN_CLOSE}`;
        })
        .join('');

    return <>{renderFormattedSegment(masked, 'safe-text', enableMarkdown, mathSegments)}</>;
};

export default React.memo(SafeFormattedText);
