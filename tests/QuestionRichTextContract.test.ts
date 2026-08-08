import { describe, expect, it } from 'vitest';
import {
    MAX_QUESTION_RICH_TEXT_BYTES,
    QUESTION_HIGHLIGHT_PALETTE,
    QUESTION_TEXT_COLOR_PALETTE,
    deserializeQuestionRichText,
    parseQuestionRichText,
    plainTextToRichText,
    richTextToPlainText,
    serializeQuestionRichText,
} from '../shared/question-rich-text.contract';

const validEnvelope = () => ({
    schemaVersion: 1 as const,
    doc: {
        type: 'doc' as const,
        content: [{
            type: 'paragraph' as const,
            attrs: { textAlign: 'center' as const },
            content: [{
                type: 'text' as const,
                text: 'Nội dung',
                marks: [
                    { type: 'bold' as const },
                    { type: 'textStyle' as const, attrs: { color: QUESTION_TEXT_COLOR_PALETTE[1] } },
                    { type: 'highlight' as const, attrs: { color: QUESTION_HIGHLIGHT_PALETTE[0] } },
                ],
            }],
        }],
    },
});

describe('question rich text contract', () => {
    it('accepts the v1 node and mark allowlist', () => {
        const value = validEnvelope();
        value.doc.content.push(
            {
                type: 'bulletList',
                content: [{
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mục 1' }] }],
                }],
            } as any,
            {
                type: 'orderedList',
                attrs: { start: 1 },
                content: [{
                    type: 'listItem',
                    content: [{
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: 'Dòng 1', marks: [{ type: 'italic' }, { type: 'underline' }, { type: 'strike' }] },
                            { type: 'hardBreak' },
                            { type: 'text', text: 'Dòng 2' },
                        ],
                    }],
                }],
            } as any,
        );

        const parsed = parseQuestionRichText(value);
        expect(parsed.ok).toBe(true);
    });

    it('rejects unsupported nodes, marks, attributes and alignment', () => {
        const rejected = [
            { schemaVersion: 1, doc: { type: 'doc', content: [{ type: 'image', attrs: { src: 'https://example.com/a.png' } }] } },
            { schemaVersion: 1, doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }] }] } },
            { schemaVersion: 1, doc: { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'justify' }, content: [{ type: 'text', text: 'x' }] }] } },
            { schemaVersion: 1, doc: { type: 'doc', content: [{ type: 'paragraph', attrs: { style: 'font-size:72px' }, content: [{ type: 'text', text: 'x' }] }] } },
            { schemaVersion: 1, doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'textStyle', attrs: { color: '#123456' } }] }] }] } },
        ];

        for (const value of rejected) {
            expect(parseQuestionRichText(value).ok).toBe(false);
        }
    });

    it('rejects wrong versions and oversized payloads', () => {
        expect(parseQuestionRichText({ schemaVersion: 2, doc: { type: 'doc', content: [] } }).ok).toBe(false);
        expect(parseQuestionRichText({ doc: { type: 'doc', content: [] } }).ok).toBe(false);

        const huge = plainTextToRichText('x'.repeat(MAX_QUESTION_RICH_TEXT_BYTES + 100));
        expect(parseQuestionRichText(huge).ok).toBe(false);
    });

    it('preserves newlines and TeX in the plain fallback', () => {
        const source = 'Dòng 1\nTính $\\frac{1}{2}$\nRồi trả lời.';
        expect(richTextToPlainText(plainTextToRichText(source))).toBe(source);
    });

    it('converts hard breaks and list items into readable fallback lines', () => {
        const value = {
            schemaVersion: 1 as const,
            doc: {
                type: 'doc' as const,
                content: [
                    {
                        type: 'paragraph' as const,
                        content: [
                            { type: 'text' as const, text: 'Dòng A' },
                            { type: 'hardBreak' as const },
                            { type: 'text' as const, text: 'Dòng B' },
                        ],
                    },
                    {
                        type: 'bulletList' as const,
                        content: [
                            { type: 'listItem' as const, content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Mục 1' }] }] },
                            { type: 'listItem' as const, content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Mục 2' }] }] },
                        ],
                    },
                ],
            },
        };

        expect(richTextToPlainText(value)).toBe('Dòng A\nDòng B\nMục 1\nMục 2');
    });

    it('serializes only valid envelopes and safely deserializes storage values', () => {
        const value = validEnvelope();
        const serialized = serializeQuestionRichText(value);
        expect(serialized).toContain('"schemaVersion":1');
        expect(deserializeQuestionRichText(serialized)).toEqual(value);
        expect(deserializeQuestionRichText('{bad json')).toBeUndefined();
        expect(deserializeQuestionRichText({ schemaVersion: 99 })).toBeUndefined();
        expect(serializeQuestionRichText(undefined)).toBe('');
    });
});
