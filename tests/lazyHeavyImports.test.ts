import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('heavy feature lazy loading', () => {
  it('loads mammoth only inside the DOCX import action', () => {
    const source = read('src/features/manual-quiz-workspace/import/docxQuestionImporter.ts');
    expect(source).not.toMatch(/^import .* from ['"]mammoth['"]/m);
    expect(source).toContain("import('mammoth')");
  });

  it('loads jsPDF and html2canvas only when export is requested', () => {
    const pdf = read('src/services/pdfExportService.ts') + read('src/services/worksheet-export/pdf/pdfDocument.ts');
    const image = read('src/components/teacher/ResultsView/student-detail/hooks/useResultImageExport.ts');
    expect(pdf).not.toMatch(/^import .* from ['"]jspdf['"]/m);
    expect(pdf).toContain("import('jspdf')");
    expect(image).not.toMatch(/^import .* from ['"]html2canvas['"]/m);
    expect(image).toContain("import('html2canvas')");
  });

  it('preloads the importer on hover or focus instead of app startup', () => {
    const source = read('src/features/manual-quiz-workspace/components/QuestionImportDrawer.tsx');
    expect(source).toContain('preloadQuestionImporter');
    expect(source).toMatch(/onMouseEnter|onPointerEnter/);
    expect(source).toContain('onFocus');
  });
});
