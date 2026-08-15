import { QuestionType, type Quiz } from '../../../types';
import { sanitizeSvgDiagram } from '../../../../shared/svgDiagramSanitizer';

export type WorksheetRasterImageType = 'jpg' | 'png' | 'gif' | 'bmp';

export interface WorksheetImageAsset {
    source: string;
    dataUrl: string;
    bytes: Uint8Array;
    type: WorksheetRasterImageType;
}

export type WorksheetImageAssetMap = Map<string, WorksheetImageAsset>;

export const worksheetQuestionImageKey = (questionIndex: number): string => `q:${questionIndex}:image`;
export const worksheetOptionImageKey = (questionIndex: number, optionIndex: number): string =>
    `q:${questionIndex}:option:${optionIndex}`;

const typeFromMime = (mime: string): WorksheetRasterImageType | null => {
    const normalized = mime.toLowerCase();
    if (normalized.includes('png')) return 'png';
    if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
    if (normalized.includes('gif')) return 'gif';
    if (normalized.includes('bmp')) return 'bmp';
    return null;
};

const base64ToBytes = (value: string): Uint8Array => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
};

const loadRasterImage = async (source: string): Promise<WorksheetImageAsset | null> => {
    const dataMatch = source.match(/^data:([^;,]+);base64,(.+)$/i);
    if (dataMatch) {
        const type = typeFromMime(dataMatch[1]);
        if (!type) return null;
        return { source, dataUrl: source, bytes: base64ToBytes(dataMatch[2]), type };
    }

    if (!/^https?:\/\//i.test(source)) return null;
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Không tải được hình (${response.status}).`);
    const mime = response.headers.get('content-type') || '';
    const type = typeFromMime(mime);
    if (!type) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
        source,
        type,
        bytes,
        dataUrl: `data:${mime.split(';')[0]};base64,${bytesToBase64(bytes)}`,
    };
};

export async function prepareWorksheetImageAssets(quiz: Quiz): Promise<WorksheetImageAssetMap> {
    const assets: WorksheetImageAssetMap = new Map();
    await Promise.all(quiz.questions.flatMap((question, questionIndex) => {
        const record = question as unknown as Record<string, unknown>;
        const entries: Array<Promise<void>> = [];
        const image = typeof record.image === 'string' ? record.image.trim() : '';
        if (image && !image.includes('placehold.co')) {
            entries.push(loadRasterImage(image).then((asset) => {
                if (!asset) throw new Error(`Câu ${questionIndex + 1}: định dạng hình chính không được hỗ trợ.`);
                assets.set(worksheetQuestionImageKey(questionIndex), asset);
            }));
        }

        const optionImages = Array.isArray(record.optionImages) ? record.optionImages : [];
        optionImages.forEach((value, optionIndex) => {
            const source = typeof value === 'string' ? value.trim() : '';
            if (!source || source.includes('placehold.co')) return;
            entries.push(loadRasterImage(source).then((asset) => {
                if (!asset) {
                    throw new Error(`Câu ${questionIndex + 1}, lựa chọn ${optionIndex + 1}: định dạng hình không được hỗ trợ.`);
                }
                assets.set(worksheetOptionImageKey(questionIndex, optionIndex), asset);
            }));
        });
        return entries;
    }));
    return assets;
}

const hasPrintableGeometryData = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    const data = value as Record<string, unknown>;
    const type = String(data.type || '').toLowerCase();
    if (['square', 'rectangle', 'triangle', 'circle', 'line'].includes(type)) return true;
    const vertices = Array.isArray(data.vertices) ? data.vertices : [];
    const lines = Array.isArray(data.lines) ? data.lines : [];
    const circles = Array.isArray(data.circles) ? data.circles : [];
    return vertices.length >= 2 || lines.length > 0 || circles.length > 0;
};

const hasPrintableSvg = (record: Record<string, unknown>): boolean => {
    const raw = record.svgContent ?? record.svg_content;
    if (typeof raw !== 'string' || !raw.trim()) return false;
    const sanitized = sanitizeSvgDiagram(raw);
    return Boolean(sanitized.ok && sanitized.sanitizedSvg);
};

export function validateWorksheetRequiredVisuals(quiz: Quiz): void {
    quiz.questions.forEach((question, index) => {
        const record = question as unknown as Record<string, unknown>;
        if (question.type === QuestionType.IMAGE_QUESTION) {
            const image = typeof record.image === 'string' ? record.image.trim() : '';
            if (!image || image.includes('placehold.co')) {
                throw new Error(`Câu ${index + 1}: câu hỏi hình ảnh đang thiếu hình bắt buộc.`);
            }
        }

        if (question.type === QuestionType.GEOMETRY
            && !hasPrintableGeometryData(record.geometryData)
            && !hasPrintableSvg(record)) {
            throw new Error(`Câu ${index + 1}: câu hình học đang thiếu hình hoặc SVG có thể in.`);
        }
    });
}

