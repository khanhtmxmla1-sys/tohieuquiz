import { requestWorkerAi } from './ai/workerAiClient';

const DEFAULT_MODEL = 'gemini-3-pro-image-preview';

export interface ImageGenerationResult {
  success: boolean;
  data?: string;
  error?: string;
}

const findImageUrl = (value: unknown, depth = 0): string => {
  if (depth > 8 || value == null) return '';
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized.startsWith('data:image/') || /^https:\/\//i.test(normalized)) return normalized;
    const markdown = normalized.match(/!\[[^\]]*\]\((https?:\/\/[^)]+|data:image\/[^)]+)\)/i);
    return markdown?.[1] || '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageUrl(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  const object = value as Record<string, unknown>;
  if (typeof object.b64_json === 'string' && object.b64_json) {
    return `data:image/png;base64,${object.b64_json}`;
  }
  const preferred = ['url', 'image_url', 'images', 'data', 'choices', 'message', 'delta', 'content'];
  for (const key of preferred) {
    const found = findImageUrl(object[key], depth + 1);
    if (found) return found;
  }
  return '';
};

export const checkImageServiceAvailability = async (): Promise<boolean> => true;

export const generateImage = async (prompt: string): Promise<ImageGenerationResult> => {
  try {
    const result = await requestWorkerAi({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      max_tokens: 4096,
    });
    const imageUrl = findImageUrl([...result.payloads, result.text]);
    if (!imageUrl) throw new Error('AI kh?ng tr? v? d? li?u h?nh ?nh.');
    return { success: true, data: imageUrl };
  } catch (error: unknown) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    console.error('Image generation failed:', normalized.message);
    return { success: false, error: normalized.message };
  }
};
