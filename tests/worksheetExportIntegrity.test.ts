import { beforeEach, describe, expect, it, vi } from 'vitest';
import { inflateSync } from 'node:zlib';
import { createWorksheetQuiz } from './fixtures/worksheetExportFixture';

const mocks = vi.hoisted(() => ({
    pdfInstances: [] as any[],
    documents: [] as any[],
    savedFiles: [] as Array<{ blob: Blob; name: string }>,
    rectCalls: [] as any[][],
    pageHeight: 297,
}));

vi.mock('jspdf', () => {
    class MockJsPdf {
        pageCount = 1;
        currentPage = 1;
        textCalls: string[] = [];
        imageCalls: any[][] = [];
        savedNames: string[] = [];
        internal = { pageSize: { getWidth: () => 210, getHeight: () => mocks.pageHeight } };
        constructor() { mocks.pdfInstances.push(this); }
        addPage() { this.pageCount += 1; this.currentPage = this.pageCount; }
        getNumberOfPages() { return this.pageCount; }
        setPage(page: number) { this.currentPage = page; }
        text(value: string | string[]) { this.textCalls.push(...(Array.isArray(value) ? value : [value])); }
        splitTextToSize(value: string, width: number) {
            const text = String(value);
            if (text.includes('Đây là lựa chọn rất dài')) {
                return ['LỰA_CHỌN_DÒNG_1', 'LỰA_CHỌN_DÒNG_2', 'LỰA_CHỌN_DÒNG_3'];
            }
            const chunk = Math.max(1, Math.floor(width / 2));
            return text.length > chunk ? text.match(new RegExp(`.{1,${chunk}}`, 'g')) || [text] : [text];
        }
        getTextWidth(value: string) { return String(value).length * 2; }
        addImage(...args: any[]) { this.imageCalls.push(args); }
        save(name: string) { this.savedNames.push(name); }
        addFileToVFS() {} addFont() {} setFont() {} setFontSize() {} setTextColor() {}
        setDrawColor() {} setLineWidth() {} line() {}
        rect(...args: any[]) { mocks.rectCalls.push(args); }
        setFillColor() {}
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
        PageOrientation: { PORTRAIT: 'portrait' },
    };
});

vi.mock('file-saver', () => ({
    saveAs: (blob: Blob, name: string) => mocks.savedFiles.push({ blob, name }),
}));

vi.mock('../src/utils/pdfFonts', () => ({ setupUnicodeFont: vi.fn(), FONT_NAME: 'UnicodeFont' }));

import { exportWorksheet } from '../src/services/worksheetExportService';
import { getWorksheetAnswerText } from '../src/services/worksheet-export/shared/answerFormatter';
import { renderDocxDiagram } from '../src/services/worksheet-export/docx/docxDiagram';

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


function assertDecodablePng(bytes: Uint8Array): void {
    const buffer = Buffer.from(bytes);
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const idatChunks: Buffer[] = [];
    let offset = 8;
    while (offset + 12 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        if (type === 'IDAT') idatChunks.push(buffer.subarray(dataStart, dataEnd));
        offset = dataEnd + 4;
        if (type === 'IEND') break;
    }
    expect(idatChunks.length).toBeGreaterThan(0);
    expect(() => inflateSync(Buffer.concat(idatChunks))).not.toThrow();
}

