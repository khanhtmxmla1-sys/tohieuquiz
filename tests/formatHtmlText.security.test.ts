import { describe, expect, it } from 'vitest';
import { formatHtmlText } from '../src/utils/formatters';

describe('formatHtmlText security guard', () => {
    it('escapes script tags and event-handler attributes', () => {
        const html = formatHtmlText('<script>alert(1)</script><img src=x onerror="alert(2)">');

        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).toContain('&lt;img src=x onerror=&quot;alert(2)&quot;&gt;');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('onerror="alert(2)"');
    });

    it('keeps only the explicit safe inline tags', () => {
        const html = formatHtmlText('<u>under</u> <b>bold</b> <i>italic</i> <em>em</em> <strong>strong</strong>');

        expect(html).toBe('<u>under</u> <b>bold</b> <i>italic</i> <em>em</em> <strong>strong</strong>');
    });

    it('escapes attributes even on otherwise allowed tags', () => {
        const html = formatHtmlText('<u onclick="alert(1)">unsafe underline</u>');

        expect(html).toBe('&lt;u onclick=&quot;alert(1)&quot;&gt;unsafe underline</u>');
        expect(html).not.toContain('<u onclick=');
    });

    it('converts underscore phonetics to underline without enabling arbitrary HTML', () => {
        const html = formatHtmlText('Choose _a_ not <span>span</span>');

        expect(html).toContain('Choose <u>a</u>');
        expect(html).toContain('&lt;span&gt;span&lt;/span&gt;');
    });
    it('does not turn TeX subscripts into underline HTML', () => {
        expect(formatHtmlText('$a_b_c$')).toBe('$a_b_c$');
        expect(formatHtmlText('$x_{12}$')).toBe('$x_{12}$');
    });

});
