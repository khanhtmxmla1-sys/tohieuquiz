import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorksheetQuiz, worksheetQuestionTypeLabels } from './fixtures/worksheetExportFixture';

const mocks = vi.hoisted(() => ({
    pdfInstances: [] as any[],
    documents: [] as any[],
    savedFiles: [] as Array<{ blob: Blob; name: string }>,
    pageHeight: 297,
}));

vi.mock('jspdf', () => {
    class MockJsPdf {
        pageCount = 1;
        textCalls: string[] = [];
        savedNames: string[] = [];
        unicodeFontReady = false;
        internal = { pageSize: { getWidth: () => 210, getHeight: () => mocks.pageHeight } };
        constructor() { mocks.pdfInstances.push(this); }
        addPage() { this.pageCount += 1; }
        getNumberOfPages() { return this.pageCount; }
        text(value: string | string[]) { this.textCalls.push(...(Array.isArray(value) ? value : [value])); }
        splitTextToSize(value: string, width: number) {
            const text = String(value);
            const chunk = Math.max(1, Math.floor(width / 2));
            return text.length > chunk ? text.match(new RegExp(`.{1,${chunk}}`, 'g')) || [text] : [text];
        }
        getTextWidth(value: string) { return String(value).length * 2; }
        save(name: string) { this.savedNames.push(name); }
        addFileToVFS() {} addFont() {} setFont() {} setFontSize() {} setTextColor() {}
        setDrawColor() {} setLineWidth() {} line() {} rect() {} setFillColor() {} setPage() {}
    }
    return { default: MockJsPdf };
});

vi.mock('docx', () => {
    class Node {
        public kind: string;
        constructor(public options: any) { this.kind = this.constructor.name; }
    }
    class Document extends Node { constructor(options: any) { super(options); mocks.documents.push(this); } }
    class Paragraph extends Node {}
    class TextRun extends Node {}
    class Table extends Node {}
    class TableRow extends Node {}
    class TableCell extends Node {}
    class ImageRun extends Node {}
    class OfficeMathNode extends Node { constructor(options: any) { super(options); this.kind = 'Math'; } }
    class MathRun extends Node {}
    class MathFraction extends Node { constructor(options: any) { super(options); this.kind = 'MathFraction'; } }
    class MathRadical extends Node { constructor(options: any) { super(options); this.kind = 'MathRadical'; } }
    class MathSuperScript extends Node { constructor(options: any) { super(options); this.kind = 'MathSuperScript'; } }
    class MathSubScript extends Node { constructor(options: any) { super(options); this.kind = 'MathSubScript'; } }
    class MathSubSuperScript extends Node { constructor(options: any) { super(options); this.kind = 'MathSubSuperScript'; } }
    class MathRoundBrackets extends Node {}
    class MathSquareBrackets extends Node {}
    class MathCurlyBrackets extends Node {}
    class MathAngledBrackets extends Node {}
    class MathSum extends Node {}
    class MathIntegral extends Node {}
    class MathFunction extends Node {}
    return {
        Document, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
        Math: OfficeMathNode, MathRun, MathFraction, MathRadical, MathSuperScript, MathSubScript,
        MathSubSuperScript, MathRoundBrackets, MathSquareBrackets, MathCurlyBrackets,
        MathAngledBrackets, MathSum, MathIntegral, MathFunction,
        Packer: { toBlob: vi.fn(async () => new Blob(['docx'])) },
        WidthType: { PERCENTAGE: 'percentage' }, BorderStyle: { NONE: 'none', SINGLE: 'single' },
        AlignmentType: { CENTER: 'center' }, VerticalAlign: { BOTTOM: 'bottom' },
    };
});

vi.mock('file-saver', () => ({
    saveAs: (blob: Blob, name: string) => mocks.savedFiles.push({ blob, name }),
}));

vi.mock('../src/utils/pdfFonts', () => ({ setupUnicodeFont: vi.fn(), FONT_NAME: 'UnicodeFont' }));

import { exportWorksheet } from '../src/services/worksheetExportService';
import { createDocxMathChildren } from '../src/services/worksheet-export/docx/docxMath';
import { generateQuizDocx } from '../src/utils/docxGenerator';

function collectText(value: any, output: string[] = [], seen = new Set<any>()): string[] {
    if (typeof value === 'string') output.push(value);
    else if (Array.isArray(value)) value.forEach(item => collectText(item, output, seen));
    else if (value && typeof value === 'object' && !seen.has(value)) {
        seen.add(value);
        Object.values(value).forEach(item => collectText(item, output, seen));
    }
    return output;
}

function collectKinds(value: any, output: string[] = [], seen = new Set<any>()): string[] {
    if (Array.isArray(value)) value.forEach(item => collectKinds(item, output, seen));
    else if (value && typeof value === 'object' && !seen.has(value)) {
        seen.add(value);
        if (typeof value.kind === 'string') output.push(value.kind);
        Object.values(value).forEach(item => collectKinds(item, output, seen));
    }
    return output;
}

