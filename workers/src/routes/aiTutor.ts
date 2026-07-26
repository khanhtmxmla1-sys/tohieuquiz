// AI Tutor (Dr. Owl) - Emergency Tutoring Route Handler
// Analyzes wrong answers and generates practice questions via Gemini AI

import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { verifyJWTMiddleware } from '../middleware/jwtAuth';
import { internalErrorResponse } from '../utils/internalError';

// Prompt template for Gemini AI
const buildPrompt = (wrongQuestions: any[]): string => {
    const questionsText = wrongQuestions.map((q, i) => {
        let detail = `Câu ${i + 1}: "${q.question}"`;
        if (q.options) {
            try {
                const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                if (Array.isArray(opts)) {
                    detail += `\nĐáp án: ${opts.join(' | ')}`;
                }
            } catch { /* ignore parse errors */ }
        }
        if (q.correct_answer) {
            detail += `\nĐáp án đúng: ${q.correct_answer}`;
        }
        return detail;
    }).join('\n\n');

    return `Bạn là một giáo viên tiểu học tận tâm tên "Bác sĩ Cú Mèo". Một học sinh vừa làm sai các câu hỏi sau:

${questionsText}

Hãy thực hiện 3 việc sau (trả lời bằng tiếng Việt, ngôn ngữ dễ hiểu cho học sinh tiểu học):

1. **diagnosis**: Phân tích ngắn gọn (1-2 câu) lỗ hổng kiến thức của em học sinh dựa trên các câu sai. Ví dụ: "Em đang gặp khó khăn với phép chia có dư."

2. **explanation**: Giải thích lại cách giải câu đầu tiên một cách đơn giản, thân thiện (3-4 câu). Dùng emoji và ngôn ngữ khích lệ.

3. **practiceQuestions**: Tạo CHÍNH XÁC 3 câu hỏi trắc nghiệm mới cùng dạng với các câu sai, nhưng đổi số liệu/ngữ cảnh. Mỗi câu gồm: question, options (mảng 4 lựa chọn), correctAnswer (đáp án đúng, phải nằm trong options).

Trả lời ĐÚNG format JSON sau, KHÔNG thêm text nào khác:
{
  "diagnosis": "...",
  "explanation": "...",
  "practiceQuestions": [
    { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A" },
    { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "B" },
    { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "C" }
  ]
}`;
};

export async function handleAiTutorRoutes(
    request: Request,
    env: Env,
    path: string,
    method: string
): Promise<Response | null> {

    // POST /api/ai-tutor/diagnose
    if (path === '/api/ai-tutor/diagnose' && method === 'POST') {
        const authResult = await verifyJWTMiddleware(request, env);
        if (authResult instanceof Response) return authResult;

        try {
            const body = await request.json() as any;
            const { quizId, wrongQuestionIds } = body;

            if (!quizId || !wrongQuestionIds || !Array.isArray(wrongQuestionIds) || wrongQuestionIds.length === 0) {
                return errorResponse('Missing quizId or wrongQuestionIds', 400);
            }

            // Limit to max 3 wrong questions to control token usage
            const limitedIds = wrongQuestionIds.slice(0, 3);

            // Fetch the actual question content from DB
            const placeholders = limitedIds.map(() => '?').join(',');
            const questionsResult = await env.DB.prepare(
                `SELECT id, type, question, options, correct_answer FROM questions WHERE id IN (${placeholders}) AND quiz_id = ?`
            ).bind(...limitedIds, quizId).all();

            if (!questionsResult.results || questionsResult.results.length === 0) {
                return errorResponse('No questions found for the given IDs', 404);
            }

            // Build the AI prompt
            const prompt = buildPrompt(questionsResult.results);

            // Call CLIProxy (Gemini) via OpenAI-compatible API
            const aiResponse = await fetch(`${env.CLIPROXY_API}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.CLIPROXY_TOKEN}`,
                },
                body: JSON.stringify({
                    model: 'gemini-2.0-flash',
                    messages: [
                        { role: 'user', content: prompt + '\nLƯU Ý QUAN TRỌNG: CÂU TRẢ LỜI PHẢI RẤT NGẮN GỌN (dưới 150 chữ tổng cộng) ĐỂ TRÁNH BỊ CẮT ĐỨT. Tối đa 2 câu hỏi thực hành thôi.' }
                    ],
                    temperature: 0.7,
                    max_tokens: 4096,
                    max_completion_tokens: 4096,
                    maxOutputTokens: 4096,
                    response_format: { type: 'json_object' },
                }),
            });

            if (!aiResponse.ok) {
                const errText = await aiResponse.text();
                console.error('[AI Tutor] CLIProxy error:', aiResponse.status, errText);
                return errorResponse('AI service temporarily unavailable. Status: ' + aiResponse.status, 503);
            }

            const aiData = await aiResponse.json() as any;
            const rawContent = aiData?.choices?.[0]?.message?.content || '';
            console.log('[AI Tutor] Raw AI response length:', rawContent.length, 'first 200 chars:', rawContent.substring(0, 200));

            // Robust JSON extraction - multiple strategies
            let parsed: any = null;

            // Strategy 1: Direct JSON parse
            try {
                parsed = JSON.parse(rawContent.trim());
            } catch { /* not direct JSON */ }

            // Strategy 2: Strip markdown code fences
            if (!parsed) {
                try {
                    let cleaned = rawContent.trim();
                    // Remove ```json ... ``` or ``` ... ```
                    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
                    parsed = JSON.parse(cleaned.trim());
                } catch { /* not code-fenced JSON */ }
            }

            // Strategy 3: Find first { ... } block via regex
            if (!parsed) {
                try {
                    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        parsed = JSON.parse(jsonMatch[0]);
                    }
                } catch { /* no valid JSON object found */ }
            }

            if (!parsed) {
                console.error('[AI Tutor] All parse strategies failed. Raw:', rawContent.substring(0, 500));
                return jsonResponse({
                    status: 'error',
                    message: 'JSON_PARSE_ERROR',
                    raw: rawContent
                });
            }

            // Validate the parsed response structure
            if (!parsed.diagnosis || !parsed.practiceQuestions || !Array.isArray(parsed.practiceQuestions)) {
                console.error('[AI Tutor] Invalid AI response structure:', JSON.stringify(parsed).substring(0, 300));
                return jsonResponse({
                    status: 'error',
                    message: 'INVALID_JSON_STRUCTURE',
                    raw: parsed
                });
            }

            return jsonResponse({
                status: 'success',
                data: {
                    diagnosis: parsed.diagnosis,
                    explanation: parsed.explanation || '',
                    practiceQuestions: parsed.practiceQuestions.slice(0, 3).map((q: any, i: number) => ({
                        id: `ai-practice-${Date.now()}-${i}`,
                        question: q.question,
                        options: q.options,
                        correctAnswer: q.correctAnswer,
                    })),
                    wrongQuestionIds: limitedIds,
                }
            });

        } catch (error: unknown) {
            return internalErrorResponse(error, request, {
                context: 'POST /api/ai-tutor/diagnose',
            });
        }
    }

    return null;
}