describe('worksheet export integrity', () => {
    beforeEach(() => {
        mocks.pdfInstances.length = 0;
        mocks.documents.length = 0;
        mocks.savedFiles.length = 0;
        mocks.rectCalls.length = 0;
        mocks.pageHeight = 297;
        vi.restoreAllMocks();
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    it('keeps matching answer labels aligned with the shuffled right column', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'blank', answerKey: 'separate' });
        const pdfText = mocks.pdfInstances[0].textCalls.join('\n');

        const rightColumn = ['4', '6', '10'].map(value => {
            const line = pdfText.split('\n').find((entry: string) => /^[A-C]\. /.test(entry) && entry.endsWith(value));
            return line?.slice(0, 1) || '';
        });
        const answer = getWorksheetAnswerText(quiz.questions[3] as any);

        expect(rightColumn).not.toEqual(['A', 'B', 'C']);
        expect(answer).toContain(`1→${rightColumn[0]}`);
        expect(answer).toContain(`2→${rightColumn[1]}`);
        expect(answer).toContain(`3→${rightColumn[2]}`);
    });

    it('renders all structured question payloads in DOCX', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'docx', paperStyle: 'blank', answerKey: 'none' });
        const text = collectText(mocks.documents[0]).join('\n');

        expect(text).toContain('Em ___ học.');
        expect(text).toContain('[1]: ');
        expect(text).toContain('đi / ăn');
        expect(text).toContain('Câu hai');
        expect(text).toContain('Lan yêu trường học');
        expect(text).toContain('Danh từ');
        expect(text).toContain('học sinh');
        expect(text).toContain('T - O - Á - N');
        expect(text).toContain('Có sắc là quả');
        expect(text).toContain('Em rất chăm trỉ.');
    });

    it('embeds required question and option images in both formats', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'blank', answerKey: 'none' });
        expect(mocks.pdfInstances[0].imageCalls.length).toBeGreaterThanOrEqual(2);

        await exportWorksheet({ quiz, format: 'docx', paperStyle: 'blank', answerKey: 'none' });
        expect(collectKinds(mocks.documents.at(-1)).filter(kind => kind === 'ImageRun').length).toBeGreaterThanOrEqual(2);
    });

    it('does not flatten LaTeX fractions to slash text in print outputs', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'blank', answerKey: 'separate' });
        const pdfText = mocks.pdfInstances[0].textCalls.join('\n');
        expect(pdfText).not.toContain('1/2');
        expect(pdfText).not.toContain('1/4');
        expect(pdfText).not.toContain('3/4');

        await exportWorksheet({ quiz, format: 'docx', paperStyle: 'blank', answerKey: 'separate' });
        expect(collectKinds(mocks.documents.at(-1))).toContain('MathFraction');
    });

    it('renders every line of a multiline PDF choice', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'blank', answerKey: 'none' });
        const pdfText = mocks.pdfInstances[0].textCalls.join('\n');
        expect(pdfText).toContain('LỰA_CHỌN_DÒNG_1');
        expect(pdfText).toContain('LỰA_CHỌN_DÒNG_2');
        expect(pdfText).toContain('LỰA_CHỌN_DÒNG_3');
    });

    it('counts answer pages in PDF footers', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'blank', answerKey: 'separate' });
        const pdf = mocks.pdfInstances[0];
        expect(pdf.pageCount).toBeGreaterThanOrEqual(2);
        expect(pdf.textCalls).toContain(`Trang 1 / ${pdf.pageCount}  —  TôHiệuQuiz  —  TôHiệuQuiz`);
        expect(pdf.textCalls).toContain(`Trang ${pdf.pageCount} / ${pdf.pageCount}  —  TôHiệuQuiz  —  TôHiệuQuiz`);
    });

    it('preserves Vietnamese letters in exported filenames', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'blank', answerKey: 'none' });
        await exportWorksheet({ quiz, format: 'docx', paperStyle: 'blank', answerKey: 'none' });
        expect(mocks.pdfInstances[0].savedNames).toEqual(['vo-bai-tap-Ôn-tập-Toán-Phân-số.pdf']);
        expect(mocks.savedFiles.map(file => file.name)).toEqual(['vo-bai-tap-Ôn-tập-Toán-Phân-số.docx']);
    });

    it('formats dropdown answers from blank correct answers', () => {
        const quiz = createWorksheetQuiz();
        expect(getWorksheetAnswerText(quiz.questions[8] as any)).toBe('1. đi');
    });

    it('renders dropdown choices and riddle clues in PDF', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'blank', answerKey: 'none' });
        const pdfText = mocks.pdfInstances[0].textCalls.join('\n');
        expect(pdfText).toContain('Em ___ học.');
        expect(pdfText).toContain('[1]: đi / ăn');
        expect(pdfText).toContain('Có sắc là quả');
    });

    it('renders structured geometry as a printable visual in PDF and DOCX', async () => {
        const quiz = createWorksheetQuiz();
        await exportWorksheet({ quiz, format: 'pdf', paperStyle: 'blank', answerKey: 'none' });
        expect(mocks.rectCalls.some((args) => Number(args[2]) >= 30 && Number(args[3]) >= 30)).toBe(true);

        await exportWorksheet({ quiz, format: 'docx', paperStyle: 'blank', answerKey: 'none' });
        const imageRunCount = collectKinds(mocks.documents.at(-1)).filter(kind => kind === 'ImageRun').length;
        expect(imageRunCount).toBeGreaterThanOrEqual(3);
    });

    it('rejects IMAGE_QUESTION exports when the required image is missing', async () => {
        const quiz = createWorksheetQuiz();
        delete (quiz.questions[7] as any).image;

        await expect(exportWorksheet({
            quiz,
            format: 'pdf',
            paperStyle: 'blank',
            answerKey: 'none',
        })).rejects.toThrow(/Câu 8.*hình/i);

        await expect(exportWorksheet({
            quiz,
            format: 'docx',
            paperStyle: 'blank',
            answerKey: 'none',
        })).rejects.toThrow(/Câu 8.*hình/i);
    });

    it('rejects GEOMETRY exports when no printable geometry or SVG exists', async () => {
        const quiz = createWorksheetQuiz();
        (quiz.questions[14] as any).geometryData = null;
        delete (quiz.questions[14] as any).svgContent;
        delete (quiz.questions[14] as any).svg_content;

        await expect(exportWorksheet({
            quiz,
            format: 'pdf',
            paperStyle: 'blank',
            answerKey: 'none',
        })).rejects.toThrow(/Câu 15.*hình/i);

        await expect(exportWorksheet({
            quiz,
            format: 'docx',
            paperStyle: 'blank',
            answerKey: 'none',
        })).rejects.toThrow(/Câu 15.*hình/i);
    });

    it('uses a decodable PNG fallback for DOCX SVG diagrams', () => {
        const quiz = createWorksheetQuiz();
        const nodes = renderDocxDiagram(quiz.questions[14] as any);
        const imageRun = nodes[0]?.options?.children?.find((child: any) => child?.kind === 'ImageRun');
        expect(imageRun?.options?.fallback?.type).toBe('png');
        assertDecodablePng(imageRun.options.fallback.data);
    });
});
