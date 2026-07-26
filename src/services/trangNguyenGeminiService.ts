/**
 * Trạng Nguyên Tiếng Việt - Gemini Service
 * Service sinh đề thi Trạng Nguyên với 7 dạng câu hỏi
 */

import { QuestionType } from '../types';
import { requestWorkerAiText } from './ai/workerAiClient';

// ============ MASTER SYSTEM PROMPT ============
const TRANG_NGUYEN_SYSTEM_PROMPT = `### ROLE
Bạn là một AI chuyên gia soạn thảo đề thi và nội dung giáo dục trực tuyến cho cuộc thi Trạng Nguyên Tiếng Việt.
Nhiệm vụ của bạn là sinh ra các câu hỏi trắc nghiệm chất lượng cao, chính xác về kiến thức, phù hợp với lứa tuổi học sinh tiểu học Việt Nam, và tuân thủ chặt chẽ định dạng dữ liệu được yêu cầu.

### OUTPUT FORMAT (JSON ONLY)
Bạn TUYỆT ĐỐI KHÔNG được trả lời bằng văn bản thông thường. Bạn chỉ được trả về một JSON Object duy nhất chứa mảng danh sách câu hỏi.
Cấu trúc JSON chuẩn cho từng câu hỏi:

{
  "questions": [
    {
      "type": "string (single_choice | multiple_select | fill_blank | matching | grouping | rearrange | reading)",
      "difficulty": "string (easy | medium | hard)",
      "topic": "string",
      "content": "string (Nội dung câu hỏi hoặc đoạn văn bản gốc)",
      "options": ["string", "string", ...],
      "correct_answer": "mixed (string | array | object)",
      "explanation": "string (Giải thích chi tiết tại sao đúng)"
    }
  ]
}

### QUY TẮC CHUNG
1. "content" không chứa đáp án, chỉ chứa câu hỏi.
2. "explanation" phải mang tính giáo dục, giải thích rõ bản chất.
3. Không thêm markdown như \`\`\`json ... \`\`\`, chỉ trả về raw JSON.
4. Ngôn ngữ: Tiếng Việt chuẩn, phù hợp với học sinh tiểu học.
5. Nội dung phải chính xác về kiến thức, đặc biệt với ca dao, tục ngữ, thành ngữ.`;

// ============ SPECIFIC PROMPTS FOR EACH QUESTION TYPE ============
const QUESTION_TYPE_PROMPTS: Record<string, string> = {
    single_choice: `Hãy tạo câu hỏi dạng "Trắc nghiệm đơn" (single_choice).
- Yêu cầu: Có 4 phương án A, B, C, D. Chỉ có duy nhất 1 đáp án đúng.
- Format JSON: "correct_answer" là chuỗi chứa đáp án đúng (VD: "A").`,

    multiple_select: `Hãy tạo câu hỏi dạng "Trắc nghiệm đa lựa chọn" (multiple_select).
- Yêu cầu: Có 4-5 phương án. Người học phải chọn TẤT CẢ các đáp án đúng (từ 2 đáp án trở lên).
- Format JSON: "correct_answer" là một mảng chứa các đáp án đúng (VD: ["A", "C"]).`,

    fill_blank: `Hãy tạo câu hỏi dạng "Điền từ" (fill_blank).
- Yêu cầu: Đưa ra một câu văn hoặc câu thơ có khuyết 1 từ/cụm từ quan trọng. Vị trí khuyết thay bằng ký tự "___".
- Format JSON: "correct_answer" là từ/cụm từ cần điền vào chỗ trống.`,

    matching: `Hãy tạo câu hỏi dạng "Ghép đôi" (matching).
- Yêu cầu: Có 2 cột dữ liệu (Cột A và Cột B). Người học cần ghép các mục ở cột A tương ứng với cột B.
- Format JSON: 
  + "options": Một mảng chứa 2 mảng con [List A, List B].
  + "correct_answer": Một mảng các cặp ghép đúng (VD: [["A1", "B3"], ["A2", "B1"]]).`,

    grouping: `Hãy tạo câu hỏi dạng "Phân nhóm" (grouping).
- Yêu cầu: Cho một danh sách các từ lộn xộn và yêu cầu kéo thả vào các nhóm đúng.
- Format JSON:
  + "content": "Hãy xếp các từ sau vào nhóm thích hợp: [Danh sách từ trộn lẫn]"
  + "correct_answer": Một object với key là tên nhóm và value là danh sách từ thuộc nhóm đó (VD: {"Từ láy": ["xinh xắn", "đo đỏ"], "Từ ghép": ["học tập"]}).`,

    rearrange: `Hãy tạo câu hỏi dạng "Sắp xếp" (rearrange).
- Yêu cầu: Cho một câu hoàn chỉnh bị đảo lộn trật tự các từ/vế câu.
- Format JSON:
  + "options": Mảng chứa các từ/cụm từ đã bị xáo trộn.
  + "correct_answer": Chuỗi câu hoàn chỉnh đúng ngữ pháp.`,

    reading: `Hãy tạo bài tập "Đọc hiểu văn bản" (reading).
- Yêu cầu: 
  1. Viết một đoạn văn ngắn (khoảng 100-150 chữ) mang tính giáo dục.
  2. Tạo 2-3 câu hỏi nhỏ dựa trên đoạn văn đó.
- Format JSON:
  + "content": Chứa toàn bộ đoạn văn bản gốc.
  + "sub_questions": Một mảng chứa các object câu hỏi con (cấu trúc giống như câu hỏi đơn lẻ).`
};

