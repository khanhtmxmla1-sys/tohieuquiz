import React from 'react';
import {
    parseQuestionRichText,
    type QuestionRichTextEnvelopeV1,
    type QuestionRichTextMark,
    type QuestionRichTextNode,
} from '../../../shared/question-rich-text.contract';
import { splitRenderableMathSegments } from '../../utils/mathText';
import MathSpan from './MathSpan';

interface QuestionRichTextRendererProps {
    value?: QuestionRichTextEnvelopeV1;
    fallback: string;
    className?: string;
}

const applyMarksToContent = (
    input: React.ReactNode,
    marks: QuestionRichTextMark[] | undefined,
    key: string,
): React.ReactNode => {
    let content: React.ReactNode = input;
    for (const mark of marks ?? []) {
        switch (mark.type) {
            case 'bold':
                content = <strong>{content}</strong>;
                break;
            case 'italic':
                content = <em>{content}</em>;
                break;
            case 'underline':
                content = <u>{content}</u>;
                break;
            case 'strike':
                content = <s>{content}</s>;
                break;
            case 'textStyle':
                content = <span style={{ color: mark.attrs?.color }}>{content}</span>;
                break;
            case 'highlight':
                content = <span style={{ backgroundColor: mark.attrs?.color }}>{content}</span>;
                break;
            default:
                break;
        }
    }
    return <React.Fragment key={key}>{content}</React.Fragment>;
};

interface InlineTextRun {
    start: number;
    end: number;
    marks?: QuestionRichTextMark[];
}

const markKey = (mark: QuestionRichTextMark): string =>
    `${mark.type}:${mark.attrs?.color ?? ''}`;

const marksSignature = (marks: QuestionRichTextMark[] | undefined): string =>
    (marks ?? []).map(markKey).sort().join('|');

const commonMarks = (runs: InlineTextRun[]): QuestionRichTextMark[] | undefined => {
    if (runs.length === 0) return undefined;
    const candidates = runs[0].marks ?? [];
    const shared = candidates.filter((candidate) => {
        const key = markKey(candidate);
        return runs.every((run) => (run.marks ?? []).some((mark) => markKey(mark) === key));
    });
    return shared.length > 0 ? shared : undefined;
};

interface InlineRenderPiece {
    key: string;
    marks?: QuestionRichTextMark[];
    node: React.ReactNode;
}

const groupInlineRenderPieces = (
    pieces: InlineRenderPiece[],
    keyPrefix: string,
): React.ReactNode[] => {
    const groups: Array<{ marks?: QuestionRichTextMark[]; pieces: InlineRenderPiece[] }> = [];
    for (const piece of pieces) {
        const previous = groups.at(-1);
        if (previous && marksSignature(previous.marks) === marksSignature(piece.marks)) {
            previous.pieces.push(piece);
        } else {
            groups.push({ marks: piece.marks, pieces: [piece] });
        }
    }
    return groups.map((group, index) => applyMarksToContent(
        group.pieces.map((piece) => <React.Fragment key={piece.key}>{piece.node}</React.Fragment>),
        group.marks,
        `${keyPrefix}-marks-${index}`,
    ));
};

const renderTextNodeGroup = (
    nodes: QuestionRichTextNode[],
    keyPrefix: string,
): React.ReactNode[] => {
    let offset = 0;
    const runs: InlineTextRun[] = nodes.map((node) => {
        const text = node.text ?? '';
        const run = { start: offset, end: offset + text.length, marks: node.marks };
        offset = run.end;
        return run;
    });
    const source = nodes.map((node) => node.text ?? '').join('');

    const pieces = splitRenderableMathSegments(source).flatMap<InlineRenderPiece>((segment, segmentIndex) => {
        const contributingRuns = runs.filter((run) => run.start < segment.end && run.end > segment.start);
        if (segment.type === 'math') {
            return [{
                key: `${keyPrefix}-math-${segmentIndex}`,
                marks: commonMarks(contributingRuns),
                node: <MathSpan content={segment.raw} />,
            }];
        }
        return contributingRuns.flatMap<InlineRenderPiece>((run, runIndex) => {
            const start = Math.max(segment.start, run.start);
            const end = Math.min(segment.end, run.end);
            if (end <= start) return [];
            return [{
                key: `${keyPrefix}-text-${segmentIndex}-${runIndex}`,
                marks: run.marks,
                node: <MathSpan content={source.slice(start, end)} />,
            }];
        });
    });
    return groupInlineRenderPieces(pieces, keyPrefix);
};

const renderInlineContent = (nodes: QuestionRichTextNode[] | undefined, keyPrefix: string): React.ReactNode[] => {
    const rendered: React.ReactNode[] = [];
    let textGroup: QuestionRichTextNode[] = [];
    let groupIndex = 0;

    const flushTextGroup = () => {
        if (textGroup.length === 0) return;
        rendered.push(...renderTextNodeGroup(textGroup, `${keyPrefix}-group-${groupIndex}`));
        textGroup = [];
        groupIndex++;
    };

    for (const [index, node] of (nodes ?? []).entries()) {
        if (node.type === 'text') {
            textGroup.push(node);
            continue;
        }
        flushTextGroup();
        if (node.type === 'hardBreak') rendered.push(<br key={`${keyPrefix}-break-${index}`} />);
    }
    flushTextGroup();
    return rendered;
};

const renderParagraph = (
    node: QuestionRichTextNode,
    key: string,
    asListContent = false,
): React.ReactNode => {
    const textAlign = node.attrs?.textAlign ?? 'left';
    if (asListContent) {
        return (
            <div key={key} style={{ textAlign }} className="min-w-0">
                {renderInlineContent(node.content, `${key}-inline`)}
            </div>
        );
    }
    return (
        <p key={key} style={{ textAlign }} className="min-w-0 whitespace-normal">
            {renderInlineContent(node.content, `${key}-inline`)}
        </p>
    );
};

const renderListItem = (node: QuestionRichTextNode, key: string): React.ReactNode => (
    <li key={key} className="pl-1">
        {(node.content ?? []).map((child, index) => (
            child.type === 'paragraph'
                ? renderParagraph(child, `${key}-paragraph-${index}`, true)
                : null
        ))}
    </li>
);

const renderBlock = (node: QuestionRichTextNode, index: number): React.ReactNode => {
    const key = `rich-block-${index}`;
    switch (node.type) {
        case 'paragraph':
            return renderParagraph(node, key);
        case 'bulletList':
            return (
                <ul key={key} className="list-disc space-y-1 pl-6">
                    {(node.content ?? []).map((item, itemIndex) => renderListItem(item, `${key}-item-${itemIndex}`))}
                </ul>
            );
        case 'orderedList':
            return (
                <ol key={key} start={node.attrs?.start ?? 1} className="list-decimal space-y-1 pl-6">
                    {(node.content ?? []).map((item, itemIndex) => renderListItem(item, `${key}-item-${itemIndex}`))}
                </ol>
            );
        default:
            return null;
    }
};

const QuestionRichTextRenderer: React.FC<QuestionRichTextRendererProps> = ({
    value,
    fallback,
    className,
}) => {
    const parsed = value ? parseQuestionRichText(value) : { ok: false as const, error: 'missing' };
    if (!parsed.ok) {
        return (
            <div className={className} style={{ whiteSpace: 'pre-line' }}>
                <MathSpan content={fallback} />
            </div>
        );
    }

    return (
        <div className={className} data-testid="question-rich-text-renderer">
            <div className="space-y-2">
                {parsed.value.doc.content.map(renderBlock)}
            </div>
        </div>
    );
};

export default React.memo(QuestionRichTextRenderer);
