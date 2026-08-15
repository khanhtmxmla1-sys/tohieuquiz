import type jsPDF from 'jspdf';
import { hasMathSyntax, normalizeMathText, splitRenderableMathSegments } from '../../../utils/mathText';
import { normalizeWorksheetMath } from '../shared/mathNormalizer';

const LINE_HEIGHT = 6;

interface RenderState {
    x: number;
    y: number;
    lineHeight: number;
}

const measureFraction = (doc: jsPDF, numerator: string, denominator: string): number => (
    Math.max(doc.getTextWidth(numerator), doc.getTextWidth(denominator)) + 2
);

const renderFraction = (
    doc: jsPDF,
    numerator: string,
    denominator: string,
    x: number,
    y: number,
): number => {
    const cleanNumerator = normalizeWorksheetMath(numerator);
    const cleanDenominator = normalizeWorksheetMath(denominator);
    const width = measureFraction(doc, cleanNumerator, cleanDenominator);
    const center = x + width / 2;
    const previousSize = doc.getFontSize?.() ?? 9;
    doc.setFontSize(Math.max(7, previousSize - 1));
    doc.text(cleanNumerator, center, y - 1.2, { align: 'center' });
    doc.setLineWidth(0.25);
    doc.line(x, y, x + width, y);
    doc.text(cleanDenominator, center, y + 3, { align: 'center' });
    doc.setFontSize(previousSize);
    return width;
};

const fractionPattern = /\\(?:dfrac|tfrac|frac)\{([^{}]+)\}\{([^{}]+)\}/g;

const mathWidth = (doc: jsPDF, source: string): number => {
    let width = 0;
    let cursor = 0;
    for (const match of source.matchAll(fractionPattern)) {
        const index = match.index ?? 0;
        const before = normalizeWorksheetMath(source.slice(cursor, index));
        width += doc.getTextWidth(before);
        width += measureFraction(doc, normalizeWorksheetMath(match[1]), normalizeWorksheetMath(match[2]));
        cursor = index + match[0].length;
    }
    width += doc.getTextWidth(normalizeWorksheetMath(source.slice(cursor)));
    return Math.max(width, 1);
};

const wrapIfNeeded = (
    state: RenderState,
    startX: number,
    maxWidth: number,
    itemWidth: number,
): void => {
    if (state.x > startX && state.x + itemWidth > startX + maxWidth) {
        state.x = startX;
        state.y += state.lineHeight;
        state.lineHeight = LINE_HEIGHT;
    }
};

const renderPlainWords = (
    doc: jsPDF,
    value: string,
    state: RenderState,
    startX: number,
    maxWidth: number,
): void => {
    const parts = value.replace(/\s+/g, ' ').split(/(\s+)/).filter(Boolean);
    for (const part of parts) {
        const width = doc.getTextWidth(part);
        wrapIfNeeded(state, startX, maxWidth, width);
        doc.text(part, state.x, state.y);
        state.x += width;
    }
};

const renderMathSegment = (
    doc: jsPDF,
    source: string,
    state: RenderState,
    startX: number,
    maxWidth: number,
): void => {
    const width = mathWidth(doc, source);
    wrapIfNeeded(state, startX, maxWidth, width);

    let cursor = 0;
    for (const match of source.matchAll(fractionPattern)) {
        const index = match.index ?? 0;
        const before = normalizeWorksheetMath(source.slice(cursor, index));
        if (before) {
            doc.text(before, state.x, state.y);
            state.x += doc.getTextWidth(before);
        }
        state.x += renderFraction(doc, match[1], match[2], state.x, state.y) + 1;
        state.lineHeight = Math.max(state.lineHeight, 7);
        cursor = index + match[0].length;
    }
    const after = normalizeWorksheetMath(source.slice(cursor));
    if (after) {
        doc.text(after, state.x, state.y);
        state.x += doc.getTextWidth(after);
    }
};

export function renderPdfMathText(
    doc: jsPDF,
    content: unknown,
    x: number,
    y: number,
    maxWidth: number,
): number {
    const source = normalizeMathText(content);
    if (!source) return LINE_HEIGHT;

    if (!hasMathSyntax(source)) {
        const lines = doc.splitTextToSize(source, maxWidth);
        doc.text(lines, x, y);
        return Math.max(LINE_HEIGHT, lines.length * 5);
    }

    const segments = splitRenderableMathSegments(source);
    const state: RenderState = { x, y, lineHeight: LINE_HEIGHT };
    for (const segment of segments) {
        if (segment.type === 'text') {
            renderPlainWords(doc, segment.raw, state, x, maxWidth);
        } else {
            renderMathSegment(doc, segment.inner || segment.raw, state, x, maxWidth);
        }
    }
    return Math.max(LINE_HEIGHT, state.y - y + state.lineHeight);
}
