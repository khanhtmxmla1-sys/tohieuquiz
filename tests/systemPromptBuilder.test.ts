import { describe, expect, it } from 'vitest';
import { buildGeneratorSystemPrompt } from '../src/services/ai/prompts/systemPromptBuilder';

describe('V3 generator system prompt', () => {
  it('requires JSON only and forbids visible reasoning', () => {
    const prompt = buildGeneratorSystemPrompt({
      provider: 'gemini',
      supportsRetrievalContext: false,
      supportsImages: true,
    }, 'ai-blueprint-v3');

    expect(prompt).toContain('Chỉ trả về một JSON object hợp lệ');
    expect(prompt).toContain('Không trả về thought_process');
    expect(prompt).toContain('Không được đổi slotId, type hoặc difficulty');
  });

  it('does not tell a non-retrieval provider to search the internet', () => {
    const prompt = buildGeneratorSystemPrompt({
      provider: 'openai',
      supportsRetrievalContext: false,
      supportsImages: true,
    }, 'ai-blueprint-v3');

    expect(prompt).not.toMatch(/tìm kiếm trên internet|violympic|vndoc/i);
    expect(prompt).toContain('Không được tuyên bố đã tìm kiếm hoặc kiểm chứng nguồn bên ngoài');
  });

  it('uses supplied retrieval context without claiming independent browsing', () => {
    const prompt = buildGeneratorSystemPrompt({
      provider: 'perplexity',
      supportsRetrievalContext: true,
      supportsImages: false,
    }, 'ai-blueprint-v3');

    expect(prompt).toContain('Chỉ sử dụng ngữ cảnh truy xuất được cung cấp');
    expect(prompt).not.toContain('Hãy tự tìm kiếm');
  });
});
