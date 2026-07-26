import { describe, expect, it } from 'vitest';
import {
  buildSelectedOcrText,
  parseOcrDocument,
} from '../src/services/ai/schemas/ocrDocumentSchema';

describe('OCR document schema', () => {
  it('rejects empty OCR pages', () => {
    expect(() => parseOcrDocument({
      pages: [{ pageNumber: 1, text: '' }],
      warnings: [],
      wasTruncated: false,
    })).toThrow();
  });

  it('normalizes page order and limits page text to 20,000 characters', () => {
    const result = parseOcrDocument({
      pages: [
        { pageNumber: 2, text: 'B'.repeat(25_000) },
        { pageNumber: 1, text: 'Trang một' },
      ],
      warnings: [],
      wasTruncated: false,
    });

    expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    expect(result.pages[1].text).toHaveLength(20_000);
    expect(result.wasTruncated).toBe(true);
  });

  it('builds generation content from selected pages only', () => {
    const document = parseOcrDocument({
      pages: [
        { pageNumber: 1, text: 'Nội dung một' },
        { pageNumber: 2, text: 'Nội dung hai' },
        { pageNumber: 3, text: 'Nội dung ba' },
      ],
      warnings: [],
      wasTruncated: false,
    });

    const text = buildSelectedOcrText(document, [1, 3]);
    expect(text).toContain('=== TRANG 1 ===');
    expect(text).toContain('=== TRANG 3 ===');
    expect(text).not.toContain('=== TRANG 2 ===');
  });
});
