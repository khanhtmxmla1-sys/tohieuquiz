import React from 'react';
import {
    parseQuestionRichText,
    type QuestionRichTextEnvelopeV1,
    type QuestionRichTextMark,
    type QuestionRichTextNode,
} from '../../../shared/question-rich-text.contract';
import MathSpan from './MathSpan';

interface QuestionRichTextRendererProps {
    value?: QuestionRichTextEnvelopeV1;
    fallback: string;
    className?: string;
}

const applyMarks = (
    text: string,
    marks: QuestionRichTextMark[] | undefined,
    key: string,
): React.ReactNode => {
    let content: React.ReactNode = <MathSpan content={text} />;
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

const renderInlineContent = (nodes: QuestionRichTextNode[] | undefined, keyPrefix: string): React.ReactNode[] =>
    (nodes ?? []).map((node, index) => {
        const key = `${keyPrefix}-${index}`;
        if (node.type === 'text') return applyMarks(node.text ?? '', node.marks, key);
        if (node.type === 'hardBreak') return <br key={key} />;
        return <React.Fragment key={key} />;
    });

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
        return <MathSpan content={fallback} as="div" className={className} />;
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
