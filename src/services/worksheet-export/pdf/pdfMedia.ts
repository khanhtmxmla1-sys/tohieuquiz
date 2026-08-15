import { ensurePdfSpace } from './pdfLayout';
import { PDF_MARGIN, type PdfRenderContext } from './pdfTypes';
import { worksheetOptionImageKey, worksheetQuestionImageKey } from '../shared/media';

const pdfImageFormat = (type: 'jpg' | 'png' | 'gif' | 'bmp'): string => (
    type === 'jpg' ? 'JPEG' : type.toUpperCase()
);

export function renderPdfQuestionMedia(ctx: PdfRenderContext, questionIndex: number, optionCount = 0): void {
    const assets = ctx.imageAssets;
    if (!assets) return;
    const doc = ctx.doc;
    const contentWidth = doc.internal.pageSize.getWidth() - PDF_MARGIN * 2;
    const main = assets.get(worksheetQuestionImageKey(questionIndex));

    if (main) {
        const width = Math.min(90, contentWidth);
        const height = Math.min(60, width * 2 / 3);
        ensurePdfSpace(ctx, height + 7);
        const x = (doc.internal.pageSize.getWidth() - width) / 2;
        doc.addImage(main.dataUrl, pdfImageFormat(main.type), x, ctx.yPos, width, height, undefined, 'FAST');
        ctx.yPos += height + 5;
    }

    const optionAssets = Array.from({ length: optionCount }, (_, optionIndex) => ({
        optionIndex,
        asset: assets.get(worksheetOptionImageKey(questionIndex, optionIndex)),
    })).filter((entry) => Boolean(entry.asset));

    if (optionAssets.length === 0) return;
    const cellWidth = Math.min(42, contentWidth / Math.min(optionAssets.length, 4));
    const imageWidth = Math.max(20, cellWidth - 8);
    const imageHeight = Math.min(32, imageWidth * 2 / 3);
    ensurePdfSpace(ctx, imageHeight + 10);

    optionAssets.forEach(({ optionIndex, asset }, position) => {
        if (!asset) return;
        const x = PDF_MARGIN + position * cellWidth;
        doc.text(`${String.fromCharCode(65 + optionIndex)}.`, x, ctx.yPos + 4);
        doc.addImage(
            asset.dataUrl,
            pdfImageFormat(asset.type),
            x + 7,
            ctx.yPos,
            imageWidth,
            imageHeight,
            undefined,
            'FAST',
        );
    });
    ctx.yPos += imageHeight + 7;
}
