import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
    plainTextToRichText,
    richTextToPlainText,
    type QuestionRichTextEnvelopeV1,
} from '../shared/question-rich-text.contract';
import RichQuestionEditor, {
    normalizeTiptapQuestionDoc,
    type RichQuestionEditorAdapter,
} from '../src/features/quiz-editor/components/RichQuestionEditor/RichQuestionEditor';

beforeAll(() => {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({}),
    }) as DOMRect;
});

const renderEditor = (source = '') => {
    const onChange = vi.fn<(value: QuestionRichTextEnvelopeV1, plain: string) => void>();
    let adapter: RichQuestionEditorAdapter | null = null;
    render(
        <RichQuestionEditor
            value={plainTextToRichText(source)}
            onChange={onChange}
            onEditorReady={(next) => { adapter = next; }}
        />,
    );
    return {
        onChange,
        getAdapter: () => adapter,
    };
};

describe('RichQuestionEditor', () => {
    it('renders initial content in an accessible editor', async () => {
        renderEditor('Câu hỏi ban đầu');
        const editor = await screen.findByTestId('question-rich-editor');
        expect(editor).toHaveAttribute('aria-label', 'Nội dung câu hỏi');
        expect(editor).toHaveTextContent('Câu hỏi ban đầu');
    });

    it('emits structured JSON and a matching plain fallback when text changes', async () => {
        const { onChange, getAdapter } = renderEditor('');
        await waitFor(() => expect(getAdapter()).not.toBeNull());

        getAdapter()!.insertText('Tính $\\frac{1}{2}$');

        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const [value, plain] = onChange.mock.calls.at(-1)!;
        expect(value.schemaVersion).toBe(1);
        expect(richTextToPlainText(value)).toBe('Tính $\\frac{1}{2}$');
        expect(plain).toBe('Tính $\\frac{1}{2}$');
    });

    it('renders the focused formatting toolbar with accessible toggle state', async () => {
        renderEditor('Nội dung');
        await screen.findByTestId('question-rich-editor');

        for (const name of [
            'Hoàn tác', 'Làm lại', 'In đậm', 'In nghiêng', 'Gạch chân', 'Gạch ngang',
            'Căn trái', 'Căn giữa', 'Căn phải', 'Danh sách dấu đầu dòng',
            'Danh sách đánh số', 'Xóa định dạng',
        ]) {
            expect(screen.getByRole('button', { name })).toBeInTheDocument();
        }
        expect(screen.getByRole('button', { name: 'In đậm' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'Căn trái' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getAllByRole('button', { name: /^Màu chữ / })).toHaveLength(6);
        expect(screen.getAllByRole('button', { name: /^Tô nền / })).toHaveLength(5);
    });

    it('applies bold, alignment and list commands through toolbar buttons', async () => {
        const { onChange, getAdapter } = renderEditor('');
        await screen.findByTestId('question-rich-editor');
        await waitFor(() => expect(getAdapter()).not.toBeNull());

        fireEvent.click(screen.getByRole('button', { name: 'In đậm' }));
        getAdapter()!.insertText('Đậm');
        await waitFor(() => expect(onChange).toHaveBeenCalled());
        let latest = onChange.mock.calls.at(-1)![0];
        expect(latest.doc.content[0].content?.[0].marks).toContainEqual({ type: 'bold' });

        fireEvent.click(screen.getByRole('button', { name: 'Căn giữa' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Căn giữa' })).toHaveAttribute('aria-pressed', 'true'));
        latest = onChange.mock.calls.at(-1)![0];
        expect(latest.doc.content[0].attrs?.textAlign).toBe('center');

        fireEvent.click(screen.getByRole('button', { name: 'Danh sách dấu đầu dòng' }));
        await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0].doc.content[0].type).toBe('bulletList'));
    });

    it('limits hostile pasted/editor JSON to the persisted allowlist', () => {
        const normalized = normalizeTiptapQuestionDoc({
            type: 'doc',
            content: [
                { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Bỏ heading' }] },
                {
                    type: 'paragraph',
                    attrs: { textAlign: 'justify', style: 'font-size:72px' },
                    content: [{
                        type: 'text',
                        text: 'Giữ chữ',
                        marks: [
                            { type: 'link', attrs: { href: 'javascript:alert(1)' } },
                            { type: 'textStyle', attrs: { color: '#123456' } },
                            { type: 'bold' },
                        ],
                    }],
                },
                { type: 'image', attrs: { src: 'data:image/svg+xml,<svg onload=alert(1) />' } },
            ],
        });

        expect(normalized.content).toHaveLength(1);
        expect(normalized.content[0].type).toBe('paragraph');
        expect(normalized.content[0].attrs).toBeUndefined();
        expect(normalized.content[0].content?.[0].marks).toEqual([{ type: 'bold' }]);
    });

    it('accepts a genuine external document change when the editor is not focused', async () => {
        const onChange = vi.fn<(value: QuestionRichTextEnvelopeV1, plain: string) => void>();
        const { rerender } = render(
            <RichQuestionEditor value={plainTextToRichText('Câu A')} onChange={onChange} />,
        );
        const editor = await screen.findByTestId('question-rich-editor');
        expect(editor).toHaveTextContent('Câu A');

        rerender(
            <RichQuestionEditor value={plainTextToRichText('Câu B')} onChange={onChange} />,
        );

        await waitFor(() => expect(editor).toHaveTextContent('Câu B'));
    });

    it('does not overwrite newer local typing when a controlled prop echo arrives late', async () => {
        const onChange = vi.fn<(value: QuestionRichTextEnvelopeV1, plain: string) => void>();
        let adapter: RichQuestionEditorAdapter | null = null;
        const onEditorReady = (next: RichQuestionEditorAdapter) => { adapter = next; };
        const initial = plainTextToRichText('');
        const { rerender } = render(
            <RichQuestionEditor value={initial} onChange={onChange} onEditorReady={onEditorReady} />,
        );
        const editor = await screen.findByTestId('question-rich-editor');
        await waitFor(() => expect(adapter).not.toBeNull());

        adapter!.insertText('A');
        await waitFor(() => expect(onChange.mock.calls.at(-1)?.[1]).toBe('A'));
        const staleEcho = onChange.mock.calls.at(-1)![0];

        adapter!.insertText('B');
        await waitFor(() => expect(onChange.mock.calls.at(-1)?.[1]).toBe('AB'));
        expect(editor).toHaveTextContent('AB');

        rerender(
            <RichQuestionEditor value={staleEcho} onChange={onChange} onEditorReady={onEditorReady} />,
        );

        await waitFor(() => expect(editor).toHaveTextContent('AB'));
    });

    it('uses Enter for a new paragraph and Shift+Enter for a hard break', async () => {
        const { onChange, getAdapter } = renderEditor('');
        const editor = await screen.findByTestId('question-rich-editor');
        await waitFor(() => expect(getAdapter()).not.toBeNull());

        getAdapter()!.insertText('Dòng 1');
        fireEvent.keyDown(editor, { key: 'Enter', code: 'Enter' });
        getAdapter()!.insertText('Dòng 2');

        await waitFor(() => expect(onChange.mock.calls.at(-1)?.[1]).toBe('Dòng 1\nDòng 2'));
        let latest = onChange.mock.calls.at(-1)![0];
        expect(latest.doc.content.filter((node) => node.type === 'paragraph')).toHaveLength(2);

        fireEvent.keyDown(editor, { key: 'Enter', code: 'Enter', shiftKey: true });
        getAdapter()!.insertText('Dòng 3');

        await waitFor(() => expect(onChange.mock.calls.at(-1)?.[1]).toBe('Dòng 1\nDòng 2\nDòng 3'));
        latest = onChange.mock.calls.at(-1)![0];
        const secondParagraph = latest.doc.content[1];
        expect(secondParagraph.content?.some((node) => node.type === 'hardBreak')).toBe(true);
    });
});
