export const MAX_SVG_BYTES = 64 * 1024;

const MAX_NODES = 500;
const MAX_DEPTH = 24;
const MAX_ATTRIBUTE_LENGTH = 4_096;
const MAX_PATH_LENGTH = 16_384;
const MAX_TEXT_NODES = 80;
const MAX_GRADIENTS = 16;
const MAX_MARKERS = 16;

const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse',
  'text', 'tspan', 'defs', 'marker', 'linearGradient', 'radialGradient', 'stop', 'clipPath',
]);

const FORBIDDEN_TAGS = new Set([
  'script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'canvas',
  'image', 'use', 'a', 'style', 'link', 'animate', 'animateTransform', 'set',
]);

const ALLOWED_ATTRIBUTES = new Set([
  'xmlns', 'viewBox', 'preserveAspectRatio', 'fill', 'fill-opacity', 'stroke',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'stroke-opacity', 'opacity', 'transform', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'points', 'font-size', 'font-weight', 'text-anchor',
  'dominant-baseline', 'offset', 'stop-color', 'stop-opacity', 'marker-start',
  'marker-mid', 'marker-end', 'clip-path', 'id', 'refX', 'refY', 'markerWidth',
  'markerHeight', 'orient', 'gradientUnits', 'gradientTransform', 'spreadMethod',
  'fx', 'fy',
]);

const STRIPPED_ATTRIBUTES = new Set(['width', 'height', 'role', 'aria-label', 'overflow']);
const URL_REFERENCE_ATTRIBUTES = new Set(['marker-start', 'marker-mid', 'marker-end', 'clip-path']);
const SAFE_XMLNS = 'http://www.w3.org/2000/svg';

export interface SvgSanitizationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface SvgSanitizationResult {
  ok: boolean;
  sanitizedSvg?: string;
  issues: SvgSanitizationIssue[];
  sizeBytes: number;
  nodeCount: number;
}

const escapeAttribute = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const escapeText = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const finiteNumber = (value: string): boolean => {
  if (!/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return false;
  return Number.isFinite(Number(value));
};

const validViewBox = (value: string): boolean => {
  const parts = value.trim().split(/[\s,]+/);
  return parts.length === 4
    && parts.every(finiteNumber)
    && Number(parts[2]) > 0
    && Number(parts[3]) > 0
    && Math.abs(Number(parts[0])) < 1_000_000
    && Math.abs(Number(parts[1])) < 1_000_000
    && Number(parts[2]) <= 1_000_000
    && Number(parts[3]) <= 1_000_000;
};

const unsafeValue = (value: string): boolean => {
  const normalized = value.toLowerCase().replace(/\s+/g, '');
  return normalized.includes('javascript:')
    || normalized.includes('data:')
    || normalized.includes('http://')
    || normalized.includes('https://')
    || normalized.includes('//')
    || normalized.includes('expression(')
    || normalized.includes('@import')
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
};

const validLocalReference = (value: string): boolean => (
  value === 'none' || /^url\(#[A-Za-z_][A-Za-z0-9_.-]{0,127}\)$/.test(value)
);

const findTagEnd = (source: string, start: number): number => {
  let quote = '';
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '>') return index;
  }
  return -1;
};

interface ParsedAttribute {
  name: string;
  value: string;
}

const parseAttributes = (source: string): ParsedAttribute[] | null => {
  const attributes: ParsedAttribute[] = [];
  let index = 0;
  while (index < source.length) {
    while (/\s/.test(source[index] ?? '')) index += 1;
    if (index >= source.length) break;

    const nameMatch = source.slice(index).match(/^([A-Za-z_:][A-Za-z0-9_.:-]*)/);
    if (!nameMatch) return null;
    const name = nameMatch[1];
    index += name.length;
    while (/\s/.test(source[index] ?? '')) index += 1;
    if (source[index] !== '=') return null;
    index += 1;
    while (/\s/.test(source[index] ?? '')) index += 1;
    const quote = source[index];
    if (quote !== '"' && quote !== "'") return null;
    index += 1;
    const valueStart = index;
    while (index < source.length && source[index] !== quote) index += 1;
    if (index >= source.length) return null;
    attributes.push({ name, value: source.slice(valueStart, index) });
    index += 1;
  }
  return attributes;
};

