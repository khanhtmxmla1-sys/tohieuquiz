import { Resvg, initWasm } from '@resvg/resvg-wasm';
// @ts-ignore Wrangler compiles .wasm imports to WebAssembly.Module.
import resvgWasmModule from '@resvg/resvg-wasm/index_bg.wasm';
import type { Env } from '../types';
import type { FieldConfig } from '../types/certificates';
import { loadCertificateFonts } from './fontLoader';
import { buildCertificateSvg } from './certificateSvg';

export interface RenderParams {
  env: Pick<Env, 'CERT_IMAGES'>;
  bgImageArrayBuffer: ArrayBuffer;
  fieldsConfig: FieldConfig[];
  data: {
    student_name: string;
    score: string;
    quiz_title: string;
    date: string;
    teacher_name: string;
    custom_note: string;
  };
  width?: number;
  height?: number;
}

let wasmReady = false;
let wasmInitPromise: Promise<void> | null = null;

async function ensureWasmReady(): Promise<void> {
  if (wasmReady) return;
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm(resvgWasmModule as unknown as WebAssembly.Module).then(() => {
      wasmReady = true;
    });
  }
  await wasmInitPromise;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + chunkSize, bytes.length))));
  }
  return btoa(binary);
}

function detectImageMime(buffer: ArrayBuffer): string {
  const b = new Uint8Array(buffer);
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b.length >= 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return 'image/png';
}

export async function renderCertificate(params: RenderParams): Promise<Uint8Array> {
  await ensureWasmReady();
  const { env, bgImageArrayBuffer, fieldsConfig, data, width = 1200, height = 848 } = params;
  const bgHref = `data:${detectImageMime(bgImageArrayBuffer)};base64,${arrayBufferToBase64(bgImageArrayBuffer)}`;
  const svg = buildCertificateSvg(bgHref, fieldsConfig, data, width, height);

  const fonts = await loadCertificateFonts(env);
  const fontBuffers = fonts.map((font) => new Uint8Array(font));

  const resvg = new Resvg(svg, {
    background: 'rgba(255,255,255,1)',
    fitTo: { mode: 'width', value: width },
    font: {
      loadSystemFonts: false,
      defaultFontFamily: 'Roboto',
      fontBuffers,
    },
  });
  const rendered = resvg.render();
  const pngBytes = rendered.asPng();
  rendered.free();
  resvg.free();
  return pngBytes;
}