// ============ TOPIC SUGGESTIONS FOR TRẠNG NGUYÊN ============
const TRANG_NGUYEN_TOPICS = {
    tiengViet: [
        'Từ đồng nghĩa, trái nghĩa',
        'Thành ngữ, tục ngữ Việt Nam',
        'Từ láy và từ ghép',
        'Chính tả tiếng Việt',
        'Luyện từ và câu',
        'Biện pháp tu từ (So sánh, Nhân hóa)',
        'Danh từ, động từ, tính từ',
        'Câu ghép, câu đơn',
        'Dấu câu tiếng Việt',
        'Đọc hiểu văn bản'
    ],
    toan: [
        'Phép cộng, trừ trong phạm vi 100',
        'Phép nhân, chia',
        'Phân số',
        'Hình học: Chu vi, diện tích',
        'Đo lường: Đơn vị đo',
        'Giải toán có lời văn'
    ],
    tuNhien: [
        'Động vật và thực vật',
        'Con người và sức khỏe',
        'Môi trường tự nhiên',
        'Lịch sử Việt Nam',
        'Địa lý Việt Nam'
    ]
};

export interface TrangNguyenGenerationOptions {
    topic: string;
    classLevel: string;
    questionTypes: string[];
    questionCount: number;
    difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
    customPrompt?: string;
    enableSearch?: boolean; // If true, search for real exam questions first (slower but higher quality)
}

export interface TrangNguyenQuestion {
    type: string;
    difficulty: string;
    topic: string;
    content: string;
    options?: string[];
    correct_answer: string | string[] | Record<string, string[]>;
    explanation: string;
    sub_questions?: TrangNguyenQuestion[];
}

export interface TrangNguyenQuizResult {
    questions: TrangNguyenQuestion[];
}

/**
 * Build user prompt for specific question types
 */
