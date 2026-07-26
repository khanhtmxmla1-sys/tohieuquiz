import { initWasm, Resvg } from '@resvg/resvg-wasm';
import wasmModule from '@resvg/resvg-wasm/index_bg.wasm';
import { buildOgSvg, type PhieuRecord } from './ogImageSvg';

export type { PhieuRecord } from './ogImageSvg';
export { buildOgSvg } from './ogImageSvg';

// WASM import trực tiếp (ES module, Cloudflare Workers bundler tự handle)
let wasmInitialized = false;
async function ensureWasm() {
    if (wasmInitialized) return;
    await initWasm(wasmModule as WebAssembly.Module);
    wasmInitialized = true;
}

export async function renderOgPng(record: PhieuRecord): Promise<Uint8Array> {
    await ensureWasm();
    const svg = buildOgSvg(record);
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
    return resvg.render().asPng();
}
