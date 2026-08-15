import { ensurePdfSpace } from './pdfLayout';
import { PDF_MARGIN, type PdfRenderContext } from './pdfTypes';

interface Point { x: number; y: number; label?: string }

const defaultVertices = (type: string): Point[] => {
    switch (type) {
        case 'square': return [{ x: 0, y: 0, label: 'A' }, { x: 1, y: 0, label: 'B' }, { x: 1, y: 1, label: 'C' }, { x: 0, y: 1, label: 'D' }];
        case 'rectangle': return [{ x: 0, y: 0, label: 'A' }, { x: 1.6, y: 0, label: 'B' }, { x: 1.6, y: 1, label: 'C' }, { x: 0, y: 1, label: 'D' }];
        case 'triangle': return [{ x: 0, y: 0, label: 'A' }, { x: 1.5, y: 0, label: 'B' }, { x: 0.75, y: 1.2, label: 'C' }];
        default: return [];
    }
};

export function renderPdfGeometry(ctx: PdfRenderContext, question: any): boolean {
    const data = question?.geometryData;
    if (!data || typeof data !== 'object') return false;
    const doc = ctx.doc;
    const type = String(data.type || '').toLowerCase();
    const boxWidth = 70;
    const boxHeight = 55;
    ensurePdfSpace(ctx, boxHeight + 10);
    const startX = (doc.internal.pageSize.getWidth() - boxWidth) / 2;
    const startY = ctx.yPos;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);

    if ((type === 'square' || type === 'rectangle') && !Array.isArray(data.vertices)) {
        const width = type === 'square' ? 45 : 65;
        const height = type === 'square' ? 45 : 38;
        doc.rect((doc.internal.pageSize.getWidth() - width) / 2, startY, width, height);
        ctx.yPos += height + 7;
        return true;
    }

    if (type === 'circle' && (!Array.isArray(data.circles) || data.circles.length === 0)) {
        const radius = 22;
        if (typeof (doc as any).circle === 'function') (doc as any).circle(doc.internal.pageSize.getWidth() / 2, startY + radius, radius);
        else doc.rect(doc.internal.pageSize.getWidth() / 2 - radius, startY, radius * 2, radius * 2);
        ctx.yPos += radius * 2 + 7;
        return true;
    }

    const vertices: Point[] = Array.isArray(data.vertices) && data.vertices.length > 0
        ? data.vertices
        : defaultVertices(type);
    if (vertices.length >= 2) {
        const xs = vertices.map(point => Number(point.x) || 0);
        const ys = vertices.map(point => Number(point.y) || 0);
        const minX = Math.min(...xs); const maxX = Math.max(...xs);
        const minY = Math.min(...ys); const maxY = Math.max(...ys);
        const spanX = Math.max(1, maxX - minX); const spanY = Math.max(1, maxY - minY);
        const mapped = vertices.map(point => ({
            x: startX + ((Number(point.x) - minX) / spanX) * boxWidth,
            y: startY + boxHeight - ((Number(point.y) - minY) / spanY) * boxHeight,
            label: point.label,
        }));
        mapped.forEach((point, index) => {
            const next = mapped[(index + 1) % mapped.length];
            if (type === 'line' && index > 0) return;
            doc.line(point.x, point.y, next.x, next.y);
            if (point.label) doc.text(String(point.label), point.x + 2, point.y - 2);
        });
        ctx.yPos += boxHeight + 7;
        return true;
    }

    const lines = Array.isArray(data.lines) ? data.lines : [];
    if (lines.length > 0) {
        lines.forEach((line: any, index: number) => {
            const y = startY + 12 + index * 10;
            doc.line(startX, y, startX + boxWidth, y);
            if (line?.from?.label) doc.text(String(line.from.label), startX, y - 2);
            if (line?.to?.label) doc.text(String(line.to.label), startX + boxWidth - 3, y - 2);
        });
        ctx.yPos += Math.min(boxHeight, lines.length * 10 + 15);
        return true;
    }

    return false;
}
