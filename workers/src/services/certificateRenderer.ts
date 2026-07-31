import { Resvg, initWasm } from '@resvg/resvg-wasm';
// @ts-ignore Wrangler compiles .wasm imports to WebAssembly.Module.
import resvgWasmModule from '@resvg/resvg-wasm/index_bg.wasm';
import type { Env } from '../types';
import type { FieldConfig } from '../types/certificates';
import { getRenderableCertificateBackgroundMime } from './certificateBackgroundFormat';
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

export async function renderCertificate(params: RenderParams): Promise<Uint8Array> {
  const { env, bgImageArrayBuffer, fieldsConfig, data, width = 1200, height = 848 } = params;
  const backgroundMime = getRenderableCertificateBackgroundMime(bgImageArrayBuffer);
  await ensureWasmReady();
  const bgHref = `data:${backgroundMime};base64,${arrayBufferToBase64(bgImageArrayBuffer)}`;
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
