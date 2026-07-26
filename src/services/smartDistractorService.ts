/**
 * Smart Distractor Service
 * 
 * Generates plausible wrong answers (distractors) for quiz questions
 * using AI. Supports MCQ, MULTIPLE_SELECT, and IMAGE_QUESTION types.
 * 
 * Uses LLM-Mux (OpenAI-compatible API) for AI calls.
 */

import { requestWorkerAiText } from './ai/workerAiClient';

// Call AI via the JWT-authenticated Worker proxy.
async function callLLM(prompt: string): Promise<string> {
    return requestWorkerAiText({
        model: 'gemini-2.5-flash',
        messages: [
            {
                role: 'system',
                content: 'B?n l? chuy?n gia gi?o d?c ti?u h?c Vi?t Nam. T?o ??p ?n nhi?u ch?t l??ng cao v? ch? tr? v? JSON.',
            },
            { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
    });
}

// Parse JSON from LLM response (handles markdown code blocks)
function parseJSONResponse(text: string): string[] {
    // Remove markdown code blocks if present (handle \r\n and various formats)
    let cleaned = text.trim();
    // Strip ```json ... ``` or ``` ... ``` blocks
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
    }

    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            return parsed.map(String).filter(s => s.trim().length > 0);
        }
        if (parsed.distractors && Array.isArray(parsed.distractors)) {
            return parsed.distractors.map(String).filter((s: string) => s.trim().length > 0);
        }
        console.warn('[SmartDistractor] Parsed OK but not array/distractors:', typeof parsed);
        return [];
    } catch (e) {
        console.warn('[SmartDistractor] JSON.parse failed:', (e as Error).message);
        // Try to extract array from text
        const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            try {
                const arr = JSON.parse(arrayMatch[0]);
                if (Array.isArray(arr)) {
                    return arr.map(String).filter(s => s.trim().length > 0);
                }
            } catch (e2) {
                console.error('[SmartDistractor] Array extraction also failed:', (e2 as Error).message);
            }
        }
        return [];
    }
}

export interface SmartDistractorParams {
    question: string;
    correctAnswer: string;
    classLevel: string;
    difficulty?: 1 | 2 | 3;
    existingOptions?: string[];
    count?: number;
}

/**
 * Generate smart distractors using AI
 * 
 * @param params - Parameters for generating distractors
 * @returns Array of plausible wrong answers
 */
export async function generateSmartDistractors(params: SmartDistractorParams): Promise<string[]> {
    const {
        question,
        correctAnswer,
        classLevel,
        difficulty = 2,
        existingOptions = [],
        count = 3,
    } = params;

    const difficultyLabel = difficulty === 1 ? 'Dễ' : difficulty === 2 ? 'Trung bình' : 'Khó';

    const prompt = `Tạo ${count} đáp án nhiễu (WRONG answers) cho câu hỏi trắc nghiệm tiểu học sau:

📝 CÂU HỎI: ${question}
✅ ĐÁP ÁN ĐÚNG: ${correctAnswer}
🎓 LỚP: ${classLevel}
⚡ ĐỘ KHÓ: ${difficultyLabel}
${existingOptions.length > 0 ? `🚫 KHÔNG TRÙNG với: ${existingOptions.join(', ')}` : ''}

YÊU CẦU:
1. Mỗi đáp án nhiễu phải NGHE HỢP LÝ nhưng SAI (plausible wrong answers)
2. Dựa trên lỗi thực tế mà học sinh lớp ${classLevel} thường mắc phải (common misconceptions)
3. Đáp án nhiễu phải cùng dạng/format với đáp án đúng (nếu đáp án đúng là số → đáp án nhiễu cũng phải là số)
4. Độ dài tương đương với đáp án đúng
5. KHÔNG có đáp án nào giống đáp án đúng "${correctAnswer}"
6. ${difficulty === 1 ? 'Đáp án nhiễu DỄ NHẬN RA là sai' : difficulty === 2 ? 'Đáp án nhiễu có MỨC KHÓ TRUNG BÌNH' : 'Đáp án nhiễu RẤT GẦN ĐÚNG, cần phân tích kỹ mới biết sai'}

Trả về JSON array gồm ĐÚNG ${count} string. Ví dụ: ["đáp án sai 1", "đáp án sai 2", "đáp án sai 3"]
CHỈ trả về JSON array, KHÔNG thêm giải thích.`;

    const response = await callLLM(prompt);
    const distractors = parseJSONResponse(response);

    if (distractors.length === 0) {
        throw new Error('AI không thể tạo đáp án nhiễu. Vui lòng thử lại.');
    }

    // Ensure we don't return the correct answer
    const filtered = distractors
        .filter(d => d.toLowerCase().trim() !== correctAnswer.toLowerCase().trim())
        .slice(0, count);

    return filtered;
}
