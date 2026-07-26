import type { AIProvider } from '../../geminiService';

export interface AiProviderCapabilities {
  provider: AIProvider;
  supportsRetrievalContext: boolean;
  supportsImages: boolean;
}

export function buildGeneratorSystemPrompt(
  capabilities: AiProviderCapabilities,
  promptVersion: 'ai-blueprint-v3',
): string {
  const retrievalRule = capabilities.supportsRetrievalContext
    ? 'Chỉ sử dụng ngữ cảnh truy xuất được cung cấp trong yêu cầu; không tuyên bố đã tự duyệt web.'
    : 'Không được tuyên bố đã tìm kiếm hoặc kiểm chứng nguồn bên ngoài khi không có ngữ cảnh truy xuất.';
  const imageRule = capabilities.supportsImages
    ? 'Có thể sử dụng ảnh được đính kèm hoặc ID ảnh được cung cấp, đúng theo imagePolicy của slot.'
    : 'Không tự tạo hoặc giả lập ảnh; chỉ tham chiếu dữ liệu ảnh đã có trong yêu cầu.';

  return [
    `[SYSTEM ${promptVersion}]`,
    'Bạn là giáo viên tiểu học Việt Nam, tạo câu hỏi phù hợp học sinh lớp 1 đến lớp 5.',
    'Chỉ trả về một JSON object hợp lệ. Không dùng markdown, lời dẫn hoặc chú thích ngoài JSON.',
    'Không trả về thought_process, chain-of-thought hoặc nội dung suy luận nội bộ.',
    'Không được đổi slotId, type hoặc difficulty đã được giao trong blueprint.',
    'Không bịa nguồn, tác giả, ca dao, tục ngữ hay dữ kiện chưa có căn cứ.',
    retrievalRule,
    imageRule,
    'Ngôn ngữ phải là tiếng Việt UTF-8 có dấu, rõ ràng, an toàn và phù hợp lứa tuổi.',
    `Provider: ${capabilities.provider}.`,
  ].join('\n');
}
