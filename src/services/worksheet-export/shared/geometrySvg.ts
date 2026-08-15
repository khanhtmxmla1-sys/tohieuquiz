interface GeometryPoint {
    x: number;
    y: number;
    label?: string;
}

interface GeometryLine {
    from: GeometryPoint;
    to: GeometryPoint;
    label?: string;
}

interface GeometryCircle {
    center: GeometryPoint;
    radius: number;
    label?: string;
    radiusLabel?: string;
}

interface GeometryData {
    type?: string;
    vertices?: GeometryPoint[];
    lines?: GeometryLine[];
    circles?: GeometryCircle[];
    measurements?: Record<string, string>;
    width?: number;
    height?: number;
    title?: string;
}

const escapeXml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const defaultsForType = (type: string): Partial<GeometryData> => {
    switch (type) {
        case 'square':
            return { vertices: [
                { x: 35, y: 35, label: 'A' }, { x: 165, y: 35, label: 'B' },
                { x: 165, y: 165, label: 'C' }, { x: 35, y: 165, label: 'D' },
            ] };
        case 'rectangle':
            return { vertices: [
                { x: 20, y: 55, label: 'A' }, { x: 180, y: 55, label: 'B' },
                { x: 180, y: 145, label: 'C' }, { x: 20, y: 145, label: 'D' },
            ] };
        case 'triangle':
            return { vertices: [
                { x: 25, y: 35, label: 'A' }, { x: 175, y: 35, label: 'B' },
                { x: 100, y: 165, label: 'C' },
            ] };
        case 'circle':
            return { circles: [{ center: { x: 100, y: 100, label: 'O' }, radius: 60, label: 'O' }] };
        case 'line':
            return { lines: [{ from: { x: 25, y: 100, label: 'A' }, to: { x: 175, y: 100, label: 'B' } }] };
        default:
            return {};
    }
};

export function createWorksheetGeometrySvg(rawData: unknown): string | null {
    if (!rawData || typeof rawData !== 'object') return null;
    const input = rawData as GeometryData;
    const type = String(input.type || '').toLowerCase();
    const defaults = defaultsForType(type);
    const width = Number.isFinite(input.width) && Number(input.width) > 0 ? Number(input.width) : 200;
    const height = Number.isFinite(input.height) && Number(input.height) > 0 ? Number(input.height) : 200;
    const padding = 30;
    const vertices = input.vertices?.length ? input.vertices : defaults.vertices || [];
    const lines = input.lines?.length ? input.lines : defaults.lines || [];
    const circles = input.circles?.length ? input.circles : defaults.circles || [];
    const toX = (x: number) => x + padding;
    const toY = (y: number) => height - y + padding;
    const parts: string[] = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + padding * 2} ${height + padding * 2}">`,
        `<rect x="0" y="0" width="100%" height="100%" fill="white"/>`,
    ];

    if (input.title) {
        parts.push(`<text x="${(width + padding * 2) / 2}" y="18" text-anchor="middle" font-family="Times New Roman" font-size="14">${escapeXml(input.title)}</text>`);
    }

    if (vertices.length >= 2 && ['triangle', 'rectangle', 'square', 'polygon', 'custom'].includes(type)) {
        const points = vertices.map(point => `${toX(point.x)},${toY(point.y)}`).join(' ');
        parts.push(`<polygon points="${points}" fill="none" stroke="black" stroke-width="2"/>`);
    }

    vertices.forEach((point) => {
        parts.push(`<circle cx="${toX(point.x)}" cy="${toY(point.y)}" r="3" fill="black"/>`);
        if (point.label) {
            parts.push(`<text x="${toX(point.x) + 7}" y="${toY(point.y) - 7}" font-family="Times New Roman" font-size="14">${escapeXml(point.label)}</text>`);
        }
    });

    lines.forEach((line) => {
        parts.push(`<line x1="${toX(line.from.x)}" y1="${toY(line.from.y)}" x2="${toX(line.to.x)}" y2="${toY(line.to.y)}" stroke="black" stroke-width="2"/>`);
        [line.from, line.to].forEach((point) => {
            if (point.label) parts.push(`<text x="${toX(point.x) + 6}" y="${toY(point.y) - 6}" font-family="Times New Roman" font-size="14">${escapeXml(point.label)}</text>`);
        });
        if (line.label) {
            parts.push(`<text x="${(toX(line.from.x) + toX(line.to.x)) / 2}" y="${(toY(line.from.y) + toY(line.to.y)) / 2 - 6}" text-anchor="middle" font-family="Times New Roman" font-size="14">${escapeXml(line.label)}</text>`);
        }
    });

    circles.forEach((circle) => {
        parts.push(`<circle cx="${toX(circle.center.x)}" cy="${toY(circle.center.y)}" r="${Math.max(1, Number(circle.radius) || 1)}" fill="none" stroke="black" stroke-width="2"/>`);
        const label = circle.label || circle.center.label;
        if (label) parts.push(`<text x="${toX(circle.center.x) + 6}" y="${toY(circle.center.y) - 6}" font-family="Times New Roman" font-size="14">${escapeXml(label)}</text>`);
        if (circle.radiusLabel) parts.push(`<text x="${toX(circle.center.x) + Number(circle.radius) / 2}" y="${toY(circle.center.y) - 6}" font-family="Times New Roman" font-size="14">${escapeXml(circle.radiusLabel)}</text>`);
    });

    Object.entries(input.measurements || {}).forEach(([key, value], index) => {
        parts.push(`<text x="${padding}" y="${height + padding + 16 + index * 16}" font-family="Times New Roman" font-size="14">${escapeXml(key)} = ${escapeXml(value)}</text>`);
    });

    parts.push('</svg>');
    return parts.join('');
}
