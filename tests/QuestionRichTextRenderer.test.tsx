import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuestionRichTextRenderer from '../src/components/common/QuestionRichTextRenderer';
import { plainTextToRichText } from '../shared/question-rich-text.contract';

vi.mock('better-react-mathjax', () => ({
    MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../src/components/common/MathSpan', () => ({
    default: ({ content, as: Tag = 'span', className }: {
        content: string;
        as?: React.ElementType;
        className?: string;
    }) => <Tag className={className} data-math-span={content}>{content}</Tag>,
}));

describe('QuestionRichTextRenderer', () => {
    it('renders alignment, marks, hard breaks and lists from the allowlisted JSON', () => {
        const value = plainTextToRichText('unused');
        value.doc.content = [
            {
                type: 'paragraph',
                attrs: { textAlign: 'center' },
                content: [
                    { type: 'text', text: 'Tính $\\frac{1}{2}$', marks: [{ type: 'bold' }, { type: 'underline' }] },
                    { type: 'hardBreak' },
                    { type: 'text', text: 'rồi chọn đáp án.' },
                ],
            },
            {
                type: 'bulletList',
                content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ý thứ nhất' }] }] },
                ],
            },
        ];

        const { container } = render(<QuestionRichTextRenderer value={value} fallback="fallback" />);
        expect(container.querySelector('p')?.style.textAlign).toBe('center');
        expect(container.querySelector('strong')).toHaveTextContent('Tính $\\frac{1}{2}$');
        expect(container.querySelector('u')).toHaveTextContent('Tính $\\frac{1}{2}$');
        expect(container.querySelector('br')).not.toBeNull();
        expect(container.querySelector('ul li')).toHaveTextContent('Ý thứ nhất');
    });

    it('emits one complete math span when a delimited formula crosses marked text nodes', () => {
        const delimiter = String.fromCharCode(36);
        const formula = delimiter + 'x^2' + delimiter;
        const value = plainTextToRichText('unused');
        value.doc.content = [{
            type: 'paragraph',
            content: [
                { type: 'text', text: 'Tính ' + delimiter },
                { type: 'text', text: 'x', marks: [{ type: 'bold' }] },
                { type: 'text', text: '^2' + delimiter + ' rồi trả lời.' },
            ],
        }];

        const { container } = render(<QuestionRichTextRenderer value={value} fallback="fallback" />);
        const rendered = Array.from(container.querySelectorAll('[data-math-span]'))
            .map((node) => node.getAttribute('data-math-span'));

        expect(rendered).toContain(formula);
        expect(rendered).not.toContain(delimiter);
        expect(rendered).not.toContain('x');
        expect(rendered).not.toContain('^2' + delimiter);
        const renderedFormula = Array.from(container.querySelectorAll('[data-math-span]'))
            .find((node) => node.getAttribute('data-math-span') === formula);
        expect(renderedFormula?.closest('strong')).toBeNull();
    });

    it('keeps one continuous mark wrapper when the whole formula range shares that mark', () => {
        const delimiter = String.fromCharCode(36);
        const formula = delimiter + 'x^2' + delimiter;
        const value = plainTextToRichText('unused');
        value.doc.content = [{
            type: 'paragraph',
            content: [
                { type: 'text', text: 'Tính ' + delimiter, marks: [{ type: 'bold' }] },
                { type: 'text', text: 'x', marks: [{ type: 'bold' }] },
                { type: 'text', text: '^2' + delimiter, marks: [{ type: 'bold' }] },
            ],
        }];

        const { container } = render(<QuestionRichTextRenderer value={value} fallback="fallback" />);
        expect(container.querySelectorAll('strong')).toHaveLength(1);
        const renderedFormula = Array.from(container.querySelectorAll('[data-math-span]'))
            .find((node) => node.getAttribute('data-math-span') === formula);
        expect(renderedFormula?.closest('strong')).toBe(container.querySelector('strong'));
    });

    it('reassembles a complete raw TeX command across rich text-node boundaries', () => {
        const slash = String.fromCharCode(92);
        const formula = slash + 'frac{1}{2}';
        const value = plainTextToRichText('unused');
        value.doc.content = [{
            type: 'paragraph',
            content: [
                { type: 'text', text: 'Tính ' + slash + 'fr' },
                { type: 'text', text: 'ac{1}', marks: [{ type: 'italic' }] },
                { type: 'text', text: '{2} rồi trả lời.' },
            ],
        }];

        const { container } = render(<QuestionRichTextRenderer value={value} fallback="fallback" />);
        const rendered = Array.from(container.querySelectorAll('[data-math-span]'))
            .map((node) => node.getAttribute('data-math-span'));

        expect(rendered).toContain(formula);
        expect(rendered).not.toContain(slash + 'fr');
        expect(rendered).not.toContain('ac{1}');
    });

    it('keeps a hard break as a structural boundary instead of joining math through it', () => {
        const delimiter = String.fromCharCode(36);
        const formula = delimiter + 'x^2' + delimiter;
        const value = plainTextToRichText('unused');
        value.doc.content = [{
            type: 'paragraph',
            content: [
                { type: 'text', text: delimiter + 'x' },
                { type: 'hardBreak' },
                { type: 'text', text: '^2' + delimiter },
            ],
        }];

        const { container } = render(<QuestionRichTextRenderer value={value} fallback="fallback" />);
        expect(container.querySelector('br')).not.toBeNull();
        const rendered = Array.from(container.querySelectorAll('[data-math-span]'))
            .map((node) => node.getAttribute('data-math-span'));
        expect(rendered).not.toContain(formula);
    });

    it('falls back to the plain math path when the rich document is invalid', () => {
        const invalid = {
            schemaVersion: 1,
            doc: { type: 'doc', content: [{ type: 'iframe', attrs: { src: 'https://evil.test' } }] },
        } as any;
        const { container } = render(
            <QuestionRichTextRenderer value={invalid} fallback="Fallback $x^2$" />,
        );
        expect(container).toHaveTextContent('Fallback $x^2$');
        expect(container.querySelector('iframe')).toBeNull();
    });

    it('preserves line breaks in the plain fallback used by preview surfaces', () => {
        const fallback = 'Đọc đoạn thơ sau:\nDòng thơ thứ nhất\nDòng thơ thứ hai';
        const { container } = render(
            <QuestionRichTextRenderer fallback={fallback} />,
        );
        const fallbackNode = Array.from(container.querySelectorAll('div')).find((node) => node.textContent === fallback);
        expect(fallbackNode).toBeDefined();
        expect(fallbackNode).toHaveStyle({ whiteSpace: 'pre-line' });
    });

    it('never turns text-node HTML-like strings into executable DOM', () => {
        const value = plainTextToRichText('<script>alert(1)</script><img src=x onerror=evil()>Nội dung');
        const { container } = render(<QuestionRichTextRenderer value={value} fallback="fallback" />);
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
        expect(container).toHaveTextContent('Nội dung');
    });
});