describe('worksheetExportService characterization', () => {
    beforeEach(() => {
        mocks.pdfInstances.length = 0;
        mocks.documents.length = 0;
        mocks.savedFiles.length = 0;
        mocks.pageHeight = 297;
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    it('preserves the public dispatcher and current sanitized filenames for PDF and DOCX', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'blank', answerKey: 'none' });
        await exportWorksheet({ quiz, format: 'docx', paperStyle: 'blank', answerKey: 'none' });

        expect(mocks.pdfInstances[0].savedNames).toEqual(['vo-bai-tap-Ôn t-p Toán- Phân s-.pdf']);
        expect(mocks.savedFiles.map(file => file.name)).toEqual(['vo-bai-tap-Ôn t-p Toán- Phân s-.docx']);
    });

    it('keeps Vietnamese text, readable PDF math, and native Office Math in DOCX', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'grid-5mm', answerKey: 'separate', schoolName: 'TôHiệuQuiz' });
        const pdfText = mocks.pdfInstances[0].textCalls.join('\n');
        expect(pdfText).toContain('TÔHIỆUQUIZ');
        expect(pdfText).toContain('Ôn tập Toán: Phân số');
        expect(pdfText).toContain('Viết kết quả của 1/2 + 1/4');
        expect(pdfText).toContain('3/4');

        await exportWorksheet({ quiz, format: 'docx', paperStyle: 'blank', answerKey: 'separate', schoolName: 'TôHiệuQuiz' });
        const docxText = collectText(mocks.documents[0]).join('\n');
        const docxKinds = collectKinds(mocks.documents[0]);
        expect(docxText).toContain('TÔHIỆUQUIZ');
        expect(docxText).toContain('Ôn tập Toán: Phân số');
        expect(docxKinds).toContain('Math');
        expect(docxKinds).toContain('MathFraction');
        expect(docxText).not.toContain('\\frac');
        expect(docxText).not.toContain('$$');
    });

    it('uses native Office Math in the teacher preview Word export', async () => {
        const quiz = createWorksheetQuiz();
        quiz.questions = quiz.questions.map((question: any) => ({ ...question, image: undefined })) as any;
        await generateQuizDocx(quiz);

        const exportedDocument = mocks.documents.at(-1);
        const kinds = collectKinds(exportedDocument);
        const text = collectText(exportedDocument).join('\n');
        expect(kinds).toContain('Math');
        expect(kinds).toContain('MathFraction');
        expect(text).not.toContain('\\frac');
        expect(text).not.toContain('$');
    });

    it('builds native radicals and scripts for compound Word formulas', () => {
        const children = createDocxMathChildren(String.raw`Giải $\sqrt{x^2} + a_1 + b_n^3$`);
        const kinds = collectKinds(children);

        expect(kinds).toContain('Math');
        expect(kinds).toContain('MathRadical');
        expect(kinds).toContain('MathSuperScript');
        expect(kinds).toContain('MathSubScript');
        expect(kinds).toContain('MathSubSuperScript');
        expect(collectText(children).join('')).not.toContain('\\sqrt');
    });

    it('renders every question type and a separate answer key in PDF and DOCX', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'lined-wide', answerKey: 'separate' });
        const pdfText = mocks.pdfInstances[0].textCalls.join('\n');
        worksheetQuestionTypeLabels.forEach(label => expect(pdfText).toContain(`[${label}]`));
        expect(pdfText).toContain('ĐÁP ÁN');
        expect(pdfText).toContain('B. 2');
        expect(pdfText).toContain('Sai: "trỉ"  →  Đúng: "chỉ"');

        await exportWorksheet({ quiz, format: 'docx', paperStyle: 'blank', answerKey: 'separate' });
        const docxText = collectText(mocks.documents[0]).join('\n');
        quiz.questions.forEach((question: any) => {
            const plainQuestion = String(question.question || question.mainQuestion || '')
                .replace(/\$+/g, '')
                .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');
            expect(docxText).toContain(plainQuestion.split(' ')[0]);
        });
        expect(docxText).toContain('═══ ĐÁP ÁN ═══');
        expect(docxText).toContain('B. 2');
        expect(docxText).toContain('Sai: "trỉ"  →  Đúng: "chỉ"');
    });

    it('creates continuation pages and page footers when content exceeds the page', async () => {
        const quiz = createWorksheetQuiz();
        quiz.questions = Array.from({ length: 12 }, (_, index) => ({
            ...quiz.questions[0], id: `long-${index}`, question: `Câu hỏi dài ${index} `.repeat(20),
        })) as any;
        mocks.pageHeight = 80;

        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'grid-5mm', answerKey: 'none' });
        const pdf = mocks.pdfInstances[0];
        expect(pdf.pageCount).toBeGreaterThan(1);
        expect(pdf.textCalls.some((text: string) => text.startsWith('Trang 1 /'))).toBe(true);
    });
});