const buildUserPrompt = (options: TrangNguyenGenerationOptions): string => {
    const { topic, classLevel, questionTypes, questionCount, difficulty, customPrompt } = options;

    // Build type-specific instructions
    const typeInstructions = questionTypes
        .map(type => QUESTION_TYPE_PROMPTS[type] || '')
        .filter(Boolean)
        .join('\n\n');

    const difficultyText = difficulty === 'mixed'
        ? 'Phân bố đều các mức độ: Dễ, Trung bình, Khó'
        : `Độ khó: ${difficulty === 'easy' ? 'Dễ' : difficulty === 'hard' ? 'Khó' : 'Trung bình'}`;

    return `
=== YÊU CẦU TẠO ĐỀ THI TRẠNG NGUYÊN TIẾNG VIỆT ===

📚 THÔNG TIN ĐỀ THI:
- Chủ đề: ${topic}
- Lớp: ${classLevel}
- Số câu hỏi: ${questionCount}
- ${difficultyText}

📝 CÁC DẠNG CÂU HỎI CẦN TẠO:
${typeInstructions}

${customPrompt ? `
🔴 YÊU CẦU ĐẶC BIỆT TỪ GIÁO VIÊN:
${customPrompt}
` : ''}

⚠️ LƯU Ý QUAN TRỌNG:
1. Tạo ĐÚNG ${questionCount} câu hỏi
2. Nội dung phù hợp với học sinh Lớp ${classLevel}
3. Đảm bảo kiến thức chính xác, đặc biệt với thành ngữ, tục ngữ
4. Trả về JSON hợp lệ, không có markdown
5. Mỗi câu hỏi phải có explanation giải thích chi tiết
`;
};

/**
 * Parse and validate AI response
 */
const parseAIResponse = (text: string): TrangNguyenQuizResult => {

    // Remove markdown code blocks if present
    let cleaned = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*json\s*/i, '') // Remove leading "json" keyword
        .trim();

    // Try to find JSON structure - could be object or array
    let startIdx = cleaned.indexOf('{');
    let endIdx = cleaned.lastIndexOf('}');
    let isArrayResponse = false;

    // Check if response is an array instead of object
    if (startIdx === -1 || (cleaned.indexOf('[') !== -1 && cleaned.indexOf('[') < startIdx)) {
        startIdx = cleaned.indexOf('[');
        endIdx = cleaned.lastIndexOf(']');
        isArrayResponse = true;
    }

    if (startIdx === -1 || endIdx === -1) {
        console.error('[TrangNguyen] No JSON found in response:', cleaned.substring(0, 300));
        throw new Error('Không tìm thấy JSON hợp lệ trong response');
    }

    cleaned = cleaned.substring(startIdx, endIdx + 1);

    try {
        const parsed = JSON.parse(cleaned);

        // Handle array response - wrap in object
        if (isArrayResponse && Array.isArray(parsed)) {
            return { questions: parsed } as TrangNguyenQuizResult;
        }

        // Validate structure
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
            // Try to find questions in nested structure
            if (parsed.data && Array.isArray(parsed.data.questions)) {
                return { questions: parsed.data.questions } as TrangNguyenQuizResult;
            }
            console.error('[TrangNguyen] No questions array found in:', Object.keys(parsed));
            throw new Error('Response không có mảng questions');
        }

        return parsed as TrangNguyenQuizResult;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[TrangNguyen] JSON parse error:', msg);
        console.error('[TrangNguyen] Failed JSON snippet:', cleaned.substring(0, 500));
        throw new Error('AI trả về JSON không hợp lệ: ' + msg);
    }
};

/**
 * Convert Trạng Nguyên question format to app's Question format
 */
