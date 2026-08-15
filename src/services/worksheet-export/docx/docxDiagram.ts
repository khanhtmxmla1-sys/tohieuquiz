import { AlignmentType, ImageRun, Paragraph } from 'docx';
import { sanitizeSvgDiagram } from '../../../../shared/svgDiagramSanitizer';
import { createWorksheetGeometrySvg } from '../shared/geometrySvg';

const FALLBACK_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const base64Bytes = (value: string): Uint8Array => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
};

const getDiagramSvg = (question: any): string | null => {
    if (question?.geometryData && typeof question.geometryData === 'object') {
        return createWorksheetGeometrySvg(question.geometryData);
    }
    const raw = question?.svgContent ?? question?.svg_content;
    if (typeof raw !== 'string' || !raw.trim()) return null;
    const sanitized = sanitizeSvgDiagram(raw);
    if (!sanitized.ok || !sanitized.sanitizedSvg) {
        throw new Error('SVG câu hỏi không hợp lệ nên không thể xuất Word an toàn.');
    }
    return sanitized.sanitizedSvg;
};

const svgDataUri = (svg: string): string => {
    const bytes = new TextEncoder().encode(svg);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/svg+xml;base64,${btoa(binary)}`;
};

export function renderDocxDiagram(question: any): Paragraph[] {
    const svg = getDiagramSvg(question);
    if (!svg) return [];
    return [new Paragraph({
        children: [new ImageRun({
            type: 'svg',
            data: svgDataUri(svg),
            fallback: { type: 'png', data: base64Bytes(FALLBACK_PNG_BASE64) },
            transformation: { width: 320, height: 240 },
            altText: {
                title: String(question?.svgAlt || question?.svg_alt || question?.question || 'Hình minh họa'),
                description: String(question?.svgAlt || question?.svg_alt || question?.question || 'Hình minh họa'),
                name: `worksheet-diagram-${String(question?.id || 'question')}`,
            },
        })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 100 },
    })];
}
