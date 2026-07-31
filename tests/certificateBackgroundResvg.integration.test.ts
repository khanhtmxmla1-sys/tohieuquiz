// @vitest-environment node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

const require = createRequire(import.meta.url);
const resvgEntry = require.resolve('@resvg/resvg-wasm');
const wasmPath = path.join(path.dirname(resvgEntry), 'index_bg.wasm');
const backgroundPath = path.join(
  process.cwd(),
  'assets',
  'certificate-backgrounds',
  'tohieuquiz-2026',
  'geometric-navy-orange.png',
);

beforeAll(async () => {
  await initWasm(await readFile(wasmPath));
});

describe('certificate PNG background rendering', () => {
  it('produces visible artwork when embedded into the Resvg certificate pipeline', async () => {
    const background = await readFile(backgroundPath);
    const href = `data:image/png;base64,${background.toString('base64')}`;
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1270" height="698">',
      `<image href="${href}" width="1270" height="698"/>`,
      '</svg>',
    ].join('');

    const resvg = new Resvg(svg, { background: 'rgba(255,255,255,1)' });
    const rendered = resvg.render();

    try {
      const pixels = rendered.pixels;
      let nonWhitePixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] !== 255 || pixels[index + 1] !== 255 || pixels[index + 2] !== 255) {
          nonWhitePixels += 1;
        }
      }

      expect(nonWhitePixels).toBeGreaterThan(100_000);
      expect(rendered.asPng().byteLength).toBeGreaterThan(100_000);
    } finally {
      rendered.free();
      resvg.free();
    }
  });
});
