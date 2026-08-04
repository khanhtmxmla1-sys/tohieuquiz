import { describe, expect, it, vi } from 'vitest';
import {
  getPdfSvgDiagramKey,
  rasterizeSvgDiagramForPdf,
  renderPdfSvgDiagram,
} from '../src/services/worksheet-export/pdf/pdfSvgDiagram';

const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"></svg>';

describe('worksheet PDF SVG diagrams', () => {
  it('rejects malicious SVG before attempting rasterization', async () => {
    await expect(rasterizeSvgDiagramForPdf(maliciousSvg)).resolves.toBeNull();
  });

  it('renders only a pre-rasterized PNG from the safe cache', () => {
    const addImage = vi.fn();
    const context = {
      doc: {
        internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
        addImage,
      },
      opts: { paperStyle: 'blank' },
      yPos: 30,
      svgDiagrams: new Map([
        ['id:q-1', { dataUrl: 'data:image/png;base64,AAAA', aspectRatio: 2 }],
      ]),
    } as any;

    expect(getPdfSvgDiagramKey({ id: 'q-1' }, 0)).toBe('id:q-1');
    expect(renderPdfSvgDiagram(context, { id: 'q-1' }, 0)).toBe(true);
    expect(addImage).toHaveBeenCalledWith(
      'data:image/png;base64,AAAA',
      'PNG',
      expect.any(Number),
      30,
      125,
      62.5,
      undefined,
      'FAST',
    );
    expect(context.yPos).toBe(97.5);
  });
});