const convertToAppFormat = (tnQuestion: TrangNguyenQuestion, index: number): any => {
    const baseQuestion = {
        id: `tn-q-${Date.now()}-${index}`,
        explanation: tnQuestion.explanation
    };

    switch (tnQuestion.type) {
        case 'single_choice':
            return {
                ...baseQuestion,
                type: QuestionType.MCQ,
                question: tnQuestion.content,
                options: tnQuestion.options || [],
                correctAnswer: tnQuestion.correct_answer as string
            };

        case 'multiple_select':
            return {
                ...baseQuestion,
                type: QuestionType.MULTIPLE_SELECT,
                question: tnQuestion.content,
                options: tnQuestion.options || [],
                correctAnswers: tnQuestion.correct_answer as string[]
            };

        case 'fill_blank':
            return {
                ...baseQuestion,
                type: QuestionType.SHORT_ANSWER,
                question: tnQuestion.content,
                correctAnswer: tnQuestion.correct_answer as string
            };

        case 'matching':
            // Convert matching format to app's MATCHING type
            const matchOptions = tnQuestion.options as unknown as [string[], string[]];
            const pairs = (tnQuestion.correct_answer as unknown as string[][]).map(([left, right]) => ({
                left,
                right
            }));
            return {
                ...baseQuestion,
                type: QuestionType.MATCHING,
                question: tnQuestion.content,
                pairs
            };

        case 'grouping':
            // Convert grouping to CATEGORIZATION
            const groupAnswer = tnQuestion.correct_answer as Record<string, string[]>;
            const categories = Object.keys(groupAnswer).map((name, idx) => ({
                id: `cat-${idx}`,
                name
            }));
            const items = Object.entries(groupAnswer).flatMap(([catName, words], catIdx) =>
                words.map((word, wordIdx) => ({
                    id: `item-${catIdx}-${wordIdx}`,
                    content: word,
                    categoryId: `cat-${catIdx}`
                }))
            );
            return {
                ...baseQuestion,
                type: QuestionType.CATEGORIZATION,
                question: tnQuestion.content,
                categories,
                items
            };

        case 'rearrange':
            return {
                ...baseQuestion,
                type: QuestionType.ORDERING,
                question: 'Sắp xếp các từ/cụm từ sau thành câu hoàn chỉnh:',
                items: tnQuestion.options || [],
                correctOrder: (tnQuestion.correct_answer as string).split(' ').map((word, idx) => idx)
            };

        case 'reading':
            // Reading comprehension - convert sub_questions
            return {
                ...baseQuestion,
                type: QuestionType.TRUE_FALSE, // Using TRUE_FALSE as container for reading
                mainQuestion: tnQuestion.content,
                items: (tnQuestion.sub_questions || []).map((sq, sqIdx) => ({
                    statement: sq.content,
                    isCorrect: sq.correct_answer === 'true' || sq.correct_answer === 'A'
                }))
            };

        default:
            // Fallback to MCQ
            return {
                ...baseQuestion,
                type: QuestionType.MCQ,
                question: tnQuestion.content,
                options: tnQuestion.options || [],
                correctAnswer: tnQuestion.correct_answer as string
            };
    }
};

/**
 * Main function to generate Trạng Nguyên quiz
 * 1. Search for real exam questions from 2020-2026 via Perplexity
 * 2. Enrich prompt with search results
 * 3. Generate quiz with AI
 */
export const generateTrangNguyenQuiz = async (
    options: TrangNguyenGenerationOptions,
    aiProvider: 'gemini' | 'llm-mux' = 'llm-mux'
): Promise<{ title: string; questions: any[]; timeLimit: number }> => {

    const enableSearch = options.enableSearch !== false; // Default to true if not specified
    let userPrompt = buildUserPrompt(options);

    // Step 1: Search for real exam questions first (if enabled)
    if (enableSearch) {

        const { searchTrangNguyenQuestions, enrichPromptWithSearchResults } = await import('./trangNguyenSearchService');

        const searchResult = await searchTrangNguyenQuestions(
            options.classLevel,
            'school', // vòng trường
            options.topic
        );

        if (searchResult.success && searchResult.content) {
            userPrompt = enrichPromptWithSearchResults(userPrompt, searchResult);
        }
    }

    // All AI traffic is authenticated by the Worker; no provider key reaches the browser.
    const responseText = await requestWorkerAiText({
        model: 'gemini-2.5-flash',
        messages: [
            { role: 'system', content: TRANG_NGUYEN_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
    });

    // Parse AI response
    const tnResult = parseAIResponse(responseText);

    // Convert to app format
    const questions = tnResult.questions.map((q, idx) => convertToAppFormat(q, idx));

    // Calculate time limit (30s per question)
    const timeLimit = Math.max(5, Math.ceil(questions.length * 0.5));

    return {
        title: `Trạng Nguyên Tiếng Việt - Lớp ${options.classLevel}: ${options.topic}`,
        questions,
        timeLimit
    };
};

// Export topic suggestions
export { TRANG_NGUYEN_TOPICS };
