import { z } from 'zod';

export const MAX_OCR_PAGE_CHARS = 20_000;
export const MAX_SELECTED_OCR_CHARS = 60_000;

export interface OcrPage {
  pageNumber: number;
  text: string;
}

export interface OcrDocument {
  pages: OcrPage[];
  warnings: string[];
  wasTruncated: boolean;
}

const rawOcrDocumentSchema = z.object({
  pages: z.array(z.object({
    pageNumber: z.number().int().positive(),
    text: z.string().trim().min(1, 'Trang OCR không được để trống.'),
  })).min(1, 'Tài liệu OCR phải có ít nhất một trang.'),
  warnings: z.array(z.string().trim().min(1)).default([]),
  wasTruncated: z.boolean().default(false),
}).superRefine((document, context) => {
  const pageNumbers = new Set<number>();
  for (const page of document.pages) {
    if (pageNumbers.has(page.pageNumber)) {
      context.addIssue({
        code: 'custom',
        path: ['pages'],
        message: `Trang ${page.pageNumber} bị lặp.`,
      });
    }
    pageNumbers.add(page.pageNumber);
  }
});

export const parseOcrDocument = (raw: unknown): OcrDocument => {
  const parsed = rawOcrDocumentSchema.parse(raw);
  let wasTruncated = parsed.wasTruncated;
  const pages = parsed.pages
    .map((page) => {
      if (page.text.length <= MAX_OCR_PAGE_CHARS) return page;
      wasTruncated = true;
      return { ...page, text: page.text.slice(0, MAX_OCR_PAGE_CHARS) };
    })
    .sort((left, right) => left.pageNumber - right.pageNumber);

  return {
    pages,
    warnings: [...new Set(parsed.warnings)].slice(0, 20),
    wasTruncated,
  };
};

export const buildSelectedOcrText = (
  document: OcrDocument,
  selectedPageNumbers: number[],
): string => {
  const selected = new Set(selectedPageNumbers);
  const pages = document.pages.filter((page) => selected.has(page.pageNumber));
  if (pages.length === 0) {
    throw new Error('Cần chọn ít nhất một trang.');
  }

  let output = '';
  for (const page of pages) {
    const block = `${output ? '\n\n' : ''}=== TRANG ${page.pageNumber} ===\n${page.text}`;
    if (output.length + block.length <= MAX_SELECTED_OCR_CHARS) {
      output += block;
      continue;
    }
    output += block.slice(0, Math.max(0, MAX_SELECTED_OCR_CHARS - output.length));
    break;
  }
  return output;
};