const resultWithIssue = (
  issue: SvgSanitizationIssue,
  sizeBytes: number,
  nodeCount = 0,
): SvgSanitizationResult => ({ ok: false, issues: [issue], sizeBytes, nodeCount });

export function sanitizeSvgDiagram(rawSvg: unknown): SvgSanitizationResult {
  if (typeof rawSvg !== 'string') {
    return resultWithIssue({ code: 'SVG_NOT_STRING', message: 'SVG phải là chuỗi.' }, 0);
  }

  const source = rawSvg.replace(/^\uFEFF/, '').trim();
  const sizeBytes = new TextEncoder().encode(source).byteLength;
  if (!source) {
    return resultWithIssue({ code: 'SVG_EMPTY', message: 'SVG không được để trống.' }, sizeBytes);
  }
  if (sizeBytes > MAX_SVG_BYTES) {
    return resultWithIssue({ code: 'SVG_TOO_LARGE', message: `SVG vượt quá ${MAX_SVG_BYTES} byte.` }, sizeBytes);
  }
  if (/<!DOCTYPE|<!ENTITY|<\?xml|<!\[CDATA\[|<!--/i.test(source)) {
    return resultWithIssue({ code: 'XML_DIRECTIVE_FORBIDDEN', message: 'SVG không được chứa directive, entity, CDATA hoặc comment.' }, sizeBytes);
  }

  const output: string[] = [];
  const stack: string[] = [];
  const seenIds = new Set<string>();
  let index = 0;
  let nodeCount = 0;
  let rootCount = 0;
  let textNodeCount = 0;
  let gradientCount = 0;
  let markerCount = 0;
  let rootHasXmlns = false;
  let rootHasViewBox = false;

  while (index < source.length) {
    const nextTag = source.indexOf('<', index);
    const textEnd = nextTag === -1 ? source.length : nextTag;
    const text = source.slice(index, textEnd);
    if (text) {
      if (stack.length === 0 && text.trim()) {
        return resultWithIssue({ code: 'TEXT_OUTSIDE_ROOT', message: 'Không được có nội dung ngoài thẻ SVG.' }, sizeBytes, nodeCount);
      }
      if (stack.length > 0) {
        if (text.length > MAX_ATTRIBUTE_LENGTH) {
          return resultWithIssue({ code: 'TEXT_TOO_LONG', message: 'Một nút chữ SVG quá dài.' }, sizeBytes, nodeCount);
        }
        output.push(escapeText(text));
      }
    }
    if (nextTag === -1) break;

    const tagEnd = findTagEnd(source, nextTag + 1);
    if (tagEnd < 0) {
      return resultWithIssue({ code: 'XML_MALFORMED', message: 'SVG chưa đóng thẻ hợp lệ.' }, sizeBytes, nodeCount);
    }
    let tagBody = source.slice(nextTag + 1, tagEnd).trim();
    if (!tagBody || tagBody.startsWith('!') || tagBody.startsWith('?')) {
      return resultWithIssue({ code: 'XML_MALFORMED', message: 'Thẻ SVG không hợp lệ.' }, sizeBytes, nodeCount);
    }

    if (tagBody.startsWith('/')) {
      const closingName = tagBody.slice(1).trim();
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(closingName) || stack.pop() !== closingName) {
        return resultWithIssue({ code: 'XML_MALFORMED', message: 'Cấu trúc đóng thẻ SVG không hợp lệ.' }, sizeBytes, nodeCount);
      }
      output.push(`</${closingName}>`);
      index = tagEnd + 1;
      continue;
    }

    const selfClosing = /\/\s*$/.test(tagBody);
    if (selfClosing) tagBody = tagBody.replace(/\/\s*$/, '').trim();
    const nameMatch = tagBody.match(/^([A-Za-z][A-Za-z0-9]*)/);
    if (!nameMatch) {
      return resultWithIssue({ code: 'XML_MALFORMED', message: 'Tên thẻ SVG không hợp lệ.' }, sizeBytes, nodeCount);
    }
    const tagName = nameMatch[1];
    if (!ALLOWED_TAGS.has(tagName)) {
      const code = FORBIDDEN_TAGS.has(tagName) ? 'FORBIDDEN_TAG' : 'TAG_NOT_ALLOWED';
      return resultWithIssue({ code, message: `Thẻ <${tagName}> không được phép.`, path: tagName }, sizeBytes, nodeCount);
    }

    nodeCount += 1;
    if (nodeCount > MAX_NODES) {
      return resultWithIssue({ code: 'NODE_LIMIT_EXCEEDED', message: 'SVG có quá nhiều node.' }, sizeBytes, nodeCount);
    }
    if (stack.length + 1 > MAX_DEPTH) {
      return resultWithIssue({ code: 'DEPTH_LIMIT_EXCEEDED', message: 'SVG lồng thẻ quá sâu.' }, sizeBytes, nodeCount);
    }
    if (tagName === 'text' || tagName === 'tspan') {
      textNodeCount += 1;
      if (textNodeCount > MAX_TEXT_NODES) {
        return resultWithIssue({ code: 'TEXT_NODE_LIMIT_EXCEEDED', message: 'SVG có quá nhiều nhãn chữ.' }, sizeBytes, nodeCount);
      }
    }
    if (tagName === 'linearGradient' || tagName === 'radialGradient') {
      gradientCount += 1;
      if (gradientCount > MAX_GRADIENTS) {
        return resultWithIssue({ code: 'GRADIENT_LIMIT_EXCEEDED', message: 'SVG có quá nhiều gradient.' }, sizeBytes, nodeCount);
      }
    }
    if (tagName === 'marker') {
      markerCount += 1;
      if (markerCount > MAX_MARKERS) {
        return resultWithIssue({ code: 'MARKER_LIMIT_EXCEEDED', message: 'SVG có quá nhiều marker.' }, sizeBytes, nodeCount);
      }
    }

    if (stack.length === 0) {
      rootCount += 1;
      if (tagName !== 'svg' || rootCount > 1) {
        return resultWithIssue({ code: 'INVALID_ROOT', message: 'SVG phải có đúng một thẻ gốc <svg>.' }, sizeBytes, nodeCount);
      }
    } else if (tagName === 'svg') {
      return resultWithIssue({ code: 'NESTED_SVG_FORBIDDEN', message: 'Không cho phép thẻ svg lồng nhau.' }, sizeBytes, nodeCount);
    }

    const attributes = parseAttributes(tagBody.slice(tagName.length));
    if (!attributes) {
      return resultWithIssue({ code: 'XML_MALFORMED', message: `Thuộc tính của <${tagName}> không hợp lệ.` }, sizeBytes, nodeCount);
    }
    const attributeNames = new Set<string>();
    const safeAttributes: string[] = [];
    for (const attribute of attributes) {
      const lowerName = attribute.name.toLowerCase();
      if (attributeNames.has(attribute.name)) {
        return resultWithIssue({ code: 'DUPLICATE_ATTRIBUTE', message: `Thuộc tính ${attribute.name} bị lặp.`, path: attribute.name }, sizeBytes, nodeCount);
      }
      attributeNames.add(attribute.name);
      if (lowerName.startsWith('on') || lowerName === 'href' || lowerName === 'xlink:href' || lowerName === 'src' || lowerName === 'style') {
        return resultWithIssue({ code: 'FORBIDDEN_ATTRIBUTE', message: `Thuộc tính ${attribute.name} không được phép.`, path: attribute.name }, sizeBytes, nodeCount);
      }
      if (STRIPPED_ATTRIBUTES.has(attribute.name)) continue;
      if (!ALLOWED_ATTRIBUTES.has(attribute.name)) {
        return resultWithIssue({ code: 'ATTRIBUTE_NOT_ALLOWED', message: `Thuộc tính ${attribute.name} không được phép.`, path: attribute.name }, sizeBytes, nodeCount);
      }
      if (attribute.value.length > MAX_ATTRIBUTE_LENGTH) {
        return resultWithIssue({ code: 'ATTRIBUTE_TOO_LONG', message: `Thuộc tính ${attribute.name} quá dài.`, path: attribute.name }, sizeBytes, nodeCount);
      }
      if (attribute.name === 'd' && attribute.value.length > MAX_PATH_LENGTH) {
        return resultWithIssue({ code: 'PATH_TOO_LONG', message: 'Dữ liệu path SVG quá dài.', path: 'd' }, sizeBytes, nodeCount);
      }
      if (attribute.name !== 'xmlns' && unsafeValue(attribute.value)) {
        return resultWithIssue({ code: 'UNSAFE_ATTRIBUTE_VALUE', message: `Giá trị ${attribute.name} không an toàn.`, path: attribute.name }, sizeBytes, nodeCount);
      }
      const containsUrlFunction = /url\s*\(/i.test(attribute.value);
      if ((URL_REFERENCE_ATTRIBUTES.has(attribute.name) || containsUrlFunction)
        && !validLocalReference(attribute.value)) {
        return resultWithIssue({ code: 'UNSAFE_URL_REFERENCE', message: `${attribute.name} chỉ được tham chiếu ID nội bộ.`, path: attribute.name }, sizeBytes, nodeCount);
      }
      if (attribute.name === 'id') {
        if (!/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(attribute.value) || seenIds.has(attribute.value)) {
          return resultWithIssue({ code: 'INVALID_ID', message: 'ID SVG không hợp lệ hoặc bị trùng.', path: 'id' }, sizeBytes, nodeCount);
        }
        seenIds.add(attribute.value);
      }
      if (attribute.name === 'xmlns') {
        if (tagName !== 'svg' || stack.length !== 0 || attribute.value !== SAFE_XMLNS) {
          return resultWithIssue({ code: 'INVALID_XMLNS', message: 'Namespace SVG không hợp lệ.', path: 'xmlns' }, sizeBytes, nodeCount);
        }
        rootHasXmlns = true;
      }
      if (attribute.name === 'viewBox') {
        if (tagName !== 'svg' || stack.length !== 0 || !validViewBox(attribute.value)) {
          return resultWithIssue({ code: 'INVALID_VIEWBOX', message: 'viewBox SVG không hợp lệ.', path: 'viewBox' }, sizeBytes, nodeCount);
        }
        rootHasViewBox = true;
      }
      safeAttributes.push(`${attribute.name}="${escapeAttribute(attribute.value)}"`);
    }

    output.push(`<${tagName}${safeAttributes.length > 0 ? ` ${safeAttributes.join(' ')}` : ''}${selfClosing ? '/>' : '>'}`);
    if (!selfClosing) stack.push(tagName);
    index = tagEnd + 1;
  }

  if (rootCount !== 1 || stack.length > 0) {
    return resultWithIssue({ code: 'XML_MALFORMED', message: 'SVG chưa đóng đầy đủ hoặc không có thẻ gốc.' }, sizeBytes, nodeCount);
  }
  if (!rootHasXmlns) {
    return resultWithIssue({ code: 'MISSING_XMLNS', message: 'SVG phải có xmlns chuẩn.' }, sizeBytes, nodeCount);
  }
  if (!rootHasViewBox) {
    return resultWithIssue({ code: 'MISSING_VIEWBOX', message: 'SVG phải có viewBox.' }, sizeBytes, nodeCount);
  }

  const sanitizedSvg = output.join('');
  return { ok: true, sanitizedSvg, issues: [], sizeBytes, nodeCount };
}
