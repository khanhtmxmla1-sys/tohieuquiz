import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import {
    QUESTION_HIGHLIGHT_PALETTE,
    QUESTION_RICH_TEXT_SCHEMA_VERSION,
    QUESTION_TEXT_COLOR_PALETTE,
    parseQuestionRichText,
    richTextToPlainText,
    type QuestionRichTextDoc,
    type QuestionRichTextEnvelopeV1,
    type QuestionRichTextMark,
    type QuestionRichTextNode,
} from '../../../../../shared/question-rich-text.contract';
import { insertMathTemplate } from '../../../manual-quiz-workspace/math-composer/mathInsertion';
import { useOptionalMathComposer } from '../../../manual-quiz-workspace/math-composer/useMathComposer';
import { richQuestionExtensions } from './richQuestionExtensions';
import RichQuestionToolbar from './RichQuestionToolbar';

export interface RichQuestionEditorAdapter {
    focus(): void;
    insertText(text: string): boolean;
    replaceSelection(text: string, caretOffset?: number): boolean;
    selectedText(): string;
    setSelectionToEnd(): void;
    getValue(): QuestionRichTextEnvelopeV1;
}

interface RichQuestionEditorProps {
    value: QuestionRichTextEnvelopeV1;
    onChange: (value: QuestionRichTextEnvelopeV1, plainText: string) => void;
    ariaLabel?: string;
    minHeightClassName?: string;
    onEditorReady?: (adapter: RichQuestionEditorAdapter) => void;
}

const textColors = new Set<string>(QUESTION_TEXT_COLOR_PALETTE);
const highlightColors = new Set<string>(QUESTION_HIGHLIGHT_PALETTE);

const normalizeMarks = (marks: JSONContent['marks']): QuestionRichTextMark[] | undefined => {
    if (!Array.isArray(marks)) return undefined;
    const normalized = marks.flatMap<QuestionRichTextMark>((mark) => {
        if (mark.type === 'bold' || mark.type === 'italic' || mark.type === 'underline' || mark.type === 'strike') {
            return [{ type: mark.type }];
        }
        if (mark.type === 'textStyle') {
            const color = typeof mark.attrs?.color === 'string' ? mark.attrs.color : '';
            return textColors.has(color) ? [{ type: 'textStyle', attrs: { color } }] : [];
        }
        if (mark.type === 'highlight') {
            const color = typeof mark.attrs?.color === 'string' ? mark.attrs.color : '';
            return highlightColors.has(color) ? [{ type: 'highlight', attrs: { color } }] : [];
        }
        return [];
    });
    return normalized.length > 0 ? normalized : undefined;
};

const normalizeNode = (node: JSONContent): QuestionRichTextNode | null => {
    switch (node.type) {
        case 'text': {
            const marks = normalizeMarks(node.marks);
            return {
                type: 'text',
                text: node.text ?? '',
                ...(marks ? { marks } : {}),
            };
        }
        case 'hardBreak':
            return { type: 'hardBreak' };
        case 'paragraph': {
            const textAlign = node.attrs?.textAlign;
            const content = (node.content ?? [])
                .map(normalizeNode)
                .filter((item): item is QuestionRichTextNode => Boolean(item));
            return {
                type: 'paragraph',
                ...(textAlign === 'left' || textAlign === 'center' || textAlign === 'right'
                    ? { attrs: { textAlign } }
                    : {}),
                ...(content.length > 0 ? { content } : {}),
            };
        }
        case 'listItem': {
            const content = (node.content ?? [])
                .map(normalizeNode)
                .filter((item): item is QuestionRichTextNode => item?.type === 'paragraph');
            return { type: 'listItem', ...(content.length > 0 ? { content } : {}) };
        }
        case 'bulletList': {
            const content = (node.content ?? [])
                .map(normalizeNode)
                .filter((item): item is QuestionRichTextNode => item?.type === 'listItem');
            return { type: 'bulletList', ...(content.length > 0 ? { content } : {}) };
        }
        case 'orderedList': {
            const content = (node.content ?? [])
                .map(normalizeNode)
                .filter((item): item is QuestionRichTextNode => item?.type === 'listItem');
            const start = Number(node.attrs?.start);
            return {
                type: 'orderedList',
                ...(Number.isInteger(start) && start >= 1 && start <= 999 ? { attrs: { start } } : {}),
                ...(content.length > 0 ? { content } : {}),
            };
        }
        case 'doc': {
            const content = (node.content ?? [])
                .map(normalizeNode)
                .filter((item): item is QuestionRichTextNode =>
                    item?.type === 'paragraph' || item?.type === 'bulletList' || item?.type === 'orderedList');
            return { type: 'doc', content };
        }
        default:
            return null;
    }
};

export const normalizeTiptapQuestionDoc = (doc: JSONContent): QuestionRichTextDoc => {
    const normalized = normalizeNode(doc);
    if (normalized?.type === 'doc' && Array.isArray(normalized.content)) {
        return normalized as QuestionRichTextDoc;
    }
    return { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'left' } }] };
};

