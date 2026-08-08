import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuestionRichTextRenderer from '../src/components/common/QuestionRichTextRenderer';
import { plainTextToRichText } from '../shared/question-rich-text.contract';

vi.mock('better-react-mathjax', () => ({
    MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

    it('never turns text-node HTML-like strings into executable DOM', () => {
        const value = plainTextToRichText('<script>alert(1)</script><img src=x onerror=evil()>Nội dung');
        const { container } = render(<QuestionRichTextRenderer value={value} fallback="fallback" />);
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
        expect(container).toHaveTextContent('Nội dung');
    });
});
