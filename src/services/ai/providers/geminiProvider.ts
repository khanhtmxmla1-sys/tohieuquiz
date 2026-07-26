/**
 * @module geminiProvider
 * Generates quiz JSON through the authenticated Worker AI proxy.
 */

import { SYSTEM_INSTRUCTION } from '../../../config/constants';
import type { QuizAiExecutionContext } from '../aiAction';
import { parseAndRepairJSON, validateAndFixQuiz } from '../utils/jsonRepair';
import { fileToBase64, urlToBase64 } from '../utils/networkHelpers';
import { requestWorkerAiText } from '../workerAiClient';

type ImageLibraryItem = { id: string; name: string; data?: string };

const formatMathSigns = (text: string): string =>
  text
    .replace(/\s\*\s/g, ' x ')
    .replace(/\)\s*\*\s*/g, ') x ')
    .replace(/\s*\*\s*\(/g, ' x (')
    .replace(/([a-zA-Z0-9?])\s*\*\s*([a-zA-Z0-9?(])/g, '$1 x $2')
    .replace(/([a-zA-Z0-9?]+)\s+\/\s+([a-zA-Z0-9?]+)/g, '$1 : $2');

const resolveImageLibrary = (
  quiz: Record<string, unknown>,
  imageLibrary: ImageLibraryItem[],
): Record<string, unknown> => {
  if (!imageLibrary.length || !quiz.questions) return quiz;
  const questions = (quiz.questions as Record<string, unknown>[]).map((question) => {
    if (question.type === 'IMAGE_QUESTION' && question.image) {
      const item = imageLibrary.find((image) => image.id === question.image || image.name === question.image);
      if (item?.data) return { ...question, image: item.data };
    }
    return question;
  });
  return { ...quiz, questions };
};

const toWorkerOptions = (execution?: QuizAiExecutionContext) => execution ? {
  action: {
    ...execution.action,
    stage: execution.stage,
    ...(execution.diagnostics ?? {}),
  },
  signal: execution.signal,
} : undefined;

export const generateWithGemini = async (
  promptText: string,
  _apiKey: string,
  file?: File | null,
  imageLibrary?: ImageLibraryItem[],
  _onStepChange?: (step: 'generating' | 'reviewing' | 'repairing' | 'completed') => void,
  execution?: QuizAiExecutionContext,
  systemInstruction?: string,
): Promise<unknown> => {
  const userContent: Record<string, unknown>[] = [{ type: 'text', text: promptText }];

  if (file) {
    const base64Data = await fileToBase64(file);
    const isPdf = file.type === 'application/pdf';
    userContent.unshift({
      type: 'text',
      text: `TÀI LIỆU ĐÍNH KÈM - ưu tiên nội dung trong ${isPdf ? 'PDF' : 'hình ảnh'} ${file.name}.`,
    });
    userContent.splice(1, 0, isPdf
      ? { type: 'input_file', file_data: `data:${file.type};base64,${base64Data}`, filename: file.name }
      : { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64Data}` } });
  }

  if (imageLibrary?.length) {
    userContent.push({ type: 'text', text: 'THƯ VIỆN HÌNH ẢNH:' });
    for (const image of imageLibrary) {
      if (image.data?.startsWith('http')) {
        try {
          const { data, mimeType } = await urlToBase64(image.data);
          userContent.push({ type: 'text', text: `Image ID: ${image.id} (${image.name})` });
          userContent.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } });
        } catch {
          console.warn(`[generateWithGemini] Không tải được hình ${image.id}.`);
        }
      }
    }
  }

  const messages = [
    { role: 'system', content: systemInstruction ?? SYSTEM_INSTRUCTION },
    { role: 'user', content: userContent },
  ];

  const maxRetries = execution ? 1 : 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const text = await requestWorkerAiText({
        model: 'gemini-2.5-flash',
        messages,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }, toWorkerOptions(execution));
      const parsed = parseAndRepairJSON(formatMathSigns(text)) as Record<string, unknown>;
      const quizData = systemInstruction ? parsed : validateAndFixQuiz(parsed) as Record<string, unknown>;
      return resolveImageLibrary(quizData, imageLibrary || []);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Không thể tạo đề bằng AI.');
};