const envelopeFromEditor = (doc: JSONContent): QuestionRichTextEnvelopeV1 => ({
    schemaVersion: QUESTION_RICH_TEXT_SCHEMA_VERSION,
    doc: normalizeTiptapQuestionDoc(doc),
});

const RichQuestionEditor: React.FC<RichQuestionEditorProps> = ({
    value,
    onChange,
    ariaLabel = 'Nội dung câu hỏi',
    minHeightClassName = 'min-h-56',
    onEditorReady,
}) => {
    const mathComposer = useOptionalMathComposer();
    const localEchoKeysRef = useRef<string[]>([]);
    const editor = useEditor({
        extensions: richQuestionExtensions,
        content: value.doc as JSONContent,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                'aria-label': ariaLabel,
                'data-testid': 'question-rich-editor',
                class: `prose prose-slate max-w-none px-4 py-3 text-sm leading-7 outline-none ${minHeightClassName}`,
            },
        },
        onUpdate: ({ editor: currentEditor }) => {
            const envelope = envelopeFromEditor(currentEditor.getJSON());
            const parsed = parseQuestionRichText(envelope);
            if (!parsed.ok) return;
            const localKey = JSON.stringify(parsed.value.doc);
            const localKeys = localEchoKeysRef.current;
            if (localKeys.at(-1) !== localKey) {
                localKeys.push(localKey);
                if (localKeys.length > 128) localKeys.splice(0, localKeys.length - 128);
            }
            onChange(parsed.value, richTextToPlainText(parsed.value));
        },
    });

    const valueKey = useMemo(() => JSON.stringify(value.doc), [value.doc]);

    useEffect(() => {
        if (!editor) return;
        const current = JSON.stringify(normalizeTiptapQuestionDoc(editor.getJSON()));
        const echoIndex = localEchoKeysRef.current.lastIndexOf(valueKey);
        const isLocalEcho = echoIndex >= 0;
        if (isLocalEcho) {
            localEchoKeysRef.current = localEchoKeysRef.current.slice(echoIndex + 1);
        }
        if (current === valueKey || isLocalEcho) return;

        localEchoKeysRef.current = [];
        editor.commands.setContent(value.doc as JSONContent, { emitUpdate: false });
    }, [editor, value.doc, valueKey]);

    const getValue = useCallback((): QuestionRichTextEnvelopeV1 => {
        if (!editor) return value;
        return envelopeFromEditor(editor.getJSON());
    }, [editor, value]);

    const selectedText = useCallback((): string => {
        if (!editor) return '';
        const { from, to } = editor.state.selection;
        return editor.state.doc.textBetween(from, to, '\n');
    }, [editor]);

    const replaceSelection = useCallback((text: string, caretOffset = text.length): boolean => {
        if (!editor) return false;
        const insertionStart = editor.state.selection.from;
        const inserted = editor.chain().focus().insertContent(text).run();
        if (!inserted) return false;
        const nextPosition = Math.max(
            1,
            Math.min(insertionStart + caretOffset, editor.state.doc.content.size),
        );
        editor.commands.setTextSelection(nextPosition);
        editor.commands.focus();
        return true;
    }, [editor]);

    useEffect(() => {
        if (!editor || !onEditorReady) return;
        const adapter: RichQuestionEditorAdapter = {
            focus: () => editor.commands.focus(),
            insertText: (text) => editor.chain().focus().insertContent(text).run(),
            replaceSelection,
            selectedText,
            setSelectionToEnd: () => editor.commands.setTextSelection(editor.state.doc.content.size),
            getValue,
        };
        onEditorReady(adapter);
    }, [editor, getValue, onEditorReady, replaceSelection, selectedText]);

    const registerMathTarget = useCallback(() => {
        if (!editor || !mathComposer) return;
        mathComposer.registerTarget({
            label: ariaLabel,
            selectedText,
            insertTemplate: (templateId, values = {}) => {
                const selected = selectedText();
                const result = insertMathTemplate({
                    value: selected,
                    selectionStart: 0,
                    selectionEnd: selected.length,
                    template: templateId,
                    values,
                });
                return replaceSelection(result.value, result.selectionStart) ? result : null;
            },
        });
    }, [ariaLabel, editor, mathComposer, replaceSelection, selectedText]);

    useEffect(() => {
        if (!editor || !mathComposer) return;
        editor.on('focus', registerMathTarget);
        editor.on('selectionUpdate', registerMathTarget);
        return () => {
            editor.off('focus', registerMathTarget);
            editor.off('selectionUpdate', registerMathTarget);
        };
    }, [editor, mathComposer, registerMathTarget]);

    if (!editor) {
        return <div className={`rounded-xl border border-slate-200 bg-white ${minHeightClassName}`} aria-busy="true" />;
    }

    return (
        <div className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
            <RichQuestionToolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
};

export default RichQuestionEditor;
