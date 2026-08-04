import { sanitizeSvgDiagram } from '../../../../shared/svgDiagramSanitizer';
import { ensurePdfSpace } from './pdfLayout';
import { PDF_MARGIN, type PdfRenderContext } from './pdfTypes';

export interface PdfSvgDiagramImage {
    dataUrl: string;
    aspectRatio: number;
}

const MAX_RASTER_WIDTH = 1_600;
const MAX_RASTER_HEIGHT = 1_200;

export const getPdfSvgDiagramKey = (question: { id?: string }, index: number): string => (
    question.id ? `id:${question.id}` : `index:${index}`
);

const viewBoxAspectRatio = (svgContent: string): number => {
    const match = svgContent.match(/\bviewBox="([^"]+)"/i);
    if (!match) return 4 / 3;
    const values = match[1].trim().split(/[\s,]+/).map(Number);
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return 4 / 3;
    const [, , width, height] = values;
    return width > 0 && height > 0 ? width / height : 4 / 3;
};

export async function rasterizeSvgDiagramForPdf(
    rawSvgContent: unknown,
): Promise<PdfSvgDiagramImage | null> {
    const sanitized = sanitizeSvgDiagram(rawSvgContent);
    if (!sanitized.ok || !sanitized.sanitizedSvg) return null;
    if (typeof document === 'undefined' || typeof Image === 'undefined') return null;

    const aspectRatio = Math.min(8, Math.max(0.125, viewBoxAspectRatio(sanitized.sanitizedSvg)));
    const width = Math.min(MAX_RASTER_WIDTH, Math.max(320, Math.round(1_000 * Math.min(1, aspectRatio))));
    const height = Math.min(MAX_RASTER_HEIGHT, Math.max(200, Math.round(width / aspectRatio)));
    const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitized.sanitizedSvg)}`;

    return new Promise((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d');
                if (!context) {
                    resolve(null);
                    return;
                }
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, width, height);
                context.drawImage(image, 0, 0, width, height);
                resolve({ dataUrl: canvas.toDataURL('image/png'), aspectRatio });
            } catch {
                resolve(null);
            }
        };
        image.onerror = () => resolve(null);
        image.src = source;
    });
}

export function renderPdfSvgDiagram(
    ctx: PdfRenderContext,
    question: { id?: string },
    index: number,
): boolean {
    const image = ctx.svgDiagrams?.get(getPdfSvgDiagramKey(question, index));
    if (!image) return false;

    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    const width = Math.min(contentWidth, 125);
    const height = Math.min(72, width / image.aspectRatio);
    ensurePdfSpace(ctx, height + 7);
    const x = (doc.internal.pageSize.getWidth() - width) / 2;
    doc.addImage(image.dataUrl, 'PNG', x, ctx.yPos, width, height, undefined, 'FAST');
    ctx.yPos += height + 5;
    return true;
}
