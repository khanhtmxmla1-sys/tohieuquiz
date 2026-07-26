// workers/src/services/fontLoader.ts
// Loads the bundled Roboto fonts from the certificate R2 bucket.

const fontCache = new Map<string, ArrayBuffer>();

function isSupportedFont(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) return false;
  const isTrueType = bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00;
  const isOpenType = bytes[0] === 0x4f && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4f;
  return isTrueType || isOpenType;
}

/**
 * Load a required certificate font from CERT_IMAGES.
 * Missing or invalid fonts must stop rendering to avoid blank-text PNGs.
 */
export async function loadFont(env: any, fontName: string): Promise<ArrayBuffer> {
  const cached = fontCache.get(fontName);
  if (cached) return cached.slice(0);

  const bucket: R2Bucket | undefined = env?.CERT_IMAGES;
  if (!bucket) throw new Error('CERT_IMAGES binding is required to load certificate fonts');

  const key = `fonts/${fontName}.ttf`;
  const obj = await bucket.get(key);
  if (!obj) throw new Error(`Certificate font not found in R2: ${key}`);

  const buffer = await obj.arrayBuffer();
  if (!isSupportedFont(buffer)) throw new Error(`Invalid certificate font in R2: ${key}`);

  fontCache.set(fontName, buffer.slice(0));
  return buffer.slice(0);
}

/**
 * Load Roboto Regular + Bold — used by certificateRenderer
 */
export async function loadRobotoFonts(env: any): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  const [regular, bold] = await Promise.all([
    loadFont(env, 'Roboto-Regular'),
    loadFont(env, 'Roboto-Bold'),
  ]);
  return { regular, bold };
}

/**
 * Preload multiple fonts at once
 */
export async function preloadFonts(env: any, fontNames: string[]): Promise<Record<string, ArrayBuffer>> {
  const fonts: Record<string, ArrayBuffer> = {};
  await Promise.all(
    fontNames.map(async (name) => {
      try { fonts[name] = await loadFont(env, name); }
      catch (error) { console.warn(`Cannot load font: ${name}`, error); }
    })
  );
  return fonts;
}

export async function loadCertificateFonts(env: any): Promise<ArrayBuffer[]> {
  const fontNames = [
    'Roboto-Regular',
    'Roboto-Bold',
    'Spectral-Regular',
    'Spectral-Bold',
    'Spectral-BoldItalic',
    'DancingScript-Bold',
    'GreatVibes-Regular',
    'PlaywriteVN-Regular',
    'Allura-Regular',
    'AlexBrush-Regular',
  ];
  return Promise.all(fontNames.map((fontName) => loadFont(env, fontName)));
}
